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
  shouldAcceptIncomingState,
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
  let hasReceivedPeerTableState = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  // Always keep a local BroadcastChannel for instant zero-latency multi-tab sync
  const bc =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(`cartas-room-${normalizedCode}`)
      : null;

  // Cross-device zero-config MQTT over WebSockets (dual-broker redundancy)
  const mqtt = connectMqttTopics([stateTopic, eventsTopic], (topic, data) => {
    const payload = data as {
      type?: string;
      state?: PokerTableState;
      player?: { id: string; name: string; avatarId: string; xp?: number; stack?: number };
    };

    if (topic === stateTopic && payload?.type === 'table_state' && payload.state) {
      handleIncomingTableState(payload.state);
    } else if (topic === eventsTopic && payload?.type === 'join_request' && payload.player) {
      handleIncomingJoinRequest(payload.player);
    } else if (topic === eventsTopic && payload?.type === 'sync_request') {
      handleIncomingSyncRequest();
    }
  });

  function broadcastAll(state: PokerTableState): void {
    const profile = loadUserProfile();
    const versionedState: PokerTableState = {
      ...state,
      stateVersion: Math.max(1, state.stateVersion ?? 1),
      updatedBy: state.updatedBy ?? profile.playerId ?? playerId,
    };
    recordRoomHumanPlayers(versionedState);
    bc?.postMessage({ type: 'table_state', state: versionedState });
    mqtt.publish(stateTopic, { type: 'table_state', state: versionedState }, true);
  }

  function handleIncomingSyncRequest(): void {
    const current = loadPersistedRoomState(normalizedCode);
    if (!current || current.roomMode !== 'real') return;
    if (getSeatedPlayersCount(current.players) >= 2) {
      broadcastAll(current);
    }
  }

  function handleIncomingTableState(incoming: PokerTableState): void {
    if (!incoming || !Array.isArray(incoming.players)) return;
    hasReceivedPeerTableState = true;
    recordRoomHumanPlayers(incoming);

    const currentLocal = loadPersistedRoomState(normalizedCode);
    if (!shouldAcceptIncomingState(currentLocal, incoming)) {
      return;
    }

    const localProfile = loadUserProfile();
    if (incoming.roomMode === 'real') {
      const { state: withMe, changed } = seatPlayerInTable(incoming, {
        id: localProfile.playerId,
        name: localProfile.name || playerName || 'Jugador',
        avatarId: localProfile.avatarId,
        stack: localProfile.bankroll,
      });
      savePersistedRoomState(normalizedCode, withMe);
      onPresenceChange?.(Math.max(1, getSeatedPlayersCount(withMe.players)));
      onStateReceived(withMe);
      if (changed) {
        broadcastAll(withMe);
      }
      return;
    }
    savePersistedRoomState(normalizedCode, incoming);
    onPresenceChange?.(Math.max(1, getSeatedPlayersCount(incoming.players)));
    onStateReceived(incoming);
  }

  function handleIncomingJoinRequest(joiningPlayer: {
    id: string;
    name: string;
    avatarId: string;
    xp?: number;
    stack?: number;
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
    } else if (
      updated.players.some((p) => p.id === joiningPlayer.id) &&
      getSeatedPlayersCount(updated.players) >= 2
    ) {
      // Joining player is already seated (e.g. reconnecting or retrying join_request):
      // Seat 0 (authoritative host/dealer) or any active peer re-broadcasts the authoritative table state!
      broadcastAll(updated);
    }
  }

  if (bc) {
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'table_state' && ev.data?.state) {
        handleIncomingTableState(ev.data.state as PokerTableState);
      } else if (ev.data?.type === 'join_request' && ev.data?.player) {
        handleIncomingJoinRequest(ev.data.player);
      } else if (ev.data?.type === 'sync_request') {
        handleIncomingSyncRequest();
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
      stack: profile.bankroll,
    },
  };
  bc?.postMessage(joinPayload);
  mqtt.publish(eventsTopic, joinPayload, false);

  // If a joining player doesn't receive `table_state` within 800ms of sending `join_request`,
  // automatically retry `join_request` and `sync_request` so any peer in the room replies immediately!
  retryTimer = setTimeout(() => {
    const latestSaved = loadPersistedRoomState(normalizedCode);
    const seatedNow = latestSaved ? getSeatedPlayersCount(latestSaved.players) : 1;
    if (!hasReceivedPeerTableState || seatedNow < 2) {
      const freshProfile = loadUserProfile();
      const retryJoinPayload = {
        type: 'join_request',
        player: {
          id: freshProfile.playerId || playerId,
          name: freshProfile.name || playerName || 'Jugador',
          avatarId: freshProfile.avatarId || 'hero',
          xp: freshProfile.xp,
          stack: freshProfile.bankroll,
        },
      };
      const syncReqPayload = {
        type: 'sync_request',
        playerId: freshProfile.playerId || playerId,
      };
      bc?.postMessage(retryJoinPayload);
      bc?.postMessage(syncReqPayload);
      mqtt.publish(eventsTopic, retryJoinPayload, false);
      mqtt.publish(eventsTopic, syncReqPayload, false);
    }
  }, 800);

  // If we already have a local room state with players, update presence count;
  // only publish retained state immediately if 2+ players are already seated so a solo joiner doesn't overwrite the host!
  const initialSaved = loadPersistedRoomState(normalizedCode);
  if (initialSaved && initialSaved.roomMode === 'real') {
    const initialSeated = getSeatedPlayersCount(initialSaved.players);
    onPresenceChange?.(Math.max(1, initialSeated));
    if (initialSeated >= 2) {
      broadcastAll(initialSaved);
    }
  }

  const cleanupCommon = () => {
    if (retryTimer) clearTimeout(retryTimer);
    bc?.close();
    mqtt.close();
  };

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
        cleanupCommon();
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
        cleanupCommon();
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
      cleanupCommon();
    },
  };
}
