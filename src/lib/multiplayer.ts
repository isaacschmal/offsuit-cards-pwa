import {
  createInitialTableState,
  getTotalPot,
  type PokerTableState,
  type RoomPlayersMode,
} from '../engine/poker/gameState';
import { supabase } from './supabase';

export type RoomPacingMode = 'live' | 'async';
export type { RoomPlayersMode };

export interface OpenRoomInfo {
  code: string;
  name: string;
  pacingMode: RoomPacingMode;
  roomMode: RoomPlayersMode;
  playerCount: number;
  maxPlayers: number;
  blindsLabel: string;
  turnTimerSeconds: number | null; // e.g. 20 for live, null for async chess-style
  currentTurnPlayerName: string;
  updatedAt: number;
}

const ROOMS_STORAGE_KEY = 'cartas_open_rooms_directory_v3';
const ROOM_STATE_PREFIX = 'cartas_room_state_v3_';

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

export const DEFAULT_OPEN_ROOMS: OpenRoomInfo[] = [
  {
    code: 'PRIMOS',
    name: 'Mesa de los Primos',
    pacingMode: 'live',
    roomMode: 'real',
    playerCount: 5,
    maxPlayers: 6,
    blindsLabel: '1/2',
    turnTimerSeconds: 20,
    currentTurnPlayerName: 'Tú',
    updatedAt: Date.now() - 45_000,
  },
  {
    code: 'TURNOS',
    name: 'Ajedrez de Cartas (Por Turnos)',
    pacingMode: 'async',
    roomMode: 'real',
    playerCount: 4,
    maxPlayers: 6,
    blindsLabel: '1/2',
    turnTimerSeconds: null,
    currentTurnPlayerName: 'primo_leo',
    updatedAt: Date.now() - 120_000,
  },
  {
    code: 'BOTS',
    name: 'Práctica vs Bots (IA)',
    pacingMode: 'live',
    roomMode: 'bots',
    playerCount: 6,
    maxPlayers: 6,
    blindsLabel: '1/2',
    turnTimerSeconds: 20,
    currentTurnPlayerName: '5 Bots IA',
    updatedAt: Date.now() - 220_000,
  },
];

export function loadOpenRooms(): OpenRoomInfo[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_OPEN_ROOMS;
  }
  try {
    const raw = window.localStorage.getItem(ROOMS_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(DEFAULT_OPEN_ROOMS));
      return DEFAULT_OPEN_ROOMS;
    }
    const parsed = JSON.parse(raw) as OpenRoomInfo[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_OPEN_ROOMS;
    }
    return parsed.map((r) => ({
      ...r,
      roomMode: r.roomMode ?? (r.code === 'BOTS' ? 'bots' : 'real'),
    }));
  } catch {
    return DEFAULT_OPEN_ROOMS;
  }
}

export function saveOpenRooms(rooms: OpenRoomInfo[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(rooms));
  } catch {
    // ignore storage quota errors
  }
}

export function upsertOpenRoom(room: OpenRoomInfo): OpenRoomInfo[] {
  const existing = loadOpenRooms();
  const normalizedCode = room.code.trim().toUpperCase();
  const idx = existing.findIndex((r) => r.code === normalizedCode);
  let updated: OpenRoomInfo[];

  if (idx >= 0) {
    updated = [...existing];
    updated[idx] = { ...existing[idx], ...room, code: normalizedCode, updatedAt: Date.now() };
  } else {
    updated = [{ ...room, code: normalizedCode, updatedAt: Date.now() }, ...existing];
  }

  saveOpenRooms(updated);
  broadcastDirectoryUpdate(updated);
  return updated;
}

export function createNewOpenRoom(
  name: string,
  pacingMode: RoomPacingMode,
  customCode?: string,
  roomMode: RoomPlayersMode = 'real'
): OpenRoomInfo {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let generated = '';
  for (let i = 0; i < 5; i++) {
    generated += chars[Math.floor(Math.random() * chars.length)];
  }
  const code = (customCode?.trim() || generated).toUpperCase();

  const newRoom: OpenRoomInfo = {
    code,
    name: name.trim() || `Sala #${code}`,
    pacingMode,
    roomMode,
    playerCount: roomMode === 'bots' ? 6 : 1,
    maxPlayers: 6,
    blindsLabel: '1/2',
    turnTimerSeconds: pacingMode === 'live' ? 20 : null,
    currentTurnPlayerName: 'Tú',
    updatedAt: Date.now(),
  };

  upsertOpenRoom(newRoom);
  return newRoom;
}

export function loadPersistedRoomState(roomCode: string): PokerTableState | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const key = `${ROOM_STATE_PREFIX}${roomCode.trim().toUpperCase()}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as PokerTableState;
  } catch {
    return null;
  }
}

export function savePersistedRoomState(roomCode: string, state: PokerTableState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const normalized = roomCode.trim().toUpperCase();
    const key = `${ROOM_STATE_PREFIX}${normalized}`;
    window.localStorage.setItem(key, JSON.stringify(state));

    // Also update the room's currentTurnPlayerName in the directory
    const rooms = loadOpenRooms();
    const found = rooms.find((r) => r.code === normalized);
    if (found) {
      const currentActor = state.players[state.currentTurnIndex];
      const turnLabel =
        state.street === 'showdown'
          ? 'Showdown'
          : currentActor?.id === 'hero'
          ? '¡Tu turno!'
          : currentActor?.name ?? 'En juego';
      upsertOpenRoom({
        ...found,
        currentTurnPlayerName: turnLabel,
      });
    }
  } catch {
    // ignore storage errors
  }
}

export function getOrInitRoomState(
  roomCode: string,
  roomMode: RoomPlayersMode = 'real'
): PokerTableState {
  const normalized = roomCode.trim().toUpperCase();
  const saved = loadPersistedRoomState(normalized);
  if (saved && Array.isArray(saved.players) && saved.players.length === 6) {
    // Ensure saved state's player bot flags match the roomMode
    const shouldBeBot = roomMode === 'bots';
    const syncedPlayers = saved.players.map((p, idx) =>
      idx === 0 ? p : { ...p, isBot: shouldBeBot }
    );
    return {
      ...saved,
      roomMode,
      players: syncedPlayers,
    };
  }
  const fresh = createInitialTableState(normalized, roomMode);
  savePersistedRoomState(normalized, fresh);
  return fresh;
}

function broadcastDirectoryUpdate(rooms: OpenRoomInfo[]): void {
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel('cartas-rooms-directory');
      bc.postMessage({ type: 'directory_sync', rooms });
      bc.close();
    } catch {
      // ignore
    }
  }

  // PartyKit Cloudflare zero-cost WebSocket directory broadcast
  const wsUrl = getPartyKitWebSocketUrl('lobby');
  if (wsUrl && typeof WebSocket !== 'undefined') {
    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'directory_sync', rooms }));
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
          payload: { rooms },
        });
      }
    });
  }
}

export function subscribeToOpenRoomsDirectory(
  onRoomsUpdated: (rooms: OpenRoomInfo[]) => void
): () => void {
  const bc =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('cartas-rooms-directory')
      : null;

  if (bc) {
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'directory_sync' && Array.isArray(ev.data.rooms)) {
        saveOpenRooms(ev.data.rooms);
        onRoomsUpdated(ev.data.rooms);
      }
    };
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
          };
          if (
            data.type === 'directory_sync' &&
            Array.isArray(data.rooms) &&
            data.rooms.length > 0
          ) {
            saveOpenRooms(data.rooms);
            onRoomsUpdated(data.rooms);
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
    lobbyWs?.close();
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
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
