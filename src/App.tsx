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

      // Check if user is already seated in this room with an active stack
      const existingSaved = loadPersistedRoomState(normalized);
      const profile = loadUserProfile();
      const seatedHero = existingSaved?.players?.find((p) => p.id === profile.playerId);
      const alreadyHasStack = seatedHero && seatedHero.stack > 0;

      let effectiveStack = targetBuyIn;
      if (!alreadyHasStack) {
        const { paid } = deductTableBuyIn(targetBuyIn);
        effectiveStack = paid;
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
  }, [roomCode]);

  const handleBroadcastState = useCallback(
    (nextState: PokerTableState) => {
      setTableState(nextState);
      savePersistedRoomState(roomCode, nextState);
      syncRef.current?.broadcastState(nextState);
    },
    [roomCode]
  );

  const handleLeaveTableToLobby = useCallback((finalStack?: number) => {
    pendingUrlRoomRef.current = null;
    if (typeof finalStack === 'number' && finalStack > 0) {
      returnTableStack(finalStack);
    }
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {
        // ignore history API errors
      }
    }
    setView('lobby');
  }, []);

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
