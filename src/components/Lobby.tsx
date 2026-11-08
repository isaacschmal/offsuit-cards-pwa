import { Bell, Clock, Home, Plus, User, X, Zap } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  createNewOpenRoom,
  getNotificationPermission,
  loadOpenRooms,
  type OpenRoomInfo,
  type RoomPacingMode,
  type RoomPlayersMode,
  requestTurnNotificationPermission,
  subscribeToOpenRoomsDirectory,
} from '../lib/multiplayer';
import {
  loadKnownPlayers,
  loadUserProfile,
  updateUserProfile,
  type UserProfilePreferences,
} from '../lib/profile';
import { AVATAR_OPTIONS, ProfileView } from './ProfileView';
import { Avatar3D } from './poker/Avatar3D';

interface LobbyProps {
  activeRoomCode: string;
  activePacingMode: RoomPacingMode;
  onlineCount: number;
  onStartInstantTable: () => void;
  onJoinOrCreateRoom: (
    roomCode: string,
    pacingMode?: RoomPacingMode,
    roomName?: string,
    roomMode?: RoomPlayersMode
  ) => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  activeRoomCode,
  activePacingMode,
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
  const [selectedRoomMode, setSelectedRoomMode] =
    useState<RoomPlayersMode>('real');
  const [newRoomName, setNewRoomName] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [notifPerm, setNotifPerm] = useState<
    NotificationPermission | 'unsupported'
  >(() => getNotificationPermission());

  // Welcome First-Time Name & Avatar Modal state
  const [welcomeName, setWelcomeName] = useState(() =>
    profile.hasSetCustomName ? profile.name : ''
  );
  const [welcomeAvatar, setWelcomeAvatar] = useState(() => profile.avatarId);

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
    openRooms.find((r) => r.code === activeRoomCode) ?? openRooms[0] ?? null;

  const liveRealRoomsCount = openRooms.filter(
    (r) => r.roomMode === 'real' && r.pacingMode === 'live'
  ).length;

  const handleCompleteWelcome = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = welcomeName.trim() || 'Jugador';
    const next = updateUserProfile((prev) => ({
      ...prev,
      name: cleanName,
      avatarId: welcomeAvatar,
      hasSetCustomName: true,
    }));
    setProfile(next);
  };

  const handleCreateRoom = () => {
    const label =
      newRoomName.trim() ||
      (selectedRoomMode === 'bots'
        ? 'Práctica con Bots'
        : selectedPacing === 'async'
        ? `Mesa de ${profile.name || 'Amigos'} (Turnos)`
        : `Mesa de ${profile.name || 'Amigos'}`);
    const created = createNewOpenRoom(
      label,
      selectedPacing,
      undefined,
      selectedRoomMode
    );
    setOpenRooms(loadOpenRooms());
    setNewRoomName('');
    setIsRoomsModalOpen(false);
    if (selectedPacing === 'async' && notifPerm === 'default') {
      void requestTurnNotificationPermission().then(setNotifPerm);
    }
    onJoinOrCreateRoom(
      created.code,
      created.pacingMode,
      created.name,
      created.roomMode
    );
  };

  // Level ring SVG math (radius 15, circumference ~94.25)
  const levelRadius = 15;
  const levelCircumference = 2 * Math.PI * levelRadius;
  const levelFraction =
    profile.xp === 0
      ? 0.08
      : Math.min(0.95, Math.max(0.15, (profile.xp % 250) / 250));
  const strokeDashoffset = levelCircumference * (1 - levelFraction);

  // Build dynamic Weekly Leaderboard from local player + real encountered players / friends
  const leaderboardEntries = useMemo(() => {
    const known = loadKnownPlayers();
    const map = new Map<
      string,
      { id: string; name: string; avatarId: string; xp: number; isHero: boolean }
    >();

    // Local player is always present
    map.set(profile.playerId, {
      id: profile.playerId,
      name: profile.name || 'Jugador',
      avatarId: profile.avatarId,
      xp: profile.xp,
      isHero: true,
    });

    for (const kp of known) {
      if (!kp.id || kp.id === profile.playerId) continue;
      map.set(kp.id, {
        id: kp.id,
        name: kp.name,
        avatarId: kp.avatarId,
        xp: kp.xp ?? 0,
        isHero: false,
      });
    }

    for (const fr of profile.friends) {
      if (!map.has(fr.id)) {
        map.set(fr.id, {
          id: fr.id,
          name: fr.name,
          avatarId: fr.avatarId,
          xp: 0,
          isHero: false,
        });
      }
    }

    const sorted = Array.from(map.values()).sort((a, b) => b.xp - a.xp);
    const medals = ['🥇', '🥈', '🥉'];
    const badges = ['🦐', '🦀', '🐬', '🦈', '🐋'];

    return sorted.map((item, idx) => ({
      rank: idx + 1,
      medal: idx < 3 ? medals[idx] : null,
      badgeEmoji: badges[Math.min(badges.length - 1, Math.floor(item.xp / 500))],
      avatarId: item.avatarId,
      name: item.name,
      xpLabel: `${item.xp.toLocaleString('en-US')} XP`,
      isHero: item.isHero,
    }));
  }, [profile]);

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden w-full bg-black text-white flex justify-center select-none">
      <div
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px) + 10px, 14px)',
        }}
        className="w-full sm:max-w-[480px] h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col justify-between px-4 relative"
      >
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-2">
          {activeTab === 'home' ? (
            <div className="flex flex-col">
              {/* TOP BAR: Subtle Title + Player Name on Left + Orange Circular Level Progress Ring on Right */}
              <div className="flex items-center justify-between h-10 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[13.5px] font-medium text-[#9ca3af] tracking-tight">
                    Juegos de Cartas
                  </span>
                  {profile.hasSetCustomName && (
                    <span className="text-[12px] text-[#6b6d76]">
                      · {profile.name}
                    </span>
                  )}
                </div>

                {/* Orange Circular Level Progress Ring with Level Number inside */}
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  aria-label={`Nivel ${profile.level}`}
                  className="relative w-9 h-9 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                >
                  <svg className="w-9 h-9 -rotate-90" viewBox="0 0 38 38">
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
                  <span className="absolute text-[13px] font-semibold text-[#fb923c] leading-none">
                    {profile.level}
                  </span>
                </button>
              </div>

              {/* HERO COUNTER: Giant Ultra-Light XP Balance */}
              <div className="my-3.5 flex flex-col items-center justify-center shrink-0">
                <span className="font-extralight text-[62px] tracking-tight leading-none text-white">
                  {profile.xp}
                </span>
              </div>

              {/* HORIZONTAL PASTEL GRADIENT CARDS CAROUSEL (Strictly separated Real vs Bots) */}
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1.5 snap-x snap-mandatory shrink-0">
                {/* Card 1: Mesas en Vivo (Solo Reales · Sin Bots) */}
                <button
                  type="button"
                  onClick={() => {
                    const liveRealRoom = openRooms.find(
                      (r) => r.pacingMode === 'live' && r.roomMode === 'real'
                    );
                    if (liveRealRoom) {
                      onJoinOrCreateRoom(
                        liveRealRoom.code,
                        'live',
                        liveRealRoom.name,
                        'real'
                      );
                    } else {
                      setSelectedRoomMode('real');
                      setSelectedPacing('live');
                      setIsRoomsModalOpen(true);
                    }
                  }}
                  style={{
                    background:
                      'linear-gradient(135deg, #dce7ff 0%, #d8f3dc 100%)',
                  }}
                  className="snap-start shrink-0 min-w-[262px] h-[174px] rounded-[26px] p-4 flex flex-col justify-between text-left text-[#0f172a] shadow-lg active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="flex items-start justify-between w-full">
                    <div>
                      <span className="inline-block text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0f172a]/10 text-[#0f172a] mb-1">
                        👥 Solo Reales · En Vivo
                      </span>
                      <h2 className="text-[20px] font-semibold tracking-tight text-[#0f172a] leading-tight">
                        Mesas en Vivo
                      </h2>
                      <p className="text-[12.5px] text-[#334155] mt-0.5 leading-snug max-w-[188px]">
                        Juega con amigos reales conectados (sin bots)
                      </p>
                    </div>
                    <span className="text-[24px] leading-none">🌎</span>
                  </div>

                  <div className="flex items-center justify-between w-full pt-1">
                    <span className="text-[11.5px] font-medium text-[#334155]">
                      {liveRealRoomsCount > 0
                        ? `${liveRealRoomsCount} ${
                            liveRealRoomsCount === 1
                              ? 'sala abierta'
                              : 'salas abiertas'
                          }`
                        : 'Crea o únete con código'}
                    </span>

                    <span className="h-7 px-3 rounded-full bg-[#0f172a]/10 text-[#0f172a] text-[11.5px] font-semibold flex items-center">
                      {liveRealRoomsCount > 0 ? 'Jugar →' : 'Abrir →'}
                    </span>
                  </div>
                </button>

                {/* Card 2: Por Turnos (Solo Reales · 24h Async Chess-Style) */}
                <button
                  type="button"
                  onClick={() => {
                    const asyncRoom = openRooms.find(
                      (r) => r.pacingMode === 'async' && r.roomMode === 'real'
                    );
                    if (asyncRoom) {
                      onJoinOrCreateRoom(
                        asyncRoom.code,
                        'async',
                        asyncRoom.name,
                        'real'
                      );
                    } else {
                      setSelectedRoomMode('real');
                      setSelectedPacing('async');
                      setIsRoomsModalOpen(true);
                    }
                  }}
                  style={{
                    background:
                      'linear-gradient(135deg, #e0e7ff 0%, #fce7f3 100%)',
                  }}
                  className="snap-start shrink-0 min-w-[262px] h-[174px] rounded-[26px] p-4 flex flex-col justify-between text-left text-[#0f172a] shadow-lg active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="flex items-start justify-between w-full">
                    <div>
                      <span className="inline-block text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0f172a]/10 text-[#0f172a] mb-1">
                        👥 Solo Reales · 24h
                      </span>
                      <h2 className="text-[20px] font-semibold tracking-tight text-[#0f172a] leading-tight">
                        Por Turnos
                      </h2>
                      <p className="text-[12.5px] text-[#334155] mt-0.5 leading-snug max-w-[188px]">
                        Sin prisa entre amigos, te avisa cuando te toca
                      </p>
                    </div>
                    <span className="text-[24px] leading-none">⏳</span>
                  </div>

                  <div className="flex items-center justify-between w-full pt-1">
                    <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-[#334155]">
                      <span>Estilo ajedrez · Sin bots</span>
                    </div>
                    <span className="h-7 px-3 rounded-full bg-[#0f172a]/10 text-[#0f172a] text-[11.5px] font-semibold flex items-center">
                      Entrar →
                    </span>
                  </div>
                </button>

                {/* Card 3: Práctica vs Bots (Dedicated Solo AI Mode) */}
                <button
                  type="button"
                  onClick={() => {
                    onStartInstantTable();
                  }}
                  style={{
                    background:
                      'linear-gradient(135deg, #fef3c7 0%, #ffedd5 100%)',
                  }}
                  className="snap-start shrink-0 min-w-[262px] h-[174px] rounded-[26px] p-4 flex flex-col justify-between text-left text-[#0f172a] shadow-lg active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="flex items-start justify-between w-full">
                    <div>
                      <span className="inline-block text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0f172a]/10 text-[#0f172a] mb-1">
                        🤖 Modo Bots
                      </span>
                      <h2 className="text-[20px] font-semibold tracking-tight text-[#0f172a] leading-tight">
                        Práctica vs Bots
                      </h2>
                      <p className="text-[12.5px] text-[#334155] mt-0.5 leading-snug max-w-[188px]">
                        Entrena jugadas al instante contra los 5 bots IA
                      </p>
                    </div>
                    <span className="text-[24px] leading-none">🤖</span>
                  </div>

                  <div className="flex items-center justify-between w-full pt-1">
                    <span className="text-[11.5px] font-medium text-[#334155]">
                      5 Bots IA · Turnos rápidos
                    </span>
                    <span className="h-7 px-3 rounded-full bg-[#0f172a]/10 text-[#0f172a] text-[11.5px] font-semibold flex items-center">
                      Practicar →
                    </span>
                  </div>
                </button>
              </div>

              {/* ACTIVE OPEN ROOM QUICK BANNER OR EMPTY STATE */}
              {primaryOpenRoom ? (
                <div className="mt-2.5 bg-[#121316] border border-[#23252a] rounded-[18px] px-3.5 py-2.5 flex items-center justify-between gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsRoomsModalOpen(true)}
                    className="flex flex-col text-left min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12.5px] font-medium text-white truncate">
                        {primaryOpenRoom.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium shrink-0">
                        {primaryOpenRoom.roomMode === 'bots'
                          ? '🤖 Bots'
                          : '👥 Solo Reales'}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#7c7d85] mt-0.5">
                      #{primaryOpenRoom.code} · {primaryOpenRoom.playerCount}/
                      {primaryOpenRoom.maxPlayers} · Ver salas ({openRooms.length})
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsRoomsModalOpen(true)}
                      className="h-7 px-2.5 rounded-full bg-[#23252a] text-white text-[11.5px] font-medium active:scale-95 transition-transform cursor-pointer"
                    >
                      Salas
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onJoinOrCreateRoom(
                          primaryOpenRoom.code,
                          primaryOpenRoom.pacingMode,
                          primaryOpenRoom.name,
                          primaryOpenRoom.roomMode
                        )
                      }
                      className="h-7 px-3 rounded-full bg-white text-black text-[11.5px] font-semibold active:scale-95 transition-transform cursor-pointer"
                    >
                      Unirse
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 bg-[#121316] border border-[#23252a] rounded-[18px] px-3.5 py-2.5 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex flex-col text-left">
                    <span className="text-[12px] font-medium text-white leading-snug">
                      No hay salas abiertas en este momento
                    </span>
                    <span className="text-[10.5px] text-[#7c7d85] mt-0.5">
                      Crea una sala y comparte el código con tus amigos
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsRoomsModalOpen(true)}
                    className="h-7 px-3 rounded-full bg-white text-black text-[11.5px] font-semibold shrink-0 active:scale-95 transition-transform cursor-pointer"
                  >
                    Crear Sala
                  </button>
                </div>
              )}

              {/* WEEKLY LEADERBOARD SECTION (Strictly real players) */}
              <div className="mt-4">
                <div className="flex items-center justify-between px-1 mb-2">
                  <h3 className="text-[16px] font-medium text-white tracking-tight">
                    Weekly leaderboard
                  </h3>
                  <div className="flex items-center gap-1 text-[14px] font-medium text-[#9ca3af]">
                    <span>{leaderboardEntries.length}</span>
                    <span>🏆</span>
                  </div>
                </div>

                <div className="bg-[#121316] border border-[#1d1f26] rounded-[20px] p-2 flex flex-col gap-1">
                  {leaderboardEntries.map((entry) => (
                    <div
                      key={`${entry.rank}-${entry.name}`}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-[14px] ${
                        entry.isHero ? 'bg-white/[0.04]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 flex items-center gap-1 text-[13px] font-medium text-[#9ca3af]">
                          {entry.medal ? (
                            <>
                              <span className="text-[15px] leading-none">
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

                        <div className="relative w-7 h-7 rounded-full bg-[#1c1e24] flex items-center justify-center">
                          <Avatar3D avatarId={entry.avatarId} size={26} />
                          <span className="absolute -bottom-1 -right-1 text-[10px] leading-none">
                            {entry.badgeEmoji}
                          </span>
                        </div>

                        <span className="text-[14px] font-medium text-white">
                          {entry.name}
                        </span>
                      </div>

                      <span className="text-[13px] font-normal text-[#8e9099]">
                        {entry.xpLabel}
                      </span>
                    </div>
                  ))}

                  {leaderboardEntries.length === 1 && (
                    <div className="px-2 py-1.5 text-[10.5px] text-[#7c7d85] text-center border-t border-[#1d1f26] mt-0.5">
                      Solo tú estás registrado por ahora · Invita amigos a una sala para competir en el ranking
                    </div>
                  )}
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
        </div>

        {/* CLEAN 2-TAB BOTTOM NAVIGATION BAR (Home & Profile ONLY) */}
        <nav
          aria-label="Navegación principal"
          className="w-full h-[56px] shrink-0 bg-black/95 backdrop-blur-md border-t border-[#16181d] px-10 flex items-center justify-around z-40"
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
            <Home className="w-5 h-5 stroke-[2]" />
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
            <User className="w-5 h-5 stroke-[2]" />
          </button>
        </nav>

        {/* FIRST-TIME WELCOME MODAL: "¿Cómo te llamas?" + Avatar Picker */}
        {!profile.hasSetCustomName && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-5">
            <form
              onSubmit={handleCompleteWelcome}
              className="w-full max-w-[380px] bg-[#16171b] border border-[#282a33] rounded-[28px] p-6 flex flex-col gap-5 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center gap-1">
                <div className="w-16 h-16 rounded-full bg-[#1e2028] border border-[#2e313d] flex items-center justify-center mb-1">
                  <Avatar3D avatarId={welcomeAvatar} size={56} />
                </div>
                <h2 className="text-[20px] font-semibold text-white tracking-tight">
                  ¿Cómo te llamas?
                </h2>
                <p className="text-[12.5px] text-[#8e9099]">
                  Elige tu nombre y avatar para sentarte en las mesas con tus amigos
                </p>
              </div>

              <input
                type="text"
                value={welcomeName}
                onChange={(e) => setWelcomeName(e.target.value)}
                placeholder="Tu nombre (ej. Isaac, Leo, Carlos...)"
                maxLength={18}
                autoFocus
                required
                className="h-12 px-4 rounded-[16px] bg-black border border-[#2e313b] text-white text-[15px] placeholder:text-[#6b6d76] focus:outline-none focus:border-white text-center font-medium"
              />

              <div className="flex flex-col gap-2">
                <span className="text-[11.5px] text-[#9ca3af] font-medium text-center">
                  Elige tu Avatar 3D
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {AVATAR_OPTIONS.map((av) => {
                    const isSelected = welcomeAvatar === av.id;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => setWelcomeAvatar(av.id)}
                        className={`p-2 rounded-[16px] border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-white/15 border-white'
                            : 'bg-black/40 border-[#25272e] hover:border-white/30'
                        }`}
                      >
                        <Avatar3D avatarId={av.id} size={42} />
                        <span className="text-[11px] font-medium text-white">
                          {av.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 rounded-full bg-white text-black text-[14px] font-semibold cursor-pointer active:scale-95 transition-transform"
              >
                Continuar
              </button>
            </form>
          </div>
        )}

        {/* MODAL / DRAWER FOR CREAR / SALAS ABIERTAS */}
        {isRoomsModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
            <div className="w-full max-w-[400px] bg-[#16171a] border border-[#262830] rounded-[28px] p-5 flex flex-col gap-4 max-h-[85dvh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[17px] font-semibold text-white">
                    Salas Abiertas &amp; Crear Mesa
                  </h3>
                  <p className="text-[12px] text-[#7c7d85]">
                    Mesas reales con amigos o práctica con bots
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
              {openRooms.length === 0 ? (
                <div className="rounded-[18px] px-4 py-4 bg-black/40 border border-[#23252a] text-center text-[12px] text-[#8e9099]">
                  No hay salas abiertas en este momento · Crea una sala abajo y comparte el código con tus amigos.
                </div>
              ) : (
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
                          room.name,
                          room.roomMode
                        );
                      }}
                      className="w-full rounded-[18px] px-3.5 py-3 bg-black/50 border border-[#23252a] hover:border-white/30 flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[14px] font-medium text-white">
                            {room.name}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              room.roomMode === 'bots'
                                ? 'bg-indigo-500/15 text-indigo-300'
                                : 'bg-emerald-500/15 text-emerald-400'
                            }`}
                          >
                            {room.roomMode === 'bots'
                              ? '🤖 Bots'
                              : '👥 Solo Reales'}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              room.pacingMode === 'async'
                                ? 'bg-[#eab308]/15 text-[#eab308]'
                                : 'bg-white/10 text-white/80'
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

                      <span className="h-7 px-3 rounded-full bg-white text-black text-[12px] font-semibold flex items-center shrink-0">
                        Unirse
                      </span>
                    </button>
                  ))}
                </div>
              )}

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

                {/* Selector 1: Solo Amigos Reales vs Con Bots */}
                <div className="grid grid-cols-2 gap-2 bg-black p-1 rounded-full border border-[#23252a]">
                  <button
                    type="button"
                    onClick={() => setSelectedRoomMode('real')}
                    className={`h-8 rounded-full text-[12px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
                      selectedRoomMode === 'real'
                        ? 'bg-white text-black'
                        : 'text-[#7c7d85]'
                    }`}
                  >
                    <span>👥 Solo Amigos Reales</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRoomMode('bots')}
                    className={`h-8 rounded-full text-[12px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
                      selectedRoomMode === 'bots'
                        ? 'bg-white text-black'
                        : 'text-[#7c7d85]'
                    }`}
                  >
                    <span>🤖 Con Bots</span>
                  </button>
                </div>

                {/* Selector 2: En Vivo vs Por Turnos */}
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
                    placeholder="Nombre (ej. Mesa de Amigos)"
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
                        `Sala #${code}`,
                        selectedRoomMode
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
                    placeholder="O únete con código (ej. MESA1)"
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
