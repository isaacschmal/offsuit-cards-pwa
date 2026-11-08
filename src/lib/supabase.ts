import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { PokerTableState } from '../engine/poker/gameState';
import { getPartyKitWebSocketUrl, isPartyKitConfigured } from './multiplayer';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export interface RoomSyncHandle {
  broadcastState: (state: PokerTableState) => void;
  disconnect: () => void;
  mode: 'partykit' | 'supabase' | 'local-broadcast';
}

export function connectToPokerRoom(
  roomCode: string,
  playerId: string,
  playerName: string,
  onStateReceived: (state: PokerTableState) => void,
  onPresenceChange?: (count: number) => void
): RoomSyncHandle {
  const normalizedCode = roomCode.trim().toUpperCase();

  // Always keep a local BroadcastChannel for instant zero-latency multi-tab sync
  const bc =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(`cartas-room-${normalizedCode}`)
      : null;

  if (bc) {
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'table_state' && ev.data?.state) {
        onStateReceived(ev.data.state as PokerTableState);
      }
    };
  }

  // 1. Zero-Cost PartyKit / Cloudflare WebSocket Room Server (when VITE_PARTYKIT_HOST is set)
  const wsUrl = getPartyKitWebSocketUrl(normalizedCode);
  if (isPartyKitConfigured && wsUrl && typeof WebSocket !== 'undefined') {
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (ev) => {
        try {
          const payload = JSON.parse(String(ev.data)) as {
            type?: string;
            state?: PokerTableState;
            count?: number;
          };
          if (payload.type === 'table_state' && payload.state) {
            onStateReceived(payload.state);
          } else if (payload.type === 'presence' && typeof payload.count === 'number') {
            onPresenceChange?.(Math.max(1, payload.count));
          }
        } catch {
          // ignore malformed payload
        }
      };
    } catch {
      ws = null;
    }

    return {
      mode: 'partykit',
      broadcastState: (state: PokerTableState) => {
        bc?.postMessage({ type: 'table_state', state });
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'table_state', state }));
        }
      },
      disconnect: () => {
        bc?.close();
        ws?.close();
      },
    };
  }

  // 2. Optional Supabase Realtime Channel
  if (supabase) {
    const channel: RealtimeChannel = supabase.channel(`cartas-room:${normalizedCode}`, {
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
        bc?.postMessage({ type: 'table_state', state });
        channel.send({
          type: 'broadcast',
          event: 'table_state',
          payload: { state },
        });
      },
      disconnect: () => {
        bc?.close();
        supabase.removeChannel(channel);
      },
    };
  }

  // 3. Offline / Local BroadcastChannel mode
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
