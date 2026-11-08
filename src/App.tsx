import { useCallback, useEffect, useRef, useState } from 'react';
import { Lobby } from './components/Lobby';
import { PokerTable } from './components/poker/PokerTable';
import {
  createInitialTableState,
  type PokerTableState,
} from './engine/poker/gameState';
import {
  getOrInitRoomState,
  loadOpenRooms,
  type RoomPacingMode,
  savePersistedRoomState,
  upsertOpenRoom,
} from './lib/multiplayer';
import { loadUserProfile } from './lib/profile';
import { connectToPokerRoom, type RoomSyncHandle } from './lib/supabase';

export function App() {
  const [view, setView] = useState<'lobby' | 'table'>('lobby');
  const [roomCode, setRoomCode] = useState<string>('PRIMOS');
  const [roomName, setRoomName] = useState<string>('Mesa de los Primos');
  const [pacingMode, setPacingMode] = useState<RoomPacingMode>('live');
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [tableState, setTableState] = useState<PokerTableState>(() =>
    createInitialTableState('PRIMOS')
  );
  const [externalState, setExternalState] = useState<PokerTableState | null>(null);
  const syncRef = useRef<RoomSyncHandle | null>(null);

  useEffect(() => {
    syncRef.current?.disconnect();
    const profile = loadUserProfile();
    const handle = connectToPokerRoom(
      roomCode,
      'hero',
      profile.name,
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

  const handleJoinOrCreateRoom = (
    newCode: string,
    mode?: RoomPacingMode,
    customName?: string
  ) => {
    const normalized = newCode.trim().toUpperCase();
    const existingRoom = loadOpenRooms().find((r) => r.code === normalized);
    const resolvedMode: RoomPacingMode = mode ?? existingRoom?.pacingMode ?? 'live';
    const resolvedName = customName ?? existingRoom?.name ?? `Sala #${normalized}`;

    upsertOpenRoom({
      code: normalized,
      name: resolvedName,
      pacingMode: resolvedMode,
      playerCount: existingRoom?.playerCount ?? 2,
      maxPlayers: 6,
      blindsLabel: existingRoom?.blindsLabel ?? '1/2',
      turnTimerSeconds: resolvedMode === 'live' ? 20 : null,
      currentTurnPlayerName: existingRoom?.currentTurnPlayerName ?? 'Tú',
      updatedAt: Date.now(),
    });

    const roomState = getOrInitRoomState(normalized);
    setRoomCode(normalized);
    setRoomName(resolvedName);
    setPacingMode(resolvedMode);
    setTableState(roomState);
    setExternalState(roomState);
    setView('table');
  };

  if (view === 'lobby') {
    return (
      <Lobby
        activeRoomCode={roomCode}
        activePacingMode={pacingMode}
        onlineCount={onlineCount}
        onStartInstantTable={() => setView('table')}
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
      onBack={() => setView('lobby')}
      onBroadcastState={handleBroadcastState}
    />
  );
}

export default App;
