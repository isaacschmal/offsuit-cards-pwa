import {
  createInitialTableState,
  getSeatedPlayersCount,
  getTotalPot,
  type PokerTableState,
  type RoomPlayersMode,
  seatPlayerInTable,
  vacatePlayerSeat,
} from '../engine/poker/gameState';
import { loadUserProfile, returnTableStack } from './profile';
import { supabase } from './supabase';

export type RoomPacingMode = 'live' | 'async';
export type { RoomPlayersMode };

export interface OpenRoomInfo {
  code: string;
  name: string;
  pacingMode: RoomPacingMode;
  roomMode: RoomPlayersMode;
  buyIn: number; // e.g. 100, 200, 300, 500
  playerCount: number;
  maxPlayers: number;
  blindsLabel: string;
  turnTimerSeconds: number | null; // e.g. 20 for live, null for async chess-style
  currentTurnPlayerName: string;
  updatedAt: number;
}

export const ROOMS_STORAGE_KEY = 'cartas_open_rooms_directory_v5';
const ROOM_STATE_PREFIX = 'cartas_room_state_v5_';

const partykitHost = import.meta.env.VITE_PARTYKIT_HOST as string | undefined;
export const isPartyKitConfigured = Boolean(partykitHost && partykitHost.trim().length > 0);

export function getPartyKitWebSocketUrl(roomId: string): string | null {
  if (!partykitHost) return null;
  const cleanHost = partykitHost.trim().replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
  const isLocal =
    cleanHost.startsWith('localhost') ||
    cleanHost.startsWith('127.0.0.1') ||
    cleanHost.startsWith('0.0.0.0');
  const protocol = isLocal ? 'ws' : 'wss';
  return `${protocol}://${cleanHost}/party/${encodeURIComponent(roomId)}`;
}

/**
 * Lightweight zero-dependency MQTT v3.1.1 over WebSockets client (`wss://broker.emqx.io:8084/mqtt`)
 * for instant cross-device room discovery and live table sync without backend setup.
 */
const MQTT_BROKER_URLS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

function encodeMqttVarLength(len: number): number[] {
  const bytes: number[] = [];
  let rem = len;
  do {
    let encodedByte = rem % 128;
    rem = Math.floor(rem / 128);
    if (rem > 0) encodedByte |= 128;
    bytes.push(encodedByte);
  } while (rem > 0);
  return bytes;
}

function encodeMqttUtf8(str: string): Uint8Array {
  const utf8 = utf8Encoder.encode(str);
  const out = new Uint8Array(2 + utf8.length);
  out[0] = (utf8.length >> 8) & 0xff;
  out[1] = utf8.length & 0xff;
  out.set(utf8, 2);
  return out;
}

export function buildMqttConnectPacket(clientId: string): Uint8Array<ArrayBuffer> {
  const protoName = encodeMqttUtf8('MQTT');
  const varHeader = new Uint8Array([
    ...protoName,
    0x04, // Protocol level 4 (MQTT 3.1.1)
    0x02, // Clean Session = 1
    0x00,
    0x3c, // Keep Alive = 60s
  ]);
  const payload = encodeMqttUtf8(clientId);
  const remLen = encodeMqttVarLength(varHeader.length + payload.length);
  const pkt = new Uint8Array(1 + remLen.length + varHeader.length + payload.length);
  pkt[0] = 0x10; // CONNECT
  pkt.set(remLen, 1);
  pkt.set(varHeader, 1 + remLen.length);
  pkt.set(payload, 1 + remLen.length + varHeader.length);
  return pkt;
}

export function buildMqttSubscribePacket(
  topic: string,
  packetId = 1
): Uint8Array<ArrayBuffer> {
  const topicBytes = encodeMqttUtf8(topic);
  const varHeader = new Uint8Array([(packetId >> 8) & 0xff, packetId & 0xff]);
  const remLen = encodeMqttVarLength(varHeader.length + topicBytes.length + 1);
  const pkt = new Uint8Array(1 + remLen.length + varHeader.length + topicBytes.length + 1);
  pkt[0] = 0x82; // SUBSCRIBE (QoS 1 header flag)
  pkt.set(remLen, 1);
  pkt.set(varHeader, 1 + remLen.length);
  pkt.set(topicBytes, 1 + remLen.length + varHeader.length);
  pkt[pkt.length - 1] = 0x00; // Requested QoS 0
  return pkt;
}

export function buildMqttPublishPacket(
  topic: string,
  message: string,
  retain = false
): Uint8Array<ArrayBuffer> {
  const topicBytes = encodeMqttUtf8(topic);
  const payloadBytes = utf8Encoder.encode(message);
  const remLen = encodeMqttVarLength(topicBytes.length + payloadBytes.length);
  const pkt = new Uint8Array(1 + remLen.length + topicBytes.length + payloadBytes.length);
  pkt[0] = retain ? 0x31 : 0x30; // PUBLISH QoS 0, optional retain
  pkt.set(remLen, 1);
  pkt.set(topicBytes, 1 + remLen.length);
  pkt.set(payloadBytes, 1 + remLen.length + topicBytes.length);
  return pkt;
}

export function parseMqttPublishPackets(
  buffer: Uint8Array
): Array<{ topic: string; payload: string }> {
  const results: Array<{ topic: string; payload: string }> = [];
  let offset = 0;

  while (offset < buffer.length) {
    const header = buffer[offset];
    const packetType = (header >> 4) & 0x0f;
    const qos = (header >> 1) & 0x03;

    let multiplier = 1;
    let remainingLength = 0;
    let idx = offset + 1;

    while (idx < buffer.length) {
      const encodedByte = buffer[idx];
      remainingLength += (encodedByte & 127) * multiplier;
      idx++;
      if ((encodedByte & 128) === 0) break;
      multiplier *= 128;
    }

    const packetEnd = idx + remainingLength;
    if (packetEnd > buffer.length) break;

    if (packetType === 3 && remainingLength >= 2) {
      const topicLen = (buffer[idx] << 8) | buffer[idx + 1];
      const topicStart = idx + 2;
      const topicEnd = topicStart + topicLen;
      if (topicEnd <= packetEnd) {
        const topic = utf8Decoder.decode(buffer.subarray(topicStart, topicEnd));
        const payloadStart = topicEnd + (qos > 0 ? 2 : 0);
        if (payloadStart <= packetEnd) {
          const payload = utf8Decoder.decode(buffer.subarray(payloadStart, packetEnd));
          results.push({ topic, payload });
        }
      }
    }

    offset = packetEnd;
  }

  return results;
}

import { isVacantSeat } from '../engine/poker/gameState';

export interface MqttSubscriptionHandle {
  publish: (topic: string, data: unknown, retain?: boolean) => void;
  close: () => void;
}

export interface ConnectMqttOptions {
  onConnected?: () => void;
}

export function connectMqttTopics(
  topics: string[],
  onMessage: (topic: string, data: unknown) => void,
  options?: ConnectMqttOptions
): MqttSubscriptionHandle {
  if (typeof WebSocket === 'undefined') {
    return { publish: () => {}, close: () => {} };
  }

  let closed = false;
  const activeClients: Array<{
    brokerUrl: string;
    brokerIdx: number;
    ws: WebSocket | null;
    isReady: boolean;
    pingTimer: ReturnType<typeof setInterval> | null;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
    reconnectAttempt: number;
    pendingPublishes: Array<{ topic: string; json: string; retain: boolean }>;
  }> = [];

  const connectBroker = (
    clientEntry: (typeof activeClients)[number]
  ): void => {
    if (closed) return;
    try {
      const socket = new WebSocket(clientEntry.brokerUrl, 'mqtt');
      socket.binaryType = 'arraybuffer';
      clientEntry.ws = socket;
      clientEntry.isReady = false;
      const clientId = `cartas_${clientEntry.brokerIdx}_${Math.random().toString(36).slice(2, 10)}`;

      const flushPending = () => {
        if (!clientEntry.isReady || socket.readyState !== WebSocket.OPEN) return;
        while (clientEntry.pendingPublishes.length > 0) {
          const item = clientEntry.pendingPublishes.shift()!;
          try {
            socket.send(buildMqttPublishPacket(item.topic, item.json, item.retain));
          } catch {
            // ignore
          }
        }
      };

      socket.onopen = () => {
        if (closed) {
          socket.close();
          return;
        }
        clientEntry.reconnectAttempt = 0;
        try {
          socket.send(buildMqttConnectPacket(clientId));
        } catch {
          // ignore
        }
      };

      socket.onmessage = (ev) => {
        if (!(ev.data instanceof ArrayBuffer)) return;
        const bytes = new Uint8Array(ev.data);
        if (bytes.length === 0) return;

        const packetType = (bytes[0] >> 4) & 0x0f;
        // CONNACK = 2
        if (packetType === 2 && !clientEntry.isReady) {
          clientEntry.isReady = true;
          topics.forEach((t, i) => {
            try {
              socket.send(buildMqttSubscribePacket(t, i + 1));
            } catch {
              // ignore
            }
          });
          // Slight delay after SUBSCRIBE so broker processes subscription before we flush join/sync requests
          setTimeout(() => {
            flushPending();
            options?.onConnected?.();
          }, 80);

          if (clientEntry.pingTimer) clearInterval(clientEntry.pingTimer);
          clientEntry.pingTimer = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              try {
                socket.send(new Uint8Array([0xc0, 0x00])); // PINGREQ
              } catch {
                // ignore
              }
            }
          }, 25_000);
          return;
        }

        // SUBACK = 9 -> flush any pending publishes immediately
        if (packetType === 9) {
          flushPending();
          return;
        }

        const published = parseMqttPublishPackets(bytes);
        for (const msg of published) {
          if (!msg.payload) continue;
          try {
            const parsed = JSON.parse(msg.payload);
            onMessage(msg.topic, parsed);
          } catch {
            // ignore non-JSON
          }
        }
      };

      socket.onerror = () => {
        try {
          socket.close();
        } catch {
          // ignore
        }
      };

      socket.onclose = () => {
        clientEntry.isReady = false;
        if (clientEntry.pingTimer) {
          clearInterval(clientEntry.pingTimer);
          clientEntry.pingTimer = null;
        }
        if (closed) return;
        const delay = Math.min(8000, 1000 * Math.pow(1.6, clientEntry.reconnectAttempt));
        clientEntry.reconnectAttempt += 1;
        if (clientEntry.reconnectTimer) clearTimeout(clientEntry.reconnectTimer);
        clientEntry.reconnectTimer = setTimeout(() => {
          connectBroker(clientEntry);
        }, delay);
      };
    } catch {
      // ignore broker init error
    }
  };

  // Connect to ALL configured MQTT WebSocket brokers in parallel for dual-broker redundancy
  MQTT_BROKER_URLS.forEach((brokerUrl, brokerIdx) => {
    const clientEntry = {
      brokerUrl,
      brokerIdx,
      ws: null as WebSocket | null,
      isReady: false,
      pingTimer: null as ReturnType<typeof setInterval> | null,
      reconnectTimer: null as ReturnType<typeof setTimeout> | null,
      reconnectAttempt: 0,
      pendingPublishes: [] as Array<{ topic: string; json: string; retain: boolean }>,
    };
    activeClients.push(clientEntry);
    connectBroker(clientEntry);
  });

  // Immediately recover dropped WebSockets when returning from background (iOS PWA / Safari) or regaining network
  const handleWakeReconnect = () => {
    if (closed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    for (const client of activeClients) {
      const state = client.ws?.readyState;
      if (state === undefined || state === WebSocket.CLOSED || state === WebSocket.CLOSING) {
        if (client.reconnectTimer) {
          clearTimeout(client.reconnectTimer);
          client.reconnectTimer = null;
        }
        client.reconnectAttempt = 0;
        connectBroker(client);
      } else if (client.isReady) {
        options?.onConnected?.();
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', handleWakeReconnect);
    window.addEventListener('online', handleWakeReconnect);
    window.addEventListener('focus', handleWakeReconnect);
  }

  return {
    publish: (topic: string, data: unknown, retain = false) => {
      if (closed) return;
      const json = data === null ? '' : JSON.stringify(data);
      for (const client of activeClients) {
        if (client.ws && client.ws.readyState === WebSocket.OPEN && client.isReady) {
          try {
            client.ws.send(buildMqttPublishPacket(topic, json, retain));
          } catch {
            // ignore send errors
          }
        } else {
          // Queue even if OPEN before CONNACK, CONNECTING, or temporarily reconnecting
          if (client.pendingPublishes.length > 20) {
            client.pendingPublishes.shift();
          }
          client.pendingPublishes.push({ topic, json, retain });
        }
      }
    },
    close: () => {
      closed = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleWakeReconnect);
        window.removeEventListener('online', handleWakeReconnect);
        window.removeEventListener('focus', handleWakeReconnect);
      }
      for (const client of activeClients) {
        if (client.pingTimer) clearInterval(client.pingTimer);
        if (client.reconnectTimer) clearTimeout(client.reconnectTimer);
        try {
          client.ws?.close();
        } catch {
          // ignore
        }
      }
    },
  };
}

/**
 * Determines whether an incoming PokerTableState should be accepted over the local state.
 * Prevents stale retained messages or out-of-order packets from overwriting a newer turn or newly dealt hand.
 */
export function shouldAcceptIncomingState(
  current: PokerTableState | null | undefined,
  incoming: PokerTableState,
  localPlayerId?: string
): boolean {
  if (!incoming) return false;
  // Bot practice rooms are strictly local single-player offline sessions; never accept remote state!
  if (incoming.roomMode === 'bots' || current?.roomMode === 'bots' || incoming.roomId === 'BOTS') {
    return false;
  }

  if (!current) return true;
  if (current.roomId !== incoming.roomId) return true;

  // Never accept our own echoed state back from network
  if (localPlayerId && incoming.updatedBy === localPlayerId) {
    return false;
  }

  const incomingSeated = getSeatedPlayersCount(incoming.players);
  const currentSeated = getSeatedPlayersCount(current.players);

  // Always accept a state that has more real seated players than our local state
  if (incomingSeated > currentSeated) return true;

  const incVer = incoming.stateVersion ?? 0;
  const curVer = current.stateVersion ?? 0;

  // Reject stale 1-player pre-deal states when we already have 2+ seated players,
  // EXCEPT if a seated player intentionally vacated/cashed out with a strictly newer version
  if (currentSeated >= 2 && incomingSeated < 2) {
    const departedActorWasSeated = Boolean(
      incoming.updatedBy &&
        current.players.some((p) => p.id === incoming.updatedBy && !isVacantSeat(p))
    );
    if (
      departedActorWasSeated &&
      incoming.handNumber >= current.handNumber &&
      incVer > curVer
    ) {
      return true;
    }
    return false;
  }

  // Room discovery adoption: both sides have 1 solo player (two separate tabs/devices in same room code before handshake).
  // Adopt whichever room was created earlier (or deterministic player ID tie-breaker) so joiner seats next to host!
  if (
    currentSeated === 1 &&
    incomingSeated === 1 &&
    localPlayerId &&
    current.players.some((p) => p.id === localPlayerId) &&
    !incoming.players.some((p) => p.id === localPlayerId)
  ) {
    const curCreated = current.createdAt ?? Number.MAX_SAFE_INTEGER;
    const incCreated = incoming.createdAt ?? Number.MAX_SAFE_INTEGER;
    if (incCreated !== curCreated) {
      return incCreated < curCreated;
    }
    const curHostId = current.players.find((p) => !isVacantSeat(p))?.id ?? '';
    const incHostId = incoming.players.find((p) => !isVacantSeat(p))?.id ?? '';
    return incHostId < curHostId;
  }

  // Higher handNumber always wins
  if (incoming.handNumber > current.handNumber) return true;
  if (incoming.handNumber < current.handNumber) return false;

  // Strictly higher version wins
  if (incVer > curVer) return true;
  if (incVer < curVer) return false;

  // Simultaneous action/deal tie-breaker so peers never stay split-brained on equal version
  if (incoming.updatedBy && current.updatedBy && incoming.updatedBy !== current.updatedBy) {
    return incoming.updatedBy < current.updatedBy;
  }

  return false;
}

export const DEFAULT_OPEN_ROOMS: OpenRoomInfo[] = [];

export const LIVE_ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours for live rooms
export const ASYNC_ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for turn-based async rooms
const DELETED_ROOMS_STORAGE_KEY = 'cartas_deleted_rooms_v5';

let memoryOpenRooms: OpenRoomInfo[] = [];
let memoryDeletedRooms: Record<string, number> = {};

export function isRoomExpired(room: OpenRoomInfo, now = Date.now()): boolean {
  if (!room || typeof room.updatedAt !== 'number') return true;
  const ttl = room.pacingMode === 'async' ? ASYNC_ROOM_TTL_MS : LIVE_ROOM_TTL_MS;
  return now - room.updatedAt > ttl;
}

function loadDeletedRoomsMap(): Record<string, number> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...memoryDeletedRooms };
  }
  try {
    const raw = window.localStorage.getItem(DELETED_ROOMS_STORAGE_KEY);
    if (!raw) return { ...memoryDeletedRooms };
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object'
      ? { ...memoryDeletedRooms, ...parsed }
      : { ...memoryDeletedRooms };
  } catch {
    return { ...memoryDeletedRooms };
  }
}

function recordDeletedRoomTimestamp(code: string, timestamp = Date.now()): void {
  const key = code.toUpperCase();
  memoryDeletedRooms[key] = timestamp;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const map = loadDeletedRoomsMap();
    map[key] = timestamp;
    window.localStorage.setItem(DELETED_ROOMS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function clearDeletedRoomTimestamp(code: string): void {
  const key = code.toUpperCase();
  delete memoryDeletedRooms[key];
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const map = loadDeletedRoomsMap();
    if (key in map) {
      delete map[key];
      window.localStorage.setItem(DELETED_ROOMS_STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // ignore storage errors
  }
}

export function loadOpenRooms(now = Date.now()): OpenRoomInfo[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    memoryOpenRooms = memoryOpenRooms.filter((r) => !isRoomExpired(r, now));
    return [...memoryOpenRooms];
  }
  try {
    const raw = window.localStorage.getItem(ROOMS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_OPEN_ROOMS;
    }
    const parsed = JSON.parse(raw) as OpenRoomInfo[];
    if (!Array.isArray(parsed)) {
      return DEFAULT_OPEN_ROOMS;
    }
    const normalized = parsed.map((r) => ({
      ...r,
      roomMode: r.roomMode ?? (r.code === 'BOTS' ? 'bots' : 'real'),
    }));
    const valid = normalized.filter(
      (r) => !isRoomExpired(r, now) && r.roomMode !== 'bots' && r.code !== 'BOTS'
    );
    if (valid.length !== normalized.length) {
      for (const r of normalized) {
        if (isRoomExpired(r, now)) {
          try {
            window.localStorage.removeItem(`${ROOM_STATE_PREFIX}${r.code.toUpperCase()}`);
          } catch {
            // ignore
          }
        }
      }
      saveOpenRooms(valid);
    }
    return valid;
  } catch {
    return DEFAULT_OPEN_ROOMS;
  }
}

export function saveOpenRooms(rooms: OpenRoomInfo[]): void {
  memoryOpenRooms = [...rooms];
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(rooms));
  } catch {
    // ignore storage quota errors
  }
}

export function mergeOpenRoomsList(
  localRooms: OpenRoomInfo[],
  incomingRooms: OpenRoomInfo[],
  now = Date.now()
): OpenRoomInfo[] {
  const deletedMap = loadDeletedRoomsMap();
  const map = new Map<string, OpenRoomInfo>();
  for (const r of localRooms) {
    if (isRoomExpired(r, now)) continue;
    map.set(r.code.toUpperCase(), r);
  }
  for (const inc of incomingRooms) {
    if (!inc?.code) continue;
    if (isRoomExpired(inc, now)) continue;
    const key = inc.code.toUpperCase();
    const deletedAt = deletedMap[key];
    if (deletedAt && (inc.updatedAt ?? 0) <= deletedAt) {
      continue;
    }
    const existing = map.get(key);
    if (!existing || (inc.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
      map.set(key, {
        ...inc,
        code: key,
        roomMode: inc.roomMode ?? (key === 'BOTS' ? 'bots' : 'real'),
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function upsertOpenRoom(room: OpenRoomInfo): OpenRoomInfo[] {
  const normalizedCode = room.code.trim().toUpperCase();
  // Bot practice sessions are private solo games; never list in public rooms directory
  if (room.roomMode === 'bots' || normalizedCode === 'BOTS') {
    return loadOpenRooms();
  }
  const existing = loadOpenRooms();
  clearDeletedRoomTimestamp(normalizedCode);
  const idx = existing.findIndex((r) => r.code === normalizedCode);
  let updated: OpenRoomInfo[];

  if (idx >= 0) {
    updated = [...existing];
    updated[idx] = { ...existing[idx], ...room, code: normalizedCode, updatedAt: Date.now() };
  } else {
    updated = [{ ...room, code: normalizedCode, updatedAt: Date.now() }, ...existing];
  }

  saveOpenRooms(updated);
  broadcastDirectoryUpdate(updated, undefined, updated.find((r) => r.code === normalizedCode));
  return updated;
}

export function deleteOpenRoom(roomCode: string, refundPlayerId?: string): OpenRoomInfo[] {
  const normalized = roomCode.trim().toUpperCase();
  recordDeletedRoomTimestamp(normalized, Date.now());

  // Automatically cash out/refund any chips the player had seated at this table!
  const targetId =
    refundPlayerId ??
    (typeof window !== 'undefined' ? loadUserProfile().playerId : undefined);
  if (targetId) {
    const saved = loadPersistedRoomState(normalized);
    if (saved && Array.isArray(saved.players)) {
      const hero = saved.players.find(
        (p) => (p.id === targetId || p.id === 'hero') && p.status !== 'out'
      );
      if (hero && hero.stack > 0) {
        returnTableStack(hero.stack);
      }
    }
  }

  const existing = loadOpenRooms();
  const updated = existing.filter((r) => r.code !== normalized);
  saveOpenRooms(updated);

  memoryRoomStates.delete(normalized);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(`${ROOM_STATE_PREFIX}${normalized}`);
    } catch {
      // ignore storage errors
    }
  }

  const stateTopic = `cartas/v5/room/${normalized}/state`;
  const roomMetaTopic = `${LOBBY_ROOM_TOPIC_PREFIX}${normalized}`;
  sharedLobbyMqtt?.publish(stateTopic, null, true);
  sharedLobbyMqtt?.publish(roomMetaTopic, null, true);
  broadcastDirectoryUpdate(updated, normalized);
  return updated;
}

/**
 * Cashes out player's stack from a persisted room state into their wallet,
 * vacates their seat cleanly, and updates/broadcasts the room state.
 */
export function cashOutAndLeavePersistedRoom(
  roomCode: string,
  playerId?: string
): { cashedOut: number; updatedState: PokerTableState | null } {
  const normalized = roomCode.trim().toUpperCase();
  const targetId = playerId ?? loadUserProfile().playerId;
  const saved = loadPersistedRoomState(normalized);
  if (!saved || !Array.isArray(saved.players)) {
    return { cashedOut: 0, updatedState: null };
  }

  const heroIndex = saved.players.findIndex(
    (p) => (p.id === targetId || p.id === 'hero') && p.status !== 'out'
  );
  if (heroIndex === -1) {
    return { cashedOut: 0, updatedState: saved };
  }

  const hero = saved.players[heroIndex];
  const cashedOut = hero.stack > 0 ? hero.stack : 0;
  if (cashedOut > 0) {
    returnTableStack(cashedOut);
  }

  if (saved.roomMode === 'bots' || normalized === 'BOTS') {
    deletePersistedRoomState(normalized);
    return { cashedOut, updatedState: null };
  }

  const nextState = vacatePlayerSeat(saved, hero.id);
  savePersistedRoomState(normalized, nextState);
  const stateTopic = `cartas/v5/room/${normalized}/state`;
  sharedLobbyMqtt?.publish(stateTopic, { type: 'table_state', state: nextState }, true);
  return { cashedOut, updatedState: nextState };
}

export function createNewOpenRoom(
  name: string,
  pacingMode: RoomPacingMode,
  customCode?: string,
  roomMode: RoomPlayersMode = 'real',
  buyIn = 200
): OpenRoomInfo {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let generated = '';
  for (let i = 0; i < 5; i++) {
    generated += chars[Math.floor(Math.random() * chars.length)];
  }
  const code = (customCode?.trim() || generated).toUpperCase();
  const profile = loadUserProfile();
  const resolvedBuyIn =
    roomMode === 'bots' ? Math.min(100, Math.max(20, buyIn)) : Math.max(50, buyIn);
  const sb = Math.max(1, Math.round(resolvedBuyIn / 100));
  const bb = Math.max(2, Math.round(resolvedBuyIn / 50));

  const newRoom: OpenRoomInfo = {
    code,
    name: name.trim() || `Sala #${code}`,
    pacingMode,
    roomMode,
    buyIn: resolvedBuyIn,
    playerCount: roomMode === 'bots' ? 6 : 1,
    maxPlayers: 6,
    blindsLabel: `${sb}/${bb}`,
    turnTimerSeconds: pacingMode === 'live' ? 25 : null,
    currentTurnPlayerName: profile.name || 'Jugador',
    updatedAt: Date.now(),
  };

  if (roomMode !== 'bots' && code !== 'BOTS') {
    upsertOpenRoom(newRoom);
  }
  return newRoom;
}

export const memoryRoomStates = new Map<string, PokerTableState>();

if (typeof globalThis !== 'undefined') {
  (globalThis as any).__CARTAS_ACTIVE_TABLES_CHIPS__ = (targetId: string) => {
    let sum = 0;
    for (const state of memoryRoomStates.values()) {
      if (state && Array.isArray(state.players)) {
        const hero = state.players.find(
          (p: any) =>
            p && (p.id === targetId || p.id === 'hero') && p.status !== 'out'
        );
        if (hero && typeof hero.stack === 'number' && hero.stack > 0) {
          sum += hero.stack;
        }
      }
    }
    return sum;
  };
}

export function loadPersistedRoomState(roomCode: string): PokerTableState | null {
  const normalized = roomCode.trim().toUpperCase();
  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryRoomStates.get(normalized) ?? null;
  }
  try {
    const key = `${ROOM_STATE_PREFIX}${normalized}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return memoryRoomStates.get(normalized) ?? null;
    return JSON.parse(raw) as PokerTableState;
  } catch {
    return memoryRoomStates.get(normalized) ?? null;
  }
}

export function savePersistedRoomState(roomCode: string, state: PokerTableState): void {
  const normalized = roomCode.trim().toUpperCase();
  memoryRoomStates.set(normalized, state);
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const key = `${ROOM_STATE_PREFIX}${normalized}`;
    window.localStorage.setItem(key, JSON.stringify(state));

    // Also update the room's currentTurnPlayerName, buyIn, pacingMode, and real playerCount in the directory
    const rooms = loadOpenRooms();
    const found = rooms.find((r) => r.code === normalized);
    if (found) {
      const currentActor = state.players[state.currentTurnIndex];
      const seatedCount = getSeatedPlayersCount(state.players);
      const turnLabel =
        state.street === 'showdown'
          ? 'Showdown'
          : seatedCount < 2
          ? 'Esperando jugadores...'
          : currentActor?.name ?? 'En juego';
      upsertOpenRoom({
        ...found,
        name: state.roomName ?? found.name,
        pacingMode: state.pacingMode ?? found.pacingMode,
        buyIn: state.tableBuyIn ?? found.buyIn ?? 200,
        playerCount: state.roomMode === 'bots' ? 6 : Math.max(1, seatedCount),
        currentTurnPlayerName: turnLabel,
      });
    }
  } catch {
    // ignore storage errors
  }
}

export function deletePersistedRoomState(roomCode: string): void {
  const normalized = roomCode.trim().toUpperCase();
  memoryRoomStates.delete(normalized);
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const key = `${ROOM_STATE_PREFIX}${normalized}`;
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getOrInitRoomState(
  roomCode: string,
  roomMode: RoomPlayersMode = 'real',
  buyIn?: number,
  pacingMode: RoomPacingMode = 'live',
  roomName?: string
): PokerTableState {
  const normalized = roomCode.trim().toUpperCase();
  const profile = loadUserProfile();
  const targetBuyIn = buyIn ?? (roomMode === 'bots' ? 100 : 200);

  // Bot practice sessions are always clean, fresh tables with the paid buy-in
  if (roomMode === 'bots' || normalized === 'BOTS') {
    const fresh = createInitialTableState(
      normalized,
      'bots',
      false,
      targetBuyIn,
      'live',
      roomName
    );
    const { state: seatedFresh } = seatPlayerInTable(fresh, {
      id: profile.playerId,
      name: profile.name || 'Jugador',
      avatarId: profile.avatarId,
      stack: targetBuyIn,
    });
    savePersistedRoomState(normalized, seatedFresh);
    return seatedFresh;
  }

  const saved = loadPersistedRoomState(normalized);
  if (
    saved &&
    Array.isArray(saved.players) &&
    saved.players.length === 6 &&
    saved.roomMode === roomMode
  ) {
    const { state: withLocalPlayer } = seatPlayerInTable(saved, {
      id: profile.playerId,
      name: profile.name || 'Jugador',
      avatarId: profile.avatarId,
      stack: targetBuyIn,
    });
    savePersistedRoomState(normalized, withLocalPlayer);
    return withLocalPlayer;
  }

  const fresh = createInitialTableState(
    normalized,
    roomMode,
    false,
    targetBuyIn,
    pacingMode,
    roomName
  );
  const { state: seatedFresh } = seatPlayerInTable(fresh, {
    id: profile.playerId,
    name: profile.name || 'Jugador',
    avatarId: profile.avatarId,
    stack: targetBuyIn,
  });
  savePersistedRoomState(normalized, seatedFresh);
  return seatedFresh;
}

const LOBBY_MQTT_TOPIC = 'cartas/v5/lobby/directory';
const LOBBY_ROOM_TOPIC_PREFIX = 'cartas/v5/lobby/rooms/';
let sharedLobbyMqtt: MqttSubscriptionHandle | null = null;

function broadcastDirectoryUpdate(
  rooms: OpenRoomInfo[],
  deletedCode?: string,
  upsertedRoom?: OpenRoomInfo
): void {
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel('cartas-rooms-directory');
      bc.postMessage({ type: 'directory_sync', rooms, deletedCode });
      bc.close();
    } catch {
      // ignore
    }
  }

  if (upsertedRoom) {
    sharedLobbyMqtt?.publish(
      `${LOBBY_ROOM_TOPIC_PREFIX}${upsertedRoom.code.toUpperCase()}`,
      { type: 'room_upsert', room: upsertedRoom },
      true
    );
  }

  sharedLobbyMqtt?.publish(
    LOBBY_MQTT_TOPIC,
    { type: 'directory_sync', rooms, deletedCode },
    false
  );

  // PartyKit Cloudflare zero-cost WebSocket directory broadcast
  const wsUrl = getPartyKitWebSocketUrl('lobby');
  if (wsUrl && typeof WebSocket !== 'undefined') {
    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'directory_sync', rooms, deletedCode }));
        setTimeout(() => ws.close(), 250);
      };
    } catch {
      // ignore offline
    }
  }

  if (supabase) {
    const channel = supabase.channel('cartas-lobby-directory');
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'directory_sync',
          payload: { rooms, deletedCode },
        });
      }
    });
  }
}

export function subscribeToOpenRoomsDirectory(
  onRoomsUpdated: (rooms: OpenRoomInfo[]) => void
): () => void {
  const applyRemoteSync = (rooms: OpenRoomInfo[], deletedCode?: string) => {
    if (deletedCode) {
      recordDeletedRoomTimestamp(deletedCode, Date.now());
    }
    const currentLocal = loadOpenRooms().filter(
      (r) => !deletedCode || r.code !== deletedCode.toUpperCase()
    );
    const merged = mergeOpenRoomsList(currentLocal, rooms);
    saveOpenRooms(merged);
    onRoomsUpdated(merged);
  };

  const bc =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('cartas-rooms-directory')
      : null;

  if (bc) {
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'directory_sync' && Array.isArray(ev.data.rooms)) {
        applyRemoteSync(ev.data.rooms, ev.data.deletedCode);
      }
    };
  }

  const mqttHandle = connectMqttTopics(
    [LOBBY_MQTT_TOPIC, `${LOBBY_ROOM_TOPIC_PREFIX}#`],
    (_topic, data) => {
      const payload = data as {
        type?: string;
        rooms?: OpenRoomInfo[];
        room?: OpenRoomInfo;
        deletedCode?: string;
      };
      if (payload?.type === 'room_upsert' && payload.room) {
        applyRemoteSync([payload.room]);
      } else if (payload?.type === 'directory_sync' && Array.isArray(payload.rooms)) {
        applyRemoteSync(payload.rooms, payload.deletedCode);
      }
    }
  );
  sharedLobbyMqtt = mqttHandle;

  // Publish any locally known active rooms to individual retained topics on lobby startup
  for (const r of loadOpenRooms()) {
    if (r.roomMode !== 'bots' && r.code !== 'BOTS') {
      mqttHandle.publish(
        `${LOBBY_ROOM_TOPIC_PREFIX}${r.code.toUpperCase()}`,
        { type: 'room_upsert', room: r },
        true
      );
    }
  }

  let lobbyWs: WebSocket | null = null;
  const wsUrl = getPartyKitWebSocketUrl('lobby');
  if (wsUrl && typeof WebSocket !== 'undefined') {
    try {
      lobbyWs = new WebSocket(wsUrl);
      lobbyWs.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as {
            type?: string;
            rooms?: OpenRoomInfo[];
            deletedCode?: string;
          };
          if (data.type === 'directory_sync' && Array.isArray(data.rooms)) {
            applyRemoteSync(data.rooms, data.deletedCode);
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }
  }

  const handleStorage = (ev: StorageEvent) => {
    if (ev.key === ROOMS_STORAGE_KEY) {
      onRoomsUpdated(loadOpenRooms());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  return () => {
    bc?.close();
    mqttHandle.close();
    if (sharedLobbyMqtt === mqttHandle) {
      sharedLobbyMqtt = null;
    }
    lobbyWs?.close();
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
  };
}

/**
 * Background listener while in the Lobby so "Tus Mesas Activas" updates in real time
 * and triggers async turn notifications whenever a friend acts on any seated table.
 */
export function subscribeToSeatedRooms(
  roomCodes: string[],
  localPlayerId: string,
  onRoomStateUpdated: (roomCode: string, state: PokerTableState) => void
): () => void {
  const uniqueCodes = Array.from(
    new Set(
      roomCodes
        .map((c) => c.trim().toUpperCase())
        .filter((c) => c && c !== 'BOTS')
    )
  );
  if (uniqueCodes.length === 0) return () => {};

  const topics = uniqueCodes.map((c) => `cartas/v5/room/${c}/state`);
  const bcs: BroadcastChannel[] = [];

  const handleIncoming = (incoming: PokerTableState) => {
    if (!incoming?.roomId || incoming.roomMode === 'bots') return;
    const code = incoming.roomId.toUpperCase();
    const current = loadPersistedRoomState(code);
    if (!shouldAcceptIncomingState(current, incoming, localPlayerId)) return;

    const prevTurnPlayerId = current?.players[current.currentTurnIndex]?.id;
    const nextTurnPlayerId = incoming.players[incoming.currentTurnIndex]?.id;

    savePersistedRoomState(code, incoming);
    onRoomStateUpdated(code, incoming);

    if (
      prevTurnPlayerId !== localPlayerId &&
      nextTurnPlayerId === localPlayerId &&
      incoming.street !== 'showdown' &&
      getSeatedPlayersCount(incoming.players) >= 2
    ) {
      const roomMeta = loadOpenRooms().find((r) => r.code === code);
      void notifyPlayerTurn(
        incoming.roomName ?? roomMeta?.name ?? `Sala #${code}`,
        code,
        incoming
      );
    }
  };

  if (typeof BroadcastChannel !== 'undefined') {
    for (const code of uniqueCodes) {
      try {
        const bc = new BroadcastChannel(`cartas-room-${code}`);
        bc.onmessage = (ev) => {
          if (ev.data?.type === 'table_state' && ev.data?.state) {
            handleIncoming(ev.data.state as PokerTableState);
          }
        };
        bcs.push(bc);
      } catch {
        // ignore
      }
    }
  }

  const mqtt = connectMqttTopics(topics, (_topic, data) => {
    const payload = data as { type?: string; state?: PokerTableState };
    if (payload?.type === 'table_state' && payload.state) {
      handleIncoming(payload.state);
    }
  });

  return () => {
    bcs.forEach((bc) => bc.close());
    mqtt.close();
  };
}

/**
 * Web Notification & Service Worker Push helpers for Async ("⏳ Por Turnos") rooms.
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestTurnNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function notifyPlayerTurn(
  roomName: string,
  roomCode: string,
  state: PokerTableState
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const pot = getTotalPot(state);
  const title = '¡Es tu turno en Juegos de Cartas!';
  const body = `${roomName} (#${roomCode}) · Pozo: ${pot} · Te toca actuar.`;
  const tag = `cartas-turn-${roomCode}`;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.active) {
        reg.active.postMessage({
          type: 'SHOW_TURN_NOTIFICATION',
          title,
          body,
          tag,
          roomCode,
        });
        return;
      }
    }
    new Notification(title, {
      body,
      icon: '/favicon.svg',
      tag,
    });
  } catch {
    // Fallback ignored if blocked by browser
  }
}
