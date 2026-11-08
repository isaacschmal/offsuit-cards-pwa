import { useCallback, useEffect, useRef, useState } from 'react';
import { Lobby } from './components/Lobby';
import { PokerTable } from './components/poker/PokerTable';
import {
  createInitialTableState,
  getSeatedPlayersCount,
  type PokerTableState,
  type RoomPlayersMode,
} from './engine/poker/gameState';
import {
  deletePersistedRoomState,
  getOrInitRoomState,
  loadOpenRooms,
  loadPersistedRoomState,
  type RoomPacingMode,
  savePersistedRoomState,
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
      const resolvedMode: RoomPacingMode = mode ?? existingRoom?.pacingMode ?? 'live';
      const resolvedPlayersMode: RoomPlayersMode =
        playersMode ??
        existingRoom?.roomMode ??
        (normalized === 'BOTS' ? 'bots' : 'real');
      const resolvedName = customName ?? existingRoom?.name ?? `Sala #${normalized}`;

      const targetBuyIn =
        resolvedPlayersMode === 'bots'
          ? Math.min(100, buyIn ?? existingRoom?.buyIn ?? 100)
          : (buyIn ?? existingRoom?.buyIn ?? 200);

      // Check if player is ALREADY seated in this room with an active table stack > 0
      const currentProfile = loadUserProfile();
      const existingSaved = loadPersistedRoomState(normalized);
      const existingSeat = existingSaved?.players
        ? existingSaved.players.find((p) => p.id === currentProfile.playerId)
        : null;
      const alreadyHasStack = Boolean(existingSeat && existingSeat.stack > 0 && existingSeat.status !== 'out');

      let effectiveStack = targetBuyIn;
      if (!alreadyHasStack) {
        // Deduct buy-in only when entering a fresh table / new game
        const { paid } = deductTableBuyIn(targetBuyIn);
        effectiveStack = paid;
      } else if (existingSeat) {
        effectiveStack = existingSeat.stack;
      }

      const roomState = getOrInitRoomState(
        normalized,
        resolvedPlayersMode,
        effectiveStack
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
          pacingMode: resolvedMode,
          roomMode: resolvedPlayersMode,
          buyIn: actualBuyIn,
          playerCount: realSeatedCount,
          maxPlayers: 6,
          blindsLabel: `${sb}/${bb}`,
          turnTimerSeconds: resolvedMode === 'live' ? 20 : null,
          currentTurnPlayerName:
            existingRoom?.currentTurnPlayerName ?? (profile.name || 'Jugador'),
          updatedAt: Date.now(),
        });
      }

      setRoomCode(normalized);
      setRoomName(resolvedName);
      setPacingMode(resolvedMode);
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
          'live',
          `Sala #${targetRoom}`,
          targetRoom === 'BOTS' ? 'bots' : 'real'
        );
      }
    };

    checkPendingRoomJoin();
    window.addEventListener('cartas-profile-updated', checkPendingRoomJoin);
    return () =>
      window.removeEventListener('cartas-profile-updated', checkPendingRoomJoin);
  }, [handleJoinOrCreateRoom]);

  useEffect(() => {
    syncRef.current?.disconnect();
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
        savePersistedRoomState(roomCode, incomingState);
      },
      (count) => setOnlineCount(count)
    );
    syncRef.current = handle;

    return () => {
      handle.disconnect();
    };
  }, [roomCode, tableState.roomMode]);

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
        // Explicit cash out: return table stack to player's wallet
        if (typeof finalStack === 'number' && finalStack > 0) {
          returnTableStack(finalStack);
        }
        if (isBotGame) {
          deletePersistedRoomState(roomCode);
        } else {
          const profile = loadUserProfile();
          const updatedPlayers = tableState.players.map((p) =>
            p.id === profile.playerId || p.id === 'hero'
              ? { ...p, stack: 0, status: 'out' as const }
              : p
          );
          const nextState: PokerTableState = {
            ...tableState,
            players: updatedPlayers,
            stateVersion: (tableState.stateVersion ?? 1) + 1,
          };
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
