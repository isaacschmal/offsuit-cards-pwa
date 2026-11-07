import { Bell, Clock, Copy, Play, Plus, Sparkles, Users, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { GameMode } from '../engine/types';
import {
  createNewOpenRoom,
  getNotificationPermission,
  loadOpenRooms,
  type OpenRoomInfo,
  type RoomPacingMode,
  requestTurnNotificationPermission,
  subscribeToOpenRoomsDirectory,
} from '../lib/multiplayer';
import { isSupabaseConfigured } from '../lib/supabase';
import { Avatar3D } from './poker/Avatar3D';
import { OffsuitCardBack } from './poker/PlayingCard';

interface LobbyProps {
  activeRoomCode: string;
  activePacingMode: RoomPacingMode;
  onlineCount: number;
  onStartInstantTable: () => void;
  onJoinOrCreateRoom: (roomCode: string, pacingMode?: RoomPacingMode, roomName?: string) => void;
}

interface GameModeOption {
  id: GameMode;
  title: string;
  subtitle: string;
  available: boolean;
}

const GAME_MODES: GameModeOption[] = [
  {
    id: 'texas-holdem',
    title: "Texas Hold'em",
    subtitle: '6-Max · No-Limit · Instant Bots & Friends',
    available: true,
  },
  {
    id: 'blackjack',
    title: 'Blackjack 21',
    subtitle: 'Próximamente · Mismo motor de cartas',
    available: false,
  },
  {
    id: 'truco',
    title: 'Truco',
    subtitle: 'Próximamente · Baraja modular',
    available: false,
  },
  {
    id: 'uno',
    title: 'Uno & Shedding',
    subtitle: 'Próximamente · Multijugador en tiempo real',
    available: false,
  },
];

export const Lobby: React.FC<LobbyProps> = ({
  activeRoomCode,
  activePacingMode,
  onlineCount,
  onStartInstantTable,
  onJoinOrCreateRoom,
}) => {
  const [openRooms, setOpenRooms] = useState<OpenRoomInfo[]>(() => loadOpenRooms());
  const [selectedPacing, setSelectedPacing] = useState<RoomPacingMode>(activePacingMode);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermission()
  );

  useEffect(() => {
    setOpenRooms(loadOpenRooms());
    return subscribeToOpenRoomsDirectory((updated) => {
      setOpenRooms(updated);
    });
  }, []);

  const handleCreateRoom = () => {
    const label =
      newRoomName.trim() ||
      (selectedPacing === 'async' ? 'Mesa por Turnos' : 'Mesa En Vivo');
    const created = createNewOpenRoom(label, selectedPacing);
    setOpenRooms(loadOpenRooms());
    setNewRoomName('');
    if (selectedPacing === 'async' && notifPerm === 'default') {
      void requestTurnNotificationPermission().then(setNotifPerm);
    }
    onJoinOrCreateRoom(created.code, created.pacingMode, created.name);
  };

  const handleEnableNotifications = async () => {
    const res = await requestTurnNotificationPermission();
    setNotifPerm(res);
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(activeRoomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-black text-white flex justify-center select-none">
      <div className="w-full max-w-[420px] min-h-[100dvh] flex flex-col justify-between px-5 py-6">
        {/* Top Brand + Player Profile Pill */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-12">
              <OffsuitCardBack className="w-full h-full rounded-[10px]" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-white leading-none">
                Offsuit
              </h1>
              <p className="text-[12px] text-[#7c7d85] mt-1">
                {isSupabaseConfigured ? 'Supabase Realtime Ready' : 'Salas En Vivo & Por Turnos'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-[#16171a] border border-[#23252a] rounded-full pl-2 pr-3.5 py-1.5">
            <Avatar3D avatarId="hero" size={28} />
            <span className="text-[13px] font-medium text-white">200</span>
          </div>
        </div>

        {/* Main Content Stack */}
        <div className="my-5 flex flex-col gap-4">
          {/* Active Table Resume Card */}
          <div className="bg-[#16171a] border border-[#23252a] rounded-[24px] p-4.5 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#7c7d85] font-medium uppercase tracking-wider">
                    Mesa Actual
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      activePacingMode === 'async'
                        ? 'bg-[#eab308]/15 text-[#eab308]'
                        : 'bg-emerald-500/15 text-emerald-400'
                    }`}
                  >
                    {activePacingMode === 'async' ? '⏳ Por Turnos' : '⚡ En Vivo'}
                  </span>
                </div>
                <h2 className="text-[19px] font-medium text-white mt-0.5">
                  Texas Hold&apos;em
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 bg-black/60 border border-[#23252a] rounded-full px-3 py-1.5 text-[12px] text-[#eab308] font-medium cursor-pointer"
              >
                <span>#{activeRoomCode}</span>
                <Copy className="w-3.5 h-3.5 text-[#7c7d85]" />
                {copied && <span className="text-white text-[11px]">Copied</span>}
              </button>
            </div>

            {/* Avatars preview row */}
            <div className="flex items-center justify-between bg-black/40 rounded-[18px] px-3.5 py-2">
              <div className="flex -space-x-2">
                {['hero', 'emma', 'leo', 'akash', 'tori', 'evelyn'].map((av) => (
                  <div
                    key={av}
                    className="w-7 h-7 rounded-full bg-[#16171a] ring-2 ring-black flex items-center justify-center overflow-hidden"
                  >
                    <Avatar3D avatarId={av} size={26} />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-[#7c7d85]">
                <Users className="w-3.5 h-3.5" />
                <span>{onlineCount} online · 6-Max</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onStartInstantTable}
              className="w-full h-[48px] rounded-full bg-white text-black font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.99] transition-transform cursor-pointer"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>Entrar a la Mesa</span>
            </button>
          </div>

          {/* OPEN ROOMS DIRECTORY: 1-Tap Join without code/link */}
          <div className="bg-[#16171a] border border-[#23252a] rounded-[24px] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[13px] text-white font-medium">
                  Salas Abiertas (1-Tap)
                </span>
                <p className="text-[11px] text-[#7c7d85]">
                  Entra directo con tus primos o amigos sin escribir código
                </p>
              </div>
              {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  className="flex items-center gap-1 bg-[#23252a] hover:bg-[#2c2e35] text-[#eab308] text-[11px] font-medium px-2.5 py-1.5 rounded-full cursor-pointer"
                >
                  <Bell className="w-3 h-3" />
                  <span>Avisar turno</span>
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {openRooms.slice(0, 4).map((room) => {
                const isCurrent = room.code === activeRoomCode;
                return (
                  <button
                    key={room.code}
                    type="button"
                    onClick={() =>
                      onJoinOrCreateRoom(room.code, room.pacingMode, room.name)
                    }
                    className={`w-full rounded-[16px] px-3.5 py-2.5 flex items-center justify-between border text-left transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-black/80 border-white/30'
                        : 'bg-black/40 border-[#23252a] hover:border-white/20'
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-white">
                          {room.name}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            room.pacingMode === 'async'
                              ? 'bg-[#eab308]/15 text-[#eab308]'
                              : 'bg-emerald-500/15 text-emerald-400'
                          }`}
                        >
                          {room.pacingMode === 'async' ? '⏳ Por Turnos' : '⚡ En Vivo'}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#7c7d85] mt-0.5">
                        #{room.code} · Ciegas {room.blindsLabel} · Turno:{' '}
                        <span className="text-white/80">{room.currentTurnPlayerName}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-[#7c7d85]">
                        {room.playerCount}/{room.maxPlayers}
                      </span>
                      <span className="h-7 px-3 rounded-full bg-white text-black text-[12px] font-semibold flex items-center">
                        Entrar
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CREATE ROOM (WITH PACING MODE) OR JOIN BY CODE */}
          <div className="bg-[#16171a] border border-[#23252a] rounded-[24px] p-4 flex flex-col gap-3">
            <span className="text-[13px] text-white font-medium">
              Crear Sala o Unirse con Código
            </span>

            {/* Pacing Mode Toggle: ⚡ En Vivo vs ⏳ Por Turnos */}
            <div className="grid grid-cols-2 gap-2 bg-black p-1 rounded-full border border-[#23252a]">
              <button
                type="button"
                onClick={() => setSelectedPacing('live')}
                className={`h-9 rounded-full text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  selectedPacing === 'live'
                    ? 'bg-white text-black'
                    : 'text-[#7c7d85] hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>⚡ En Vivo (15-20s)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPacing('async')}
                className={`h-9 rounded-full text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  selectedPacing === 'async'
                    ? 'bg-white text-black'
                    : 'text-[#7c7d85] hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>⏳ Por Turnos</span>
              </button>
            </div>

            <p className="text-[11px] text-[#7c7d85] px-1">
              {selectedPacing === 'live'
                ? '⚡ Ideal cuando están todos conectados al mismo tiempo.'
                : '⏳ Estilo ajedrez: cada quien juega cuando puede y recibe notificación en su turno.'}
            </p>

            {/* Create named room row */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Nombre (ej. Mesa de los Primos)"
                maxLength={28}
                className="flex-1 h-[42px] rounded-full bg-black border border-[#23252a] px-4 text-[13px] text-white placeholder:text-[#7c7d85] focus:outline-none focus:border-white/40"
              />
              <button
                type="button"
                onClick={handleCreateRoom}
                className="h-[42px] px-4 rounded-full bg-white text-black text-[13px] font-semibold flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Crear</span>
              </button>
            </div>

            {/* Direct short code form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (joinInput.trim()) {
                  onJoinOrCreateRoom(
                    joinInput.trim().toUpperCase(),
                    selectedPacing,
                    `Sala #${joinInput.trim().toUpperCase()}`
                  );
                  setJoinInput('');
                }
              }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                type="text"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                placeholder="O ingresa código corto (ej. PRIMOS)"
                maxLength={8}
                className="flex-1 h-[40px] rounded-full bg-black border border-[#23252a] px-4 text-[13px] text-white placeholder:text-[#7c7d85] focus:outline-none focus:border-white/40"
              />
              <button
                type="submit"
                className="h-[40px] px-4 rounded-full bg-[#23252a] text-white text-[13px] font-medium active:scale-95 cursor-pointer"
              >
                Unirse
              </button>
            </form>
          </div>

          {/* Multi-Game Engine Selector */}
          <div className="flex flex-col gap-2.5 mt-1">
            <div className="flex items-center gap-1.5 px-1">
              <Sparkles className="w-3.5 h-3.5 text-[#eab308]" />
              <span className="text-[12px] font-medium text-[#7c7d85] uppercase tracking-wider">
                Juegos del Motor
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {GAME_MODES.map((gm) => (
                <button
                  key={gm.id}
                  type="button"
                  disabled={!gm.available}
                  onClick={() => gm.available && onStartInstantTable()}
                  className={`rounded-[20px] p-3.5 text-left border transition-all ${
                    gm.available
                      ? 'bg-[#16171a] border-white/25 text-white cursor-pointer'
                      : 'bg-[#0d0e10] border-[#1a1b1f] text-[#7c7d85] opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-medium">{gm.title}</span>
                    {gm.available && (
                      <span className="w-2 h-2 rounded-full bg-[#eab308]" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#7c7d85] mt-1 leading-snug">
                    {gm.subtitle}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="text-center text-[11px] text-[#7c7d85]">
          Offsuit Cards PWA · Fullscreen Dark Mode
        </div>
      </div>
    </div>
  );
};
