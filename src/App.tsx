import { useCallback, useEffect, useRef, useState } from 'react';
import { Lobby } from './components/Lobby';
import { PokerTable } from './components/poker/PokerTable';
import {
  createInitialTableState,
  type PokerTableState,
} from './engine/poker/gameState';
import { connectToPokerRoom, type RoomSyncHandle } from './lib/supabase';

export function App() {
  const [view, setView] = useState<'table' | 'lobby'>('table');
  const [roomCode, setRoomCode] = useState<string>('OFFSUIT');
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [tableState, setTableState] = useState<PokerTableState>(() =>
    createInitialTableState('OFFSUIT')
  );
  const [externalState, setExternalState] = useState<PokerTableState | null>(null);
  const syncRef = useRef<RoomSyncHandle | null>(null);

  useEffect(() => {
    syncRef.current?.disconnect();
    const handle = connectToPokerRoom(
      roomCode,
      'hero',
      'You',
      (incomingState) => {
        setExternalState(incomingState);
        setTableState(incomingState);
      },
      (count) => setOnlineCount(count)
    );
    syncRef.current = handle;

    return () => {
      handle.disconnect();
    };
  }, [roomCode]);

  const handleBroadcastState = useCallback((nextState: PokerTableState) => {
    setTableState(nextState);
    syncRef.current?.broadcastState(nextState);
  }, []);

  const handleJoinOrCreateRoom = (newCode: string) => {
    const fresh = createInitialTableState(newCode);
    setRoomCode(newCode);
    setTableState(fresh);
    setExternalState(fresh);
    setView('table');
  };

  if (view === 'lobby') {
    return (
      <Lobby
        activeRoomCode={roomCode}
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
      onBack={() => setView('lobby')}
      onBroadcastState={handleBroadcastState}
    />
  );
}

export default App;
