import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import {
  getSeatedPlayersCount,
  isVacantSeat,
  type PokerTableState,
  seatPlayerInTable,
} from '../engine/poker/gameState';
import {
  connectMqttTopics,
  getPartyKitWebSocketUrl,
  isPartyKitConfigured,
  loadPersistedRoomState,
  savePersistedRoomState,
} from './multiplayer';
import { loadUserProfile, upsertKnownPlayer } from './profile';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export interface RoomSyncHandle {
  broadcastState: (state: PokerTableState) => void;
  disconnect: () => void;
  mode: 'partykit' | 'supabase' | 'mqtt-p2p';
}

function recordRoomHumanPlayers(state: PokerTableState): void {
  for (const p of state.players) {
    if (!p.isBot && !isVacantSeat(p) && p.id !== 'hero') {
      upsertKnownPlayer({
        id: p.id,
        name: p.name,
        avatarId: p.avatarId,
      });
    }
  }
}

export function connectToPokerRoom(
  roomCode: string,
  playerId: string,
  playerName: string,
  onStateReceived: (state: PokerTableState) => void,
  onPresenceChange?: (count: number) => void
): RoomSyncHandle {
  const normalizedCode = roomCode.trim().toUpperCase();
  const stateTopic = `cartas/v5/room/${normalizedCode}/state`;
  const eventsTopic = `cartas/v5/room/${normalizedCode}/events`;

  // Always keep a local BroadcastChannel for instant zero-latency multi-tab sync
  const bc =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(`cartas-room-${normalizedCode}`)
      : null;

  // Cross-device zero-config MQTT over WebSockets
  const mqtt = connectMqttTopics([stateTopic, eventsTopic], (topic, data) => {
    const payload = data as {
      type?: string;
      state?: PokerTableState;
      player?: { id: string; name: string; avatarId: string; xp?: number };
    };

    if (topic === stateTopic && payload?.type === 'table_state' && payload.state) {
      handleIncomingTableState(payload.state);
    } else if (topic === eventsTopic && payload?.type === 'join_request' && payload.player) {
      handleIncomingJoinRequest(payload.player);
    }
  });

  function broadcastAll(state: PokerTableState): void {
    recordRoomHumanPlayers(state);
    bc?.postMessage({ type: 'table_state', state });
    mqtt.publish(stateTopic, { type: 'table_state', state }, true);
  }

  function handleIncomingTableState(incoming: PokerTableState): void {
    recordRoomHumanPlayers(incoming);
    const localProfile = loadUserProfile();
    if (incoming.roomMode === 'real') {
      const { state: withMe, changed } = seatPlayerInTable(incoming, {
        id: localProfile.playerId,
        name: localProfile.name || playerName || 'Jugador',
        avatarId: localProfile.avatarId,
      });
      onPresenceChange?.(Math.max(1, getSeatedPlayersCount(withMe.players)));
      onStateReceived(withMe);
      if (changed) {
        savePersistedRoomState(normalizedCode, withMe);
        broadcastAll(withMe);
      }
      return;
    }
    onPresenceChange?.(Math.max(1, getSeatedPlayersCount(incoming.players)));
    onStateReceived(incoming);
  }

  function handleIncomingJoinRequest(joiningPlayer: {
    id: string;
    name: string;
    avatarId: string;
    xp?: number;
  }): void {
    upsertKnownPlayer(joiningPlayer);
    const current = loadPersistedRoomState(normalizedCode);
    if (!current || current.roomMode !== 'real') return;
    const { state: updated, changed } = seatPlayerInTable(current, joiningPlayer);
    if (changed) {
      savePersistedRoomState(normalizedCode, updated);
      onPresenceChange?.(Math.max(1, getSeatedPlayersCount(updated.players)));
      onStateReceived(updated);
      broadcastAll(updated);
    }
  }

  if (bc) {
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'table_state' && ev.data?.state) {
        handleIncomingTableState(ev.data.state as PokerTableState);
      } else if (ev.data?.type === 'join_request' && ev.data?.player) {
        handleIncomingJoinRequest(ev.data.player);
      }
    };
  }

  // Announce our presence so any peer in the room seats us immediately
  const profile = loadUserProfile();
  const joinPayload = {
    type: 'join_request',
    player: {
      id: profile.playerId || playerId,
      name: profile.name || playerName || 'Jugador',
      avatarId: profile.avatarId || 'hero',
      xp: profile.xp,
    },
  };
  bc?.postMessage(joinPayload);
  mqtt.publish(eventsTopic, joinPayload, false);

  // If we already have a local room state with players, also publish it as retained state so joining peers see it
  const initialSaved = loadPersistedRoomState(normalizedCode);
  if (initialSaved && initialSaved.roomMode === 'real') {
    onPresenceChange?.(Math.max(1, getSeatedPlayersCount(initialSaved.players)));
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
            handleIncomingTableState(payload.state);
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
        broadcastAll(state);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'table_state', state }));
        }
      },
      disconnect: () => {
        bc?.close();
        mqtt.close();
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
          handleIncomingTableState(payload.state as PokerTableState);
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
        broadcastAll(state);
        channel.send({
          type: 'broadcast',
          event: 'table_state',
          payload: { state },
        });
      },
      disconnect: () => {
        bc?.close();
        mqtt.close();
        supabase.removeChannel(channel);
      },
    };
  }

  // 3. Default Cross-Device MQTT over WebSockets + Local BroadcastChannel
  return {
    mode: 'mqtt-p2p',
    broadcastState: (state: PokerTableState) => {
      broadcastAll(state);
    },
    disconnect: () => {
      bc?.close();
      mqtt.close();
    },
  };
}
