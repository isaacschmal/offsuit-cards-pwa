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
  loadOpenRooms,
  loadPersistedRoomState,
  savePersistedRoomState,
  shouldAcceptIncomingState,
  upsertOpenRoom,
} from './multiplayer';
import {
  deductTableBuyIn,
  loadUserProfile,
  returnTableStack,
  upsertKnownPlayer,
} from './profile';

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
  onPresenceChange?: (count: number) => void,
  initialPaidStack?: number
): RoomSyncHandle {
  const normalizedCode = roomCode.trim().toUpperCase();

  // Bot practice rooms are strictly local single-player; never connect to remote network MQTT
  if (normalizedCode === 'BOTS') {
    return {
      broadcastState: () => {},
      disconnect: () => {},
      mode: 'mqtt-p2p',
    };
  }

  const stateTopic = `cartas/v5/room/${normalizedCode}/state`;
  const eventsTopic = `cartas/v5/room/${normalizedCode}/events`;
  let hasReceivedPeerTableState = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let soloPublishTimer: ReturnType<typeof setTimeout> | null = null;
  let committedStackForJoin =
    typeof initialPaidStack === 'number' ? Math.max(0, Math.round(initialPaidStack)) : 0;
  let hasReconciledRemoteSeat = false;

  // Always keep a local BroadcastChannel for instant zero-latency multi-tab sync
  const bc =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(`cartas-room-${normalizedCode}`)
      : null;

  function sendJoinAndSyncRequest(): void {
    const freshProfile = loadUserProfile();
    const localSaved = loadPersistedRoomState(normalizedCode);
    const localMe = localSaved?.players.find((p) => p.id === freshProfile.playerId);
    const stackForJoin =
      localMe && localMe.stack > 0 && localMe.status !== 'out'
        ? localMe.stack
        : committedStackForJoin > 0
        ? committedStackForJoin
        : (localSaved?.tableBuyIn ?? 200);

    const joinPayload = {
      type: 'join_request',
      player: {
        id: freshProfile.playerId || playerId,
        name: freshProfile.name || playerName || 'Jugador',
        avatarId: freshProfile.avatarId || 'hero',
        xp: freshProfile.xp,
        stack: stackForJoin,
      },
    };
    const syncReqPayload = {
      type: 'sync_request',
      playerId: freshProfile.playerId || playerId,
    };
    bc?.postMessage(joinPayload);
    bc?.postMessage(syncReqPayload);
    mqtt.publish(eventsTopic, joinPayload, false);
    mqtt.publish(eventsTopic, syncReqPayload, false);
  }

  // Cross-device zero-config MQTT over WebSockets (dual-broker redundancy)
  const mqtt = connectMqttTopics(
    [stateTopic, eventsTopic],
    (topic, data) => {
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
    },
    {
      onConnected: () => {
        const latestSaved = loadPersistedRoomState(normalizedCode);
        const seatedNow = latestSaved ? getSeatedPlayersCount(latestSaved.players) : 0;
        if (latestSaved && latestSaved.roomMode === 'real' && seatedNow >= 2) {
          broadcastAll(latestSaved);
        } else {
          sendJoinAndSyncRequest();
          if (soloPublishTimer) clearTimeout(soloPublishTimer);
          soloPublishTimer = setTimeout(() => {
            const currentAfterWait = loadPersistedRoomState(normalizedCode);
            if (
              !hasReceivedPeerTableState &&
              currentAfterWait &&
              currentAfterWait.roomMode === 'real' &&
              getSeatedPlayersCount(currentAfterWait.players) >= 1
            ) {
              broadcastAll(currentAfterWait);
            }
          }, 450);
        }
      },
    }
  );

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
    if (getSeatedPlayersCount(current.players) >= 1) {
      broadcastAll(current);
    }
  }

  function syncRoomMetadataFromState(state: PokerTableState): void {
    if (state.roomMode !== 'real' || normalizedCode === 'BOTS') return;
    const existing = loadOpenRooms().find((r) => r.code === normalizedCode);
    const resolvedPacing = state.pacingMode ?? existing?.pacingMode ?? 'live';
    const resolvedBuyIn = state.tableBuyIn ?? existing?.buyIn ?? 200;
    const sb = Math.max(1, Math.round(resolvedBuyIn / 100));
    const bb = Math.max(2, Math.round(resolvedBuyIn / 50));
    const seated = Math.max(1, getSeatedPlayersCount(state.players));
    const currentActor = state.players[state.currentTurnIndex];

    upsertOpenRoom({
      code: normalizedCode,
      name: state.roomName ?? existing?.name ?? `Sala #${normalizedCode}`,
      pacingMode: resolvedPacing,
      roomMode: 'real',
      buyIn: resolvedBuyIn,
      playerCount: seated,
      maxPlayers: 6,
      blindsLabel: `${sb}/${bb}`,
      turnTimerSeconds: resolvedPacing === 'live' ? 25 : null,
      currentTurnPlayerName:
        seated < 2 ? 'Esperando...' : currentActor?.name ?? existing?.currentTurnPlayerName ?? 'En juego',
      updatedAt: Date.now(),
    });
  }

  function handleIncomingTableState(incoming: PokerTableState): void {
    if (!incoming || !Array.isArray(incoming.players) || incoming.roomMode === 'bots') return;
    hasReceivedPeerTableState = true;
    recordRoomHumanPlayers(incoming);

    const localProfile = loadUserProfile();
    const currentLocal = loadPersistedRoomState(normalizedCode);
    if (!shouldAcceptIncomingState(currentLocal, incoming, localProfile.playerId)) {
      return;
    }

    if (incoming.roomMode === 'real') {
      const existingMe = incoming.players.find((p) => p.id === localProfile.playerId);
      const localMe = currentLocal?.players.find((p) => p.id === localProfile.playerId);
      let effectiveStack = 0;

      if (existingMe && existingMe.stack > 0 && existingMe.status !== 'out') {
        effectiveStack = existingMe.stack;
        // If user just paid a fresh buy-in locally on a room where they already held an active remote seat, refund duplicate deduction
        if (
          !hasReconciledRemoteSeat &&
          committedStackForJoin > 0 &&
          (!localMe || localMe.status === 'out' || getSeatedPlayersCount(currentLocal?.players ?? []) < 2)
        ) {
          // Only refund if currentLocal didn't already represent this same remote seat
          const localSeatedCount = currentLocal ? getSeatedPlayersCount(currentLocal.players) : 0;
          if (localSeatedCount <= 1 && currentLocal?.createdAt !== incoming.createdAt) {
            returnTableStack(committedStackForJoin);
            committedStackForJoin = 0;
          }
        }
        hasReconciledRemoteSeat = true;
      } else {
        // Joining a remote room we weren't seated in yet: reconcile committedStackForJoin against room's real tableBuyIn
        const targetBuyIn = incoming.tableBuyIn ?? 200;
        if (!hasReconciledRemoteSeat && committedStackForJoin > 0) {
          if (committedStackForJoin > targetBuyIn) {
            returnTableStack(committedStackForJoin - targetBuyIn);
            committedStackForJoin = targetBuyIn;
          } else if (committedStackForJoin < targetBuyIn) {
            const { paid } = deductTableBuyIn(targetBuyIn - committedStackForJoin);
            committedStackForJoin += paid;
          }
          hasReconciledRemoteSeat = true;
        }
        effectiveStack = committedStackForJoin;
      }

      const { state: withMe, changed } = seatPlayerInTable(incoming, {
        id: localProfile.playerId,
        name: localProfile.name || playerName || 'Jugador',
        avatarId: localProfile.avatarId,
        stack: effectiveStack,
      });

      const mergedMetaState: PokerTableState = {
        ...withMe,
        pacingMode: incoming.pacingMode ?? withMe.pacingMode,
        roomName: incoming.roomName ?? withMe.roomName,
        tableBuyIn: incoming.tableBuyIn ?? withMe.tableBuyIn,
      };

      savePersistedRoomState(normalizedCode, mergedMetaState);
      syncRoomMetadataFromState(mergedMetaState);
      onPresenceChange?.(Math.max(1, getSeatedPlayersCount(mergedMetaState.players)));
      onStateReceived(mergedMetaState);
      if (changed) {
        broadcastAll(mergedMetaState);
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

    const maxRoomBuyIn = current.tableBuyIn ?? 500;
    const normalizedJoinStack =
      typeof joiningPlayer.stack === 'number'
        ? Math.min(Math.max(0, Math.round(joiningPlayer.stack)), maxRoomBuyIn)
        : maxRoomBuyIn;

    const { state: updated, changed } = seatPlayerInTable(current, {
      ...joiningPlayer,
      stack: normalizedJoinStack,
    });
    if (changed) {
      savePersistedRoomState(normalizedCode, updated);
      syncRoomMetadataFromState(updated);
      onPresenceChange?.(Math.max(1, getSeatedPlayersCount(updated.players)));
      onStateReceived(updated);
      broadcastAll(updated);
    } else if (
      updated.players.some((p) => p.id === joiningPlayer.id) &&
      getSeatedPlayersCount(updated.players) >= 1
    ) {
      // Joining player is already seated or we are the host holding authoritative state:
      // re-broadcast authoritative table state immediately!
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

  // Announce our presence immediately via BroadcastChannel & MQTT
  sendJoinAndSyncRequest();

  // Retry join_request + sync_request after 800ms if no peer state or still waiting for a 2nd player
  retryTimer = setTimeout(() => {
    const latestSaved = loadPersistedRoomState(normalizedCode);
    const seatedNow = latestSaved ? getSeatedPlayersCount(latestSaved.players) : 1;
    if (!hasReceivedPeerTableState || seatedNow < 2) {
      sendJoinAndSyncRequest();
    }
  }, 800);

  // Update local presence count; if 2+ players are already seated, publish immediately
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
    if (soloPublishTimer) clearTimeout(soloPublishTimer);
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
