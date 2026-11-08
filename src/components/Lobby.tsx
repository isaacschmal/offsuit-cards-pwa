import { Bell, Clock, Home, Plus, User, X, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  createNewOpenRoom,
  getNotificationPermission,
  loadOpenRooms,
  type OpenRoomInfo,
  type RoomPacingMode,
  requestTurnNotificationPermission,
  subscribeToOpenRoomsDirectory,
} from '../lib/multiplayer';
import {
  loadUserProfile,
  type UserProfilePreferences,
} from '../lib/profile';
import { ProfileView } from './ProfileView';
import { Avatar3D } from './poker/Avatar3D';

interface LobbyProps {
  activeRoomCode: string;
  activePacingMode: RoomPacingMode;
  onlineCount: number;
  onStartInstantTable: () => void;
  onJoinOrCreateRoom: (
    roomCode: string,
    pacingMode?: RoomPacingMode,
    roomName?: string
  ) => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  activeRoomCode,
  activePacingMode,
  onlineCount,
  onStartInstantTable,
  onJoinOrCreateRoom,
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'profile'>('home');
  const [profile, setProfile] = useState<UserProfilePreferences>(() =>
    loadUserProfile()
  );
  const [openRooms, setOpenRooms] = useState<OpenRoomInfo[]>(() =>
    loadOpenRooms()
  );
  const [isRoomsModalOpen, setIsRoomsModalOpen] = useState(false);
  const [selectedPacing, setSelectedPacing] =
    useState<RoomPacingMode>(activePacingMode);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [notifPerm, setNotifPerm] = useState<
    NotificationPermission | 'unsupported'
  >(() => getNotificationPermission());

  useEffect(() => {
    setOpenRooms(loadOpenRooms());
    return subscribeToOpenRoomsDirectory((updated) => {
      setOpenRooms(updated);
    });
  }, []);

  useEffect(() => {
    const syncProfile = () => setProfile(loadUserProfile());
    window.addEventListener('cartas-profile-updated', syncProfile);
    return () =>
      window.removeEventListener('cartas-profile-updated', syncProfile);
  }, []);

  const primaryOpenRoom =
    openRooms.find((r) => r.code === 'PRIMOS') ??
    openRooms.find((r) => r.code === activeRoomCode) ??
    openRooms[0];

  const handleCreateRoom = () => {
    const label =
      newRoomName.trim() ||
      (selectedPacing === 'async' ? 'Mesa por Turnos' : 'Mesa en Vivo');
    const created = createNewOpenRoom(label, selectedPacing);
    setOpenRooms(loadOpenRooms());
    setNewRoomName('');
    setIsRoomsModalOpen(false);
    if (selectedPacing === 'async' && notifPerm === 'default') {
      void requestTurnNotificationPermission().then(setNotifPerm);
    }
    onJoinOrCreateRoom(created.code, created.pacingMode, created.name);
  };

  // Level ring SVG math (radius 15, circumference ~94.25)
  const levelRadius = 15;
  const levelCircumference = 2 * Math.PI * levelRadius;
  const levelFraction = Math.min(0.92, Math.max(0.28, (profile.xp % 250) / 250));
  const strokeDashoffset = levelCircumference * (1 - levelFraction);

  const leaderboardEntries = [
    {
      rank: 1,
      medal: '🥇',
      badgeEmoji: '🐌',
      avatarId: profile.avatarId,
      name: profile.name,
      xpLabel: `${(23623 + profile.xp).toLocaleString('en-US')} XP`,
      isHero: true,
    },
    {
      rank: 2,
      medal: '🥈',
      badgeEmoji: '🍪',
      avatarId: 'leo',
      name: 'primo_leo',
      xpLabel: '19,327 XP',
      isHero: false,
    },
    {
      rank: 3,
      medal: '🥉',
      badgeEmoji: '🧑🏻',
      avatarId: 'akash',
      name: 'akash',
      xpLabel: '16,004 XP',
      isHero: false,
    },
    {
      rank: 4,
      medal: null,
      badgeEmoji: '🦊',
      avatarId: 'emma',
      name: 'emma_poker',
      xpLabel: '12,480 XP',
      isHero: false,
    },
    {
      rank: 5,
      medal: null,
      badgeEmoji: '⚡',
      avatarId: 'tori',
      name: 'tori_v',
      xpLabel: '9,850 XP',
      isHero: false,
    },
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-black text-white flex justify-center select-none">
      <div className="w-full max-w-[420px] min-h-[100dvh] flex flex-col justify-between px-5 pt-4 pb-6 relative">
        {activeTab === 'home' ? (
          <div className="flex flex-col pb-24">
            {/* TOP BAR: Subtle Title / Active Room Indicator on Left (NO gem/store icon) + Orange Circular Level Progress Ring on Right */}
            <div className="flex items-center justify-between h-11">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[14px] font-medium text-[#9ca3af] tracking-tight">
                  Juegos de Cartas
                </span>
              </div>

              {/* Orange Circular Level Progress Ring with Level Number inside */}
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                aria-label={`Nivel ${profile.level}`}
                className="relative w-10 h-10 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
              >
                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 38 38">
                  <circle
                    cx="19"
                    cy="19"
                    r={levelRadius}
                    fill="none"
                    stroke="#23252a"
                    strokeWidth="3.2"
                  />
                  <circle
                    cx="19"
                    cy="19"
                    r={levelRadius}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeDasharray={levelCircumference}
                    strokeDashoffset={strokeDashoffset}
                  />
                </svg>
                <span className="absolute text-[14px] font-semibold text-[#fb923c] leading-none">
                  {profile.level}
                </span>
              </button>
            </div>

            {/* HERO COUNTER: Giant Ultra-Light Chip / XP Balance (matching image.png) */}
            <div className="my-9 flex flex-col items-center justify-center">
              <span className="font-extralight text-[76px] tracking-tight leading-none text-white">
                {profile.xp}
              </span>
            </div>

            {/* HORIZONTAL PASTEL GRADIENT CARDS CAROUSEL */}
            <div className="flex gap-3.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-2 snap-x snap-mandatory">
              {/* Card 1: Mesas en Vivo */}
              <button
                type="button"
                onClick={() => {
                  const liveRoom =
                    openRooms.find((r) => r.pacingMode === 'live') ??
                    openRooms[0];
                  if (liveRoom) {
                    onJoinOrCreateRoom(
                      liveRoom.code,
                      'live',
                      liveRoom.name
                    );
                  } else {
                    onStartInstantTable();
                  }
                }}
                style={{
                  background:
                    'linear-gradient(135deg, #dce7ff 0%, #d8f3dc 100%)',
                }}
                className="snap-start shrink-0 min-w-[275px] h-[205px] rounded-[28px] p-5 flex flex-col justify-between text-left text-[#0f172a] shadow-lg active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div className="flex items-start justify-between w-full">
                  <div>
                    <h2 className="text-[22px] font-semibold tracking-tight text-[#0f172a] leading-tight">
                      Mesas en Vivo
                    </h2>
                    <p className="text-[13px] text-[#334155] mt-1 leading-snug max-w-[190px]">
                      Juega rápido con amigos conectados
                    </p>
                  </div>
                  <span className="text-[26px] leading-none">🌎</span>
                </div>

                <div className="flex items-center justify-between w-full pt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {['emma', 'leo', 'akash'].map((av) => (
                        <div
                          key={av}
                          className="w-7 h-7 rounded-full bg-white/80 ring-2 ring-white/70 flex items-center justify-center overflow-hidden"
                        >
                          <Avatar3D avatarId={av} size={25} />
                        </div>
                      ))}
                    </div>
                    <span className="text-[13px] font-medium text-[#334155]">
                      {Math.max(209, onlineCount + 208)}
                    </span>
                  </div>

                  <span className="h-8 px-3.5 rounded-full bg-[#0f172a]/10 text-[#0f172a] text-[12px] font-semibold flex items-center">
                    Jugar →
                  </span>
                </div>
              </button>

              {/* Card 2: Por Turnos (Async Chess-Style) */}
              <button
                type="button"
                onClick={() => {
                  const asyncRoom = openRooms.find(
                    (r) => r.pacingMode === 'async'
                  );
                  if (asyncRoom) {
                    onJoinOrCreateRoom(
                      asyncRoom.code,
                      'async',
                      asyncRoom.name
                    );
                  } else {
                    onJoinOrCreateRoom(
                      'TURNOS',
                      'async',
                      'Ajedrez de Cartas (Por Turnos)'
                    );
                  }
                }}
                style={{
                  background:
                    'linear-gradient(135deg, #e0e7ff 0%, #fce7f3 100%)',
                }}
                className="snap-start shrink-0 min-w-[275px] h-[205px] rounded-[28px] p-5 flex flex-col justify-between text-left text-[#0f172a] shadow-lg active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div className="flex items-start justify-between w-full">
                  <div>
                    <h2 className="text-[22px] font-semibold tracking-tight text-[#0f172a] leading-tight">
                      Por Turnos
                    </h2>
                    <p className="text-[13px] text-[#334155] mt-1 leading-snug max-w-[190px]">
                      Sin prisa, te avisa cuando te toca
                    </p>
                  </div>
                  <span className="text-[26px] leading-none">⏳</span>
                </div>

                <div className="flex items-center justify-between w-full pt-2">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#334155]">
                    <span>Estilo ajedrez · 24h</span>
                  </div>
                  <span className="h-8 px-3.5 rounded-full bg-[#0f172a]/10 text-[#0f172a] text-[12px] font-semibold flex items-center">
                    Entrar →
                  </span>
                </div>
              </button>

              {/* Card 3: Crear / Salas Abiertas */}
              <button
                type="button"
                onClick={() => setIsRoomsModalOpen(true)}
                style={{
                  background:
                    'linear-gradient(135deg, #fef3c7 0%, #ffedd5 100%)',
                }}
                className="snap-start shrink-0 min-w-[275px] h-[205px] rounded-[28px] p-5 flex flex-col justify-between text-left text-[#0f172a] shadow-lg active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div className="flex items-start justify-between w-full">
                  <div>
                    <h2 className="text-[22px] font-semibold tracking-tight text-[#0f172a] leading-tight">
                      Crear / Salas Abiertas
                    </h2>
                    <p className="text-[13px] text-[#334155] mt-1 leading-snug max-w-[195px]">
                      Mesa de los Primos, Torneo Semanal o crea tu sala
                    </p>
                  </div>
                  <span className="text-[26px] leading-none">🃏</span>
                </div>

                <div className="flex items-center justify-between w-full pt-2">
                  <span className="text-[12px] font-medium text-[#334155]">
                    {openRooms.length} salas activas
                  </span>
                  <span className="h-8 px-3.5 rounded-full bg-[#0f172a]/10 text-[#0f172a] text-[12px] font-semibold flex items-center">
                    Abrir →
                  </span>
                </div>
              </button>
            </div>

            {/* ACTIVE OPEN ROOM QUICK BANNER (1-Tap Join) */}
            {primaryOpenRoom && (
              <div className="mt-3.5 bg-[#121316] border border-[#23252a] rounded-[20px] px-4 py-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsRoomsModalOpen(true)}
                  className="flex flex-col text-left min-w-0 cursor-pointer"
                >
                  <span className="text-[13px] font-medium text-white truncate">
                    Sala abierta: {primaryOpenRoom.name} ·{' '}
                    {primaryOpenRoom.playerCount}/{primaryOpenRoom.maxPlayers}{' '}
                    jugadores
                  </span>
                  <span className="text-[11px] text-[#7c7d85] mt-0.5">
                    #{primaryOpenRoom.code} · Ciegas{' '}
                    {primaryOpenRoom.blindsLabel} · Turno:{' '}
                    {primaryOpenRoom.currentTurnPlayerName}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onJoinOrCreateRoom(
                      primaryOpenRoom.code,
                      primaryOpenRoom.pacingMode,
                      primaryOpenRoom.name
                    )
                  }
                  className="h-8 px-3.5 rounded-full bg-white text-black text-[12px] font-semibold shrink-0 active:scale-95 transition-transform cursor-pointer"
                >
                  Unirse
                </button>
              </div>
            )}

            {/* WEEKLY LEADERBOARD SECTION (matching image.png) */}
            <div className="mt-7">
              <div className="flex items-center justify-between px-1 mb-3">
                <h3 className="text-[18px] font-medium text-white tracking-tight">
                  Weekly leaderboard
                </h3>
                <div className="flex items-center gap-1 text-[15px] font-medium text-[#9ca3af]">
                  <span>5</span>
                  <span>🏆</span>
                </div>
              </div>

              <div className="bg-[#121316] border border-[#1d1f26] rounded-[24px] p-2.5 flex flex-col gap-1">
                {leaderboardEntries.map((entry) => (
                  <div
                    key={entry.rank}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-[16px] ${
                      entry.isHero ? 'bg-white/[0.04]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 flex items-center gap-1 text-[14px] font-medium text-[#9ca3af]">
                        {entry.medal ? (
                          <>
                            <span className="text-[16px] leading-none">
                              {entry.medal}
                            </span>
                            <span className="text-white font-semibold">
                              {entry.rank}
                            </span>
                          </>
                        ) : (
                          <span className="pl-5 text-[#7c7d85]">
                            {entry.rank}
                          </span>
                        )}
                      </div>

                      <div className="relative w-8 h-8 rounded-full bg-[#1c1e24] flex items-center justify-center">
                        <Avatar3D avatarId={entry.avatarId} size={28} />
                        <span className="absolute -bottom-1 -right-1 text-[11px] leading-none">
                          {entry.badgeEmoji}
                        </span>
                      </div>

                      <span className="text-[15px] font-medium text-white">
                        {entry.name}
                      </span>
                    </div>

                    <span className="text-[14px] font-normal text-[#8e9099]">
                      {entry.xpLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ProfileView
            profile={profile}
            activeRoomCode={activeRoomCode}
            onProfileChange={setProfile}
            onOpenCreateOrInviteModal={() => setIsRoomsModalOpen(true)}
          />
        )}

        {/* CLEAN 2-TAB BOTTOM NAVIGATION BAR (Home & Profile ONLY — NO store/shopping bag icon) */}
        <nav
          aria-label="Navegación principal"
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] h-[68px] bg-black/95 backdrop-blur-md border-t border-[#16181d] px-12 flex items-center justify-around z-40"
        >
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            aria-label="Inicio"
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-6 cursor-pointer transition-colors ${
              activeTab === 'home'
                ? 'text-white'
                : 'text-[#5e6068] hover:text-[#9ca3af]'
            }`}
          >
            <Home className="w-6 h-6 stroke-[2]" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            aria-label="Perfil y Estadísticas"
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-6 cursor-pointer transition-colors ${
              activeTab === 'profile'
                ? 'text-white'
                : 'text-[#5e6068] hover:text-[#9ca3af]'
            }`}
          >
            <User className="w-6 h-6 stroke-[2]" />
          </button>
        </nav>

        {/* MODAL / DRAWER FOR CREAR / SALAS ABIERTAS (1-Tap Join or Create Room) */}
        {isRoomsModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
            <div className="w-full max-w-[400px] bg-[#16171a] border border-[#262830] rounded-[28px] p-5 flex flex-col gap-4 max-h-[85dvh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[17px] font-semibold text-white">
                    Salas Abiertas &amp; Crear Mesa
                  </h3>
                  <p className="text-[12px] text-[#7c7d85]">
                    Únete con 1 toque sin código o crea una nueva sala
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRoomsModalOpen(false)}
                  aria-label="Cerrar"
                  className="w-8 h-8 rounded-full bg-[#23252a] text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Open rooms list */}
              <div className="flex flex-col gap-2">
                {openRooms.map((room) => (
                  <button
                    key={room.code}
                    type="button"
                    onClick={() => {
                      setIsRoomsModalOpen(false);
                      onJoinOrCreateRoom(
                        room.code,
                        room.pacingMode,
                        room.name
                      );
                    }}
                    className="w-full rounded-[18px] px-3.5 py-3 bg-black/50 border border-[#23252a] hover:border-white/30 flex items-center justify-between text-left cursor-pointer"
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
                          {room.pacingMode === 'async'
                            ? '⏳ Por Turnos'
                            : '⚡ En Vivo'}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#7c7d85] mt-0.5">
                        #{room.code} · {room.playerCount}/{room.maxPlayers}{' '}
                        jugadores · Ciegas {room.blindsLabel}
                      </span>
                    </div>

                    <span className="h-7 px-3 rounded-full bg-white text-black text-[12px] font-semibold flex items-center">
                      Unirse
                    </span>
                  </button>
                ))}
              </div>

              {/* Create new room section */}
              <div className="border-t border-[#23252a] pt-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-white">
                    Crear Nueva Sala
                  </span>
                  {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
                    <button
                      type="button"
                      onClick={() =>
                        void requestTurnNotificationPermission().then(
                          setNotifPerm
                        )
                      }
                      className="flex items-center gap-1 text-[11px] text-[#eab308] cursor-pointer"
                    >
                      <Bell className="w-3 h-3" />
                      <span>Avisar turno</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 bg-black p-1 rounded-full border border-[#23252a]">
                  <button
                    type="button"
                    onClick={() => setSelectedPacing('live')}
                    className={`h-8 rounded-full text-[12px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
                      selectedPacing === 'live'
                        ? 'bg-white text-black'
                        : 'text-[#7c7d85]'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>En Vivo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPacing('async')}
                    className={`h-8 rounded-full text-[12px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
                      selectedPacing === 'async'
                        ? 'bg-white text-black'
                        : 'text-[#7c7d85]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Por Turnos</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Nombre (ej. Mesa de los Primos)"
                    maxLength={28}
                    className="flex-1 h-10 rounded-full bg-black border border-[#23252a] px-4 text-[13px] text-white placeholder:text-[#7c7d85] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    className="h-10 px-4 rounded-full bg-white text-black text-[13px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Crear</span>
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (joinInput.trim()) {
                      const code = joinInput.trim().toUpperCase();
                      setIsRoomsModalOpen(false);
                      onJoinOrCreateRoom(
                        code,
                        selectedPacing,
                        `Sala #${code}`
                      );
                      setJoinInput('');
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                    placeholder="O código corto (ej. PRIMOS)"
                    maxLength={8}
                    className="flex-1 h-9 rounded-full bg-black border border-[#23252a] px-4 text-[12px] text-white placeholder:text-[#7c7d85] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="h-9 px-3.5 rounded-full bg-[#23252a] text-white text-[12px] font-medium cursor-pointer"
                  >
                    Ir
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
