/**
 * Zero-Cost Cloudflare / PartyKit Multiplayer Room & Open Lobby Server
 * Supports:
 * - `lobby` room: Open rooms directory broadcast + HTTP GET /
 * - `<roomCode>` rooms: Real-time table state broadcast ('live' mode) +
 *   Durable Object persistent room state ('async' turn-based chess-style mode).
 */

export interface PartyConnection {
  id: string;
  send: (message: string) => void;
}

export interface PartyStorage {
  get: <T>(key: string) => Promise<T | undefined>;
  put: <T>(key: string, value: T) => Promise<void>;
}

export interface PartyRoom {
  id: string;
  storage: PartyStorage;
  broadcast: (message: string, without?: string[]) => void;
  getConnections: () => Iterable<PartyConnection>;
}

export interface OpenRoomEntry {
  code: string;
  name: string;
  pacingMode: 'live' | 'async';
  playerCount: number;
  maxPlayers: number;
  blindsLabel: string;
  turnTimerSeconds: number | null;
  currentTurnPlayerName: string;
  updatedAt: number;
}

export default class JuegosDeCartasServer {
  readonly room: PartyRoom;

  constructor(room: PartyRoom) {
    this.room = room;
  }

  private getConnectionCount(): number {
    let count = 0;
    for (const _conn of this.room.getConnections()) {
      count += 1;
    }
    return Math.max(1, count);
  }

  async onConnect(conn: PartyConnection): Promise<void> {
    if (this.room.id === 'lobby') {
      const rooms = (await this.room.storage.get<OpenRoomEntry[]>('open_rooms')) ?? [];
      conn.send(JSON.stringify({ type: 'directory_sync', rooms }));
      return;
    }

    // Send persisted table state (for both live & async turn-based rooms)
    const savedState = await this.room.storage.get<unknown>('table_state');
    if (savedState) {
      conn.send(JSON.stringify({ type: 'table_state', state: savedState }));
    }

    // Broadcast updated online player count
    const onlineCount = this.getConnectionCount();
    this.room.broadcast(
      JSON.stringify({
        type: 'presence',
        count: onlineCount,
      })
    );
  }

  async onClose(): Promise<void> {
    if (this.room.id === 'lobby') return;
    const onlineCount = this.getConnectionCount();
    this.room.broadcast(
      JSON.stringify({
        type: 'presence',
        count: onlineCount,
      })
    );
  }

  async onMessage(message: string, sender: PartyConnection): Promise<void> {
    try {
      const data = JSON.parse(message) as {
        type?: string;
        state?: unknown;
        rooms?: OpenRoomEntry[];
        room?: OpenRoomEntry;
      };

      if (this.room.id === 'lobby') {
        if (data.type === 'directory_sync' && Array.isArray(data.rooms)) {
          await this.room.storage.put('open_rooms', data.rooms);
          this.room.broadcast(
            JSON.stringify({ type: 'directory_sync', rooms: data.rooms }),
            [sender.id]
          );
        } else if (data.type === 'upsert_room' && data.room) {
          const existing =
            (await this.room.storage.get<OpenRoomEntry[]>('open_rooms')) ?? [];
          const normalized = data.room.code.trim().toUpperCase();
          const idx = existing.findIndex((r) => r.code === normalized);
          const next =
            idx >= 0
              ? existing.map((item, i) => (i === idx ? data.room! : item))
              : [data.room, ...existing];
          await this.room.storage.put('open_rooms', next);
          this.room.broadcast(JSON.stringify({ type: 'directory_sync', rooms: next }));
        }
        return;
      }

      if (data.type === 'table_state' && data.state) {
        await this.room.storage.put('table_state', data.state);
        this.room.broadcast(
          JSON.stringify({
            type: 'table_state',
            state: data.state,
          }),
          [sender.id]
        );
      }
    } catch {
      // Ignore malformed messages
    }
  }

  async onRequest(req: Request): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (this.room.id === 'lobby') {
      const rooms = (await this.room.storage.get<OpenRoomEntry[]>('open_rooms')) ?? [];
      return new Response(JSON.stringify({ rooms }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const state = (await this.room.storage.get<unknown>('table_state')) ?? null;
    return new Response(
      JSON.stringify({
        roomId: this.room.id,
        onlineCount: this.getConnectionCount(),
        state,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  }
}
