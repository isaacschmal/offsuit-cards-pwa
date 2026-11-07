import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { PokerTableState } from '../engine/poker/gameState';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export interface RoomSyncHandle {
  broadcastState: (state: PokerTableState) => void;
  disconnect: () => void;
  mode: 'supabase' | 'local-broadcast';
}

export function connectToPokerRoom(
  roomCode: string,
  playerId: string,
  playerName: string,
  onStateReceived: (state: PokerTableState) => void,
  onPresenceChange?: (count: number) => void
): RoomSyncHandle {
  const normalizedCode = roomCode.trim().toUpperCase();

  if (supabase) {
    const channel: RealtimeChannel = supabase.channel(`offsuit-room:${normalizedCode}`, {
      config: {
        presence: { key: playerId },
        broadcast: { self: false },
      },
    });

    channel
      .on('broadcast', { event: 'table_state' }, ({ payload }) => {
        if (payload?.state) {
          onStateReceived(payload.state as PokerTableState);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        onPresenceChange?.(Math.max(1, count));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            playerId,
            playerName,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    return {
      mode: 'supabase',
      broadcastState: (state: PokerTableState) => {
        channel.send({
          type: 'broadcast',
          event: 'table_state',
          payload: { state },
        });
      },
      disconnect: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  // Fallback for local/demo mode using BroadcastChannel so multiple tabs sync in real time
  const bc =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(`offsuit-room-${normalizedCode}`)
      : null;

  if (bc) {
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'table_state' && ev.data?.state) {
        onStateReceived(ev.data.state as PokerTableState);
      }
    };
  }

  onPresenceChange?.(1);

  return {
    mode: 'local-broadcast',
    broadcastState: (state: PokerTableState) => {
      bc?.postMessage({ type: 'table_state', state });
    },
    disconnect: () => {
      bc?.close();
    },
  };
}
