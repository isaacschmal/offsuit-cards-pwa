import {
  createInitialTableState,
  getTotalPot,
  type PokerTableState,
} from '../engine/poker/gameState';
import { supabase } from './supabase';

export type RoomPacingMode = 'live' | 'async';

export interface OpenRoomInfo {
  code: string;
  name: string;
  pacingMode: RoomPacingMode;
  playerCount: number;
  maxPlayers: number;
  blindsLabel: string;
  turnTimerSeconds: number | null; // e.g. 20 for live, null for async chess-style
  currentTurnPlayerName: string;
  updatedAt: number;
}

const ROOMS_STORAGE_KEY = 'offsuit_open_rooms_directory_v1';
const ROOM_STATE_PREFIX = 'offsuit_room_state_v1_';

export const DEFAULT_OPEN_ROOMS: OpenRoomInfo[] = [
  {
    code: 'PRIMOS',
    name: 'Mesa de los Primos',
    pacingMode: 'async',
    playerCount: 4,
    maxPlayers: 6,
    blindsLabel: '1/2',
    turnTimerSeconds: null,
    currentTurnPlayerName: 'Tú',
    updatedAt: Date.now() - 120_000,
  },
  {
    code: 'TORNEO',
    name: 'Torneo Semanal',
    pacingMode: 'live',
    playerCount: 5,
    maxPlayers: 6,
    blindsLabel: '1/2',
    turnTimerSeconds: 20,
    currentTurnPlayerName: 'En vivo',
    updatedAt: Date.now() - 45_000,
  },
  {
    code: 'NOCHE',
    name: 'Nocturna Relax',
    pacingMode: 'async',
    playerCount: 3,
    maxPlayers: 6,
    blindsLabel: '2/4',
    turnTimerSeconds: null,
    currentTurnPlayerName: 'Por turnos',
    updatedAt: Date.now() - 600_000,
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
    return parsed;
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
  customCode?: string
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
    playerCount: 1,
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

export function getOrInitRoomState(roomCode: string): PokerTableState {
  const normalized = roomCode.trim().toUpperCase();
  const saved = loadPersistedRoomState(normalized);
  if (saved && Array.isArray(saved.players) && saved.players.length === 6) {
    return saved;
  }
  const fresh = createInitialTableState(normalized);
  savePersistedRoomState(normalized, fresh);
  return fresh;
}

function broadcastDirectoryUpdate(rooms: OpenRoomInfo[]): void {
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel('offsuit-rooms-directory');
      bc.postMessage({ type: 'directory_sync', rooms });
      bc.close();
    } catch {
      // ignore
    }
  }
  if (supabase) {
    const channel = supabase.channel('offsuit-lobby-directory');
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
      ? new BroadcastChannel('offsuit-rooms-directory')
      : null;

  if (bc) {
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'directory_sync' && Array.isArray(ev.data.rooms)) {
        saveOpenRooms(ev.data.rooms);
        onRoomsUpdated(ev.data.rooms);
      }
    };
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
  const title = '¡Es tu turno en la mesa!';
  const body = `${roomName} (#${roomCode}) · Pozo: ${pot} · Te toca actuar.`;
  const tag = `offsuit-turn-${roomCode}`;

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
