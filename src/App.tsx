import { useCallback, useEffect, useRef, useState } from 'react';
import { Lobby } from './components/Lobby';
import { PokerTable } from './components/poker/PokerTable';
import {
  createInitialTableState,
  getSeatedPlayersCount,
  type PokerTableState,
  type RoomPlayersMode,
  vacatePlayerSeat,
} from './engine/poker/gameState';
import {
  deletePersistedRoomState,
  getOrInitRoomState,
  loadOpenRooms,
  loadPersistedRoomState,
  type RoomPacingMode,
  savePersistedRoomState,
  subscribeToSeatedRooms,
  upsertOpenRoom,
} from './lib/multiplayer';
import {
  deductTableBuyIn,
  loadUserProfile,
  returnTableStack,
} from './lib/profile';
import { connectToPokerRoom, type RoomSyncHandle } from './lib/supabase';

function getInitialUrlRoomCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room')?.trim().toUpperCase();
    return code && code.length > 0 ? code : null;
  } catch {
    return null;
  }
}

export function App() {
  const [view, setView] = useState<'lobby' | 'table'>('lobby');
  const [roomCode, setRoomCode] = useState<string>(
    () => getInitialUrlRoomCode() ?? 'MESA1'
  );
  const [roomName, setRoomName] = useState<string>('Mesa de Amigos');
  const [pacingMode, setPacingMode] = useState<RoomPacingMode>('live');
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [tableState, setTableState] = useState<PokerTableState>(() =>
    createInitialTableState('MESA1', 'real', false)
  );
  const [externalState, setExternalState] = useState<PokerTableState | null>(null);
  const syncRef = useRef<RoomSyncHandle | null>(null);
  const pendingUrlRoomRef = useRef<string | null>(getInitialUrlRoomCode());
  const paidEntryStackRef = useRef<number>(0);

  const handleJoinOrCreateRoom = useCallback(
    (
      newCode: string,
      mode?: RoomPacingMode,
      customName?: string,
      playersMode?: RoomPlayersMode,
      buyIn?: number
    ) => {
      const normalized = newCode.trim().toUpperCase();
      const existingRoom = loadOpenRooms().find((r) => r.code === normalized);
      const existingSaved = loadPersistedRoomState(normalized);
      const resolvedMode: RoomPacingMode =
        mode ?? existingRoom?.pacingMode ?? existingSaved?.pacingMode ?? 'live';
      const resolvedPlayersMode: RoomPlayersMode =
        playersMode ??
        existingRoom?.roomMode ??
        existingSaved?.roomMode ??
        (normalized === 'BOTS' ? 'bots' : 'real');
      const resolvedName =
        customName ?? existingRoom?.name ?? existingSaved?.roomName ?? `Sala #${normalized}`;

      const targetBuyIn =
        resolvedPlayersMode === 'bots'
          ? Math.min(100, buyIn ?? existingRoom?.buyIn ?? 100)
          : (buyIn ?? existingRoom?.buyIn ?? existingSaved?.tableBuyIn ?? 200);

      // Check if player is ALREADY seated in this room with an active table stack > 0
      const currentProfile = loadUserProfile();
      const existingSeat = existingSaved?.players
        ? existingSaved.players.find((p) => p.id === currentProfile.playerId)
        : null;
      const alreadyHasStack = Boolean(
        resolvedPlayersMode !== 'bots' &&
          normalized !== 'BOTS' &&
          existingSeat &&
          existingSeat.stack > 0 &&
          existingSeat.status !== 'out'
      );

      if (!alreadyHasStack && currentProfile.bankroll <= 0) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cartas-insufficient-chips'));
        }
        return;
      }

      let effectiveStack = targetBuyIn;
      if (!alreadyHasStack) {
        // Deduct buy-in only when entering a fresh table / new game
        const { paid } = deductTableBuyIn(targetBuyIn);
        if (paid <= 0) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cartas-insufficient-chips'));
          }
          return;
        }
        effectiveStack = paid;
        paidEntryStackRef.current = paid;
      } else if (existingSeat) {
        effectiveStack = existingSeat.stack;
        paidEntryStackRef.current = existingSeat.stack;
      }

      const roomState = getOrInitRoomState(
        normalized,
        resolvedPlayersMode,
        effectiveStack,
        resolvedMode,
        resolvedName
      );
      const realSeatedCount =
        resolvedPlayersMode === 'bots'
          ? 6
          : Math.max(1, getSeatedPlayersCount(roomState.players));

      const actualBuyIn = roomState.tableBuyIn ?? targetBuyIn;
      const sb = Math.max(1, Math.round(actualBuyIn / 100));
      const bb = Math.max(2, Math.round(actualBuyIn / 50));
      const profile = loadUserProfile();

      if (resolvedPlayersMode !== 'bots' && normalized !== 'BOTS') {
        upsertOpenRoom({
          code: normalized,
          name: resolvedName,
          pacingMode: roomState.pacingMode ?? resolvedMode,
          roomMode: resolvedPlayersMode,
          buyIn: actualBuyIn,
          playerCount: realSeatedCount,
          maxPlayers: 6,
          blindsLabel: `${sb}/${bb}`,
          turnTimerSeconds: (roomState.pacingMode ?? resolvedMode) === 'live' ? 25 : null,
          currentTurnPlayerName:
            existingRoom?.currentTurnPlayerName ?? (profile.name || 'Jugador'),
          updatedAt: Date.now(),
        });
      }

      setRoomCode(normalized);
      setRoomName(roomState.roomName ?? resolvedName);
      setPacingMode(roomState.pacingMode ?? resolvedMode);
      setTableState(roomState);
      setExternalState(roomState);
      setView('table');
    },
    []
  );

  // Auto-join ?room=CODE from shared URL (either immediately if name is set, or right after welcome modal)
  useEffect(() => {
    const checkPendingRoomJoin = () => {
      const targetRoom = pendingUrlRoomRef.current;
      if (!targetRoom) return;
      const profile = loadUserProfile();
      if (profile.hasSetCustomName) {
        pendingUrlRoomRef.current = null;
        handleJoinOrCreateRoom(
          targetRoom,
          undefined,
          undefined,
          targetRoom === 'BOTS' ? 'bots' : 'real'
        );
      }
    };

    checkPendingRoomJoin();
    window.addEventListener('cartas-profile-updated', checkPendingRoomJoin);
    return () =>
      window.removeEventListener('cartas-profile-updated', checkPendingRoomJoin);
  }, [handleJoinOrCreateRoom]);

  // Recover orphaned BOTS sessions & listen to all seated tables while in the Lobby
  useEffect(() => {
    if (view !== 'lobby') return;

    const profile = loadUserProfile();
    const orphanedBotState = loadPersistedRoomState('BOTS');
    if (orphanedBotState && Array.isArray(orphanedBotState.players)) {
      const heroBotSeat = orphanedBotState.players.find(
        (p) => (p.id === profile.playerId || p.id === 'hero') && p.status !== 'out'
      );
      if (heroBotSeat && heroBotSeat.stack > 0) {
        returnTableStack(heroBotSeat.stack);
      }
      deletePersistedRoomState('BOTS');
    }

    const openRooms = loadOpenRooms();
    const seatedRoomCodes = openRooms
      .filter((r) => {
        const saved = loadPersistedRoomState(r.code);
        return Boolean(
          saved?.players?.some(
            (p) => (p.id === profile.playerId || p.id === 'hero') && p.stack > 0 && p.status !== 'out'
          )
        );
      })
      .map((r) => r.code);

    if (seatedRoomCodes.length === 0) return;

    return subscribeToSeatedRooms(seatedRoomCodes, profile.playerId, () => {
      window.dispatchEvent(new CustomEvent('cartas-rooms-updated'));
    });
  }, [view]);

  // Connect to active poker room ONLY when actually inside the table view
  useEffect(() => {
    syncRef.current?.disconnect();
    if (view !== 'table') {
      syncRef.current = null;
      return;
    }

    // Bot rooms are 100% offline local single-player; never connect to remote network MQTT
    if (roomCode === 'BOTS' || tableState.roomMode === 'bots') {
      syncRef.current = null;
      setOnlineCount(1);
      return;
    }

    const profile = loadUserProfile();
    const handle = connectToPokerRoom(
      roomCode,
      profile.playerId,
      profile.name || 'Jugador',
      (incomingState) => {
        setExternalState(incomingState);
        setTableState(incomingState);
        if (incomingState.pacingMode) {
          setPacingMode(incomingState.pacingMode);
        }
        if (incomingState.roomName) {
          setRoomName(incomingState.roomName);
        }
        savePersistedRoomState(roomCode, incomingState);
      },
      (count) => setOnlineCount(count),
      paidEntryStackRef.current
    );
    syncRef.current = handle;

    return () => {
      handle.disconnect();
    };
  }, [view, roomCode, tableState.roomMode]);

  const handleBroadcastState = useCallback(
    (nextState: PokerTableState) => {
      setTableState(nextState);
      savePersistedRoomState(roomCode, nextState);
      if (roomCode !== 'BOTS' && nextState.roomMode !== 'bots') {
        syncRef.current?.broadcastState(nextState);
      }
    },
    [roomCode]
  );

  const handleLeaveTableToLobby = useCallback(
    (finalStack?: number, shouldCashOut = false) => {
      pendingUrlRoomRef.current = null;
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        try {
          window.history.replaceState({}, '', window.location.pathname);
        } catch {
          // ignore history API errors
        }
      }

      const isBotGame = roomCode === 'BOTS' || tableState.roomMode === 'bots';
      const actualCashOut = shouldCashOut || isBotGame;

      if (actualCashOut) {
        // Explicit cash out: return table stack to player's wallet and vacate seat
        if (typeof finalStack === 'number' && finalStack > 0) {
          returnTableStack(finalStack);
        }
        if (isBotGame) {
          deletePersistedRoomState(roomCode);
        } else {
          const profile = loadUserProfile();
          const latestSaved = loadPersistedRoomState(roomCode) ?? tableState;
          const nextState = vacatePlayerSeat(latestSaved, profile.playerId);
          savePersistedRoomState(roomCode, nextState);
          syncRef.current?.broadcastState(nextState);
        }
      } else {
        // KEEP SEAT AND TABLE STACK INTACT (Especially for turn-based games)!
        // Simply persist current table state with player seated so they can return anytime
        savePersistedRoomState(roomCode, tableState);
      }

      setView('lobby');
    },
    [roomCode, tableState]
  );

  if (view === 'lobby') {
    return (
      <Lobby
        activeRoomCode={roomCode}
        activePacingMode={pacingMode}
        onlineCount={onlineCount}
        onStartInstantTable={() =>
          handleJoinOrCreateRoom('BOTS', 'live', 'Práctica vs Bots (IA)', 'bots', 100)
        }
        onJoinOrCreateRoom={handleJoinOrCreateRoom}
      />
    );
  }

  return (
    <PokerTable
      initialState={tableState}
      externalState={externalState}
      roomName={roomName}
      pacingMode={pacingMode}
      onBack={handleLeaveTableToLobby}
      onBroadcastState={handleBroadcastState}
    />
  );
}

export default App;
