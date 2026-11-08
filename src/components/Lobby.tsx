import {
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  Clock,
  Home,
  Info,
  Plus,
  Smartphone,
  Sparkles,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  createNewOpenRoom,
  deleteOpenRoom,
  getNotificationPermission,
  loadOpenRooms,
  loadPersistedRoomState,
  type OpenRoomInfo,
  type RoomPacingMode,
  type RoomPlayersMode,
  requestTurnNotificationPermission,
  subscribeToOpenRoomsDirectory,
} from '../lib/multiplayer';
import {
  claimBankruptcyBonus,
  linkAccountById,
  loadKnownPlayers,
  loadUserProfile,
  restoreAccountFromSyncToken,
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
    roomMode?: RoomPlayersMode,
    buyIn?: number
  ) => void;
}

import {
  type CardGameCatalogItem,
  getLocalizedCardGames,
  type SupportedLanguage,
  t,
} from '../lib/i18n';

export type CardGameItem = CardGameCatalogItem;

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
  const [selectedBuyIn, setSelectedBuyIn] = useState<number>(200);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [notifPerm, setNotifPerm] = useState<
    NotificationPermission | 'unsupported'
  >(() => getNotificationPermission());

  const [quickCodeInput, setQuickCodeInput] = useState('');
  const [copiedSafariCode, setCopiedSafariCode] = useState(false);
  const [safariBannerDismissed, setSafariBannerDismissed] = useState(false);

  // Card Games Catalog & Voting modal
  const [selectedGameForModal, setSelectedGameForModal] =
    useState<CardGameItem | null>(null);
  const [votedGameIds, setVotedGameIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('offsuit_voted_games');
      return raw ? JSON.parse(raw) : ['uno'];
    } catch {
      return ['uno'];
    }
  });

  const handleToggleVote = (gameId: string) => {
    setVotedGameIds((prev) => {
      const next = prev.includes(gameId)
        ? prev.filter((id) => id !== gameId)
        : [...prev, gameId];
      try {
        localStorage.setItem('offsuit_voted_games', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const currentLang: SupportedLanguage = profile.language ?? 'es';
  const cardGames = useMemo(
    () => getLocalizedCardGames(currentLang),
    [currentLang]
  );

  // Welcome First-Time Name & Avatar & Linking state
  const [welcomeName, setWelcomeName] = useState(() =>
    profile.hasSetCustomName ? profile.name : ''
  );
  const [welcomeAvatar, setWelcomeAvatar] = useState(() => profile.avatarId);
  const [welcomeIsLinking, setWelcomeIsLinking] = useState(false);
  const [welcomeLinkInput, setWelcomeLinkInput] = useState('');
  const [welcomeLinkError, setWelcomeLinkError] = useState<string | null>(null);

  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return true;
    return Boolean(
      ('standalone' in window.navigator && Boolean((window.navigator as any).standalone)) ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  }, []);

  const knownPlayersList = useMemo(() => {
    return loadKnownPlayers().filter((p) => p.id && !p.id.startsWith('bot-'));
  }, []);

  // Compute active seated games for current player
  const activeGames = useMemo(() => {
    const list: Array<{
      room: OpenRoomInfo;
      tableStack: number;
      isMyTurn: boolean;
      currentTurnName: string;
      handNumber: number;
    }> = [];

    for (const r of openRooms) {
      const saved = loadPersistedRoomState(r.code);
      if (!saved || !Array.isArray(saved.players)) continue;
      const heroSeat = saved.players.find(
        (p) => (p.id === profile.playerId || p.id === 'hero') && p.stack > 0 && p.status !== 'out'
      );
      if (heroSeat) {
        const currentActor = saved.players[saved.currentTurnIndex];
        const isMyTurn =
          currentActor?.id === heroSeat.id &&
          saved.street !== 'showdown';
        const currentTurnName = currentActor?.name ?? 'En juego';
        list.push({
          room: r,
          tableStack: heroSeat.stack,
          isMyTurn,
          currentTurnName,
          handNumber: saved.handNumber,
        });
      }
    }
    return list;
  }, [openRooms, profile.playerId]);

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

  const handleDeleteRoom = (code: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = deleteOpenRoom(code);
    setOpenRooms(updated);
  };

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

  const handleWelcomeLinkAccount = (inputOverride?: string) => {
    const raw = (inputOverride ?? welcomeLinkInput).trim();
    if (!raw) return;
    try {
      let token = raw;
      if (raw.includes('sync=')) {
        const parsed = new URL(raw, window.location.origin);
        token = parsed.searchParams.get('sync') || raw;
      }
      const restored = restoreAccountFromSyncToken(token);
      if (restored) {
        setProfile(restored);
        setWelcomeIsLinking(false);
        return;
      }
      const linked = linkAccountById(raw);
      setProfile(linked);
      setWelcomeIsLinking(false);
    } catch {
      setWelcomeLinkError('No se pudo encontrar la cuenta. Verifica el código.');
      setTimeout(() => setWelcomeLinkError(null), 3000);
    }
  };

  const handleQuickCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = quickCodeInput.trim().toUpperCase();
    if (!code) return;
    setQuickCodeInput('');
    onJoinOrCreateRoom(code, 'live', `Sala #${code}`, 'real');
  };

  const handleCreateRoom = () => {
    const label =
      newRoomName.trim() ||
      (selectedRoomMode === 'bots'
        ? 'Práctica con Bots'
        : selectedPacing === 'async'
        ? `Mesa de ${profile.name || 'Amigos'} (Turnos)`
        : `Mesa de ${profile.name || 'Amigos'}`);
    const resolvedBuyIn =
      selectedRoomMode === 'bots'
        ? Math.min(100, Math.max(20, selectedBuyIn))
        : selectedBuyIn;
    const created = createNewOpenRoom(
      label,
      selectedPacing,
      undefined,
      selectedRoomMode,
      resolvedBuyIn
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
      created.roomMode,
      resolvedBuyIn
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



  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden w-full bg-black text-white flex justify-center select-none">
      <div
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px) + 10px, 14px)',
        }}
        className="w-full sm:max-w-[480px] h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col justify-between relative"
      >
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-2">
          {activeTab === 'home' ? (
            <div className="flex flex-col w-full">
              {/* TOP BAR: Subtle Title + Player Name on Left + Orange Circular Level Progress Ring on Right */}
              <div className="flex items-center justify-between h-10 px-5 shrink-0">
                <div className="flex items-center gap-2">
                  <img src="/favicon.svg" alt="Logo" className="w-[18px] h-[18px] rounded-[4px] object-contain shrink-0" />
                  <span className="text-[13.5px] font-medium text-[#d1d5db] tracking-tight">
                    {currentLang === 'en' ? 'Card Games' : currentLang === 'it' ? 'Giochi di Carte' : 'Juegos de Cartas'}
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
                  aria-label={`${t(currentLang, 'level')} ${profile.level}`}
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

              {/* SAFARI PWA HELPER BANNER (Only shown when opened in browser instead of installed PWA) */}
              {!isStandalone && !safariBannerDismissed && (
                <div className="mx-5 mb-2 px-3.5 py-2.5 rounded-[18px] bg-[#161820] border border-[#2b2e3b] flex items-center justify-between gap-2.5 text-left shrink-0 shadow-lg">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4 text-[#fb923c]" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[12px] font-semibold text-white truncate">
                        {t(currentLang, 'safariBannerTitle')}
                      </span>
                      <span className="text-[10.5px] text-[#9ca3af] leading-tight">
                        {t(currentLang, 'safariBannerDesc')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {primaryOpenRoom && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(primaryOpenRoom.code);
                          setCopiedSafariCode(true);
                          setTimeout(() => setCopiedSafariCode(false), 2000);
                        }}
                        className="h-7 px-2.5 rounded-full bg-white text-black text-[10.5px] font-bold active:scale-95 transition-transform cursor-pointer"
                      >
                        {copiedSafariCode ? '¡Copiado!' : `#${primaryOpenRoom.code}`}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSafariBannerDismissed(true)}
                      aria-label="Cerrar aviso"
                      className="w-6 h-6 rounded-full bg-[#242733] text-[#7c7d85] hover:text-white flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* HERO COUNTER: Giant Ultra-Light Bankroll Balance (Saldo Total) */}
              <div className="my-3 px-5 flex flex-col items-start text-left shrink-0">
                <span className="text-[12px] font-medium text-[#9ca3af] tracking-wide uppercase">
                  {t(currentLang, 'totalBalance')}
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="font-extralight text-[64px] tracking-tight leading-none text-white">
                    {profile.bankroll.toLocaleString('en-US')}
                  </span>
                  <span className="text-[17px] font-medium text-[#eab308]">
                    {currentLang === 'en' ? 'chips' : currentLang === 'it' ? 'chip' : 'fichas'}
                  </span>
                </div>
              </div>

              {/* ACTIVE GAMES (Partidas en curso / Por turnos) */}
              {activeGames.length > 0 && (
                <div className="mx-5 mb-3.5 flex flex-col gap-2 shrink-0">
                  <div className="flex items-center justify-between px-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-white tracking-tight">
                        {t(currentLang, 'activeTablesTitle')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        {activeGames.length}
                      </span>
                    </div>
                    <span className="text-[10.5px] text-[#9ca3af]">
                      {currentLang === 'en'
                        ? 'Active hand · Leave or rejoin anytime'
                        : currentLang === 'it'
                        ? 'Mano attiva · Esci o rientra quando vuoi'
                        : 'Mano activa · Sal o vuelve cuando quieras'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {activeGames.map((game) => (
                      <div
                        key={game.room.code}
                        className="w-full bg-[#13151b] border border-[#262936] rounded-[20px] p-3 flex items-center justify-between gap-3 text-left shadow-lg"
                      >
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[13.5px] font-semibold text-white truncate">
                              {game.room.name}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-medium">
                              #{game.room.code}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                game.room.pacingMode === 'async'
                                  ? 'bg-[#eab308]/15 text-[#eab308]'
                                  : 'bg-emerald-500/15 text-emerald-400'
                              }`}
                            >
                              {game.room.pacingMode === 'async'
                                ? currentLang === 'en'
                                  ? '⏳ Turns'
                                  : currentLang === 'it'
                                  ? '⏳ Turni'
                                  : '⏳ Turnos'
                                : currentLang === 'en'
                                ? '⚡ Live'
                                : currentLang === 'it'
                                ? '⚡ Dal Vivo'
                                : '⚡ En Vivo'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            {game.isMyTurn ? (
                              <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#fb923c]">
                                <span className="w-2 h-2 rounded-full bg-[#f97316] animate-pulse" />
                                <span>{t(currentLang, 'yourTurn')}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#9ca3af]">
                                {t(currentLang, 'waitingOnPlayer', { name: game.currentTurnName })}
                              </span>
                            )}
                            <span className="text-[11px] text-[#7c7d85]">
                              · {currentLang === 'en' ? 'Table' : currentLang === 'it' ? 'Tavolo' : 'Mesa'}:{' '}
                              <strong className="text-[#eab308] font-semibold">
                                {game.tableStack}{' '}
                                {currentLang === 'en' ? 'chips' : currentLang === 'it' ? 'chip' : 'fichas'}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            onJoinOrCreateRoom(
                              game.room.code,
                              game.room.pacingMode,
                              game.room.name,
                              game.room.roomMode,
                              game.room.buyIn
                            )
                          }
                          className="h-8 px-3.5 rounded-full bg-white text-black text-[12px] font-bold flex items-center gap-1 shrink-0 active:scale-95 transition-transform cursor-pointer shadow-md"
                        >
                          <span>{t(currentLang, 'rejoinTable')}</span>
                          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* QUICK JOIN BY CODE IN LOBBY HOME */}
              <form
                onSubmit={handleQuickCodeSubmit}
                className="mx-5 mb-3 flex items-center gap-2 bg-[#121316] border border-[#23252a] rounded-full p-1 pl-3.5 shrink-0"
              >
                <span className="text-[12px] text-[#7c7d85] font-mono shrink-0">#</span>
                <input
                  type="text"
                  value={quickCodeInput}
                  onChange={(e) => setQuickCodeInput(e.target.value.toUpperCase())}
                  placeholder={
                    currentLang === 'en'
                      ? 'Enter table code (e.g. TABLE1)...'
                      : currentLang === 'it'
                      ? 'Inserisci codice tavolo (es. TAVOLO1)...'
                      : 'Escribe un código de sala (ej. MESA1)...'
                  }
                  maxLength={8}
                  className="flex-1 bg-transparent text-white text-[12px] placeholder:text-[#5e6068] focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-7 px-3.5 rounded-full bg-white text-black text-[11px] font-bold active:scale-95 transition-transform cursor-pointer shrink-0"
                >
                  {t(currentLang, 'goBtn')}
                </button>
              </form>

              {/* BANKRUPTCY RECOVERY BONUS BANNER (When bankroll is 0) */}
              {profile.bankroll <= 0 && (
                <div className="mx-5 mb-3 p-3 rounded-[20px] bg-red-950/40 border border-red-500/30 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex flex-col text-left">
                    <span className="text-[13px] font-semibold text-red-200">
                      Bancarrota (0 fichas)
                    </span>
                    <span className="text-[11px] text-red-300/80 mt-0.5">
                      Reclama tu bono de recuperación (+200) para volver a las mesas
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = claimBankruptcyBonus();
                      setProfile(next);
                    }}
                    className="h-8 px-3 rounded-full bg-white text-black text-[12px] font-bold shrink-0 active:scale-95 transition-transform cursor-pointer"
                  >
                    +200 fichas
                  </button>
                </div>
              )}

              {/* HORIZONTAL PASTEL GRADIENT CARDS CAROUSEL (Edge-to-Edge Full Bleed, Never Clipped at 16px) */}
              <div
                style={{
                  paddingLeft: '20px',
                  paddingRight: '20px',
                  scrollPaddingLeft: '20px',
                }}
                className="w-full flex gap-3.5 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory shrink-0"
              >
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
                    padding: '24px',
                    background:
                      'linear-gradient(135deg, #dce7ff 0%, #d8f3dc 100%)',
                  }}
                  className="snap-start shrink-0 min-w-[295px] w-[295px] h-[205px] rounded-[28px] flex flex-col justify-between items-start text-left text-[#0f172a] shadow-lg active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="text-[48px] leading-none select-none">
                      🌎
                    </span>
                    <span
                      style={{ padding: '4px 10px' }}
                      className="inline-block text-[11px] font-semibold rounded-full bg-[#0f172a]/10 text-[#0f172a]"
                    >
                      {liveRealRoomsCount > 0
                        ? `${liveRealRoomsCount} · ${
                            currentLang === 'en' ? 'Live' : currentLang === 'it' ? 'Dal Vivo' : 'En Vivo'
                          }`
                        : currentLang === 'en'
                        ? 'Real Friends · Live'
                        : currentLang === 'it'
                        ? 'Amici Reali · Dal Vivo'
                        : 'Solo Reales · En Vivo'}
                    </span>
                  </div>

                  <div className="flex flex-col items-start text-left w-full">
                    <h2 className="text-[24px] font-semibold tracking-tight text-[#0f172a] leading-tight">
                      {currentLang === 'en' ? 'Live Tables' : currentLang === 'it' ? 'Tavoli dal Vivo' : 'Mesas en Vivo'}
                    </h2>
                    <p className="text-[13.5px] text-[#334155] font-normal mt-1 leading-snug">
                      {currentLang === 'en'
                        ? 'Play with real friends connected online (no bots)'
                        : currentLang === 'it'
                        ? 'Gioca con amici reali connessi (senza bot)'
                        : 'Juega con amigos reales conectados (sin bots)'}
                    </p>
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
                    padding: '24px',
                    background:
                      'linear-gradient(135deg, #e0e7ff 0%, #fce7f3 100%)',
                  }}
                  className="snap-start shrink-0 min-w-[295px] w-[295px] h-[205px] rounded-[28px] flex flex-col justify-between items-start text-left text-[#0f172a] shadow-lg active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="text-[48px] leading-none select-none">
                      ⏳
                    </span>
                    <span
                      style={{ padding: '4px 10px' }}
                      className="inline-block text-[11px] font-semibold rounded-full bg-[#0f172a]/10 text-[#0f172a]"
                    >
                      {currentLang === 'en'
                        ? 'Real Friends · 24h'
                        : currentLang === 'it'
                        ? 'Amici Reali · 24h'
                        : 'Solo Reales · 24h'}
                    </span>
                  </div>

                  <div className="flex flex-col items-start text-left w-full">
                    <h2 className="text-[24px] font-semibold tracking-tight text-[#0f172a] leading-tight">
                      {currentLang === 'en' ? 'Turn-Based' : currentLang === 'it' ? 'A Turni' : 'Por Turnos'}
                    </h2>
                    <p className="text-[13.5px] text-[#334155] font-normal mt-1 leading-snug">
                      {currentLang === 'en'
                        ? 'Take your time with friends, get notified on your turn'
                        : currentLang === 'it'
                        ? 'Con calma tra amici, ricevi una notifica al tuo turno'
                        : 'Sin prisa entre amigos, te avisa cuando te toca'}
                    </p>
                  </div>
                </button>

                {/* Card 3: Práctica vs Bots (Dedicated Solo AI Mode) */}
                <button
                  type="button"
                  onClick={() => {
                    onStartInstantTable();
                  }}
                  style={{
                    padding: '24px',
                    background:
                      'linear-gradient(135deg, #fef3c7 0%, #ffedd5 100%)',
                  }}
                  className="snap-start shrink-0 min-w-[295px] w-[295px] h-[205px] rounded-[28px] flex flex-col justify-between items-start text-left text-[#0f172a] shadow-lg active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="text-[48px] leading-none select-none">
                      🤖
                    </span>
                    <span
                      style={{ padding: '4px 10px' }}
                      className="inline-block text-[11px] font-semibold rounded-full bg-[#0f172a]/10 text-[#0f172a]"
                    >
                      {currentLang === 'en' ? '5 AI Bots' : currentLang === 'it' ? '5 Bot IA' : '5 Bots IA'}
                    </span>
                  </div>

                  <div className="flex flex-col items-start text-left w-full">
                    <h2 className="text-[24px] font-semibold tracking-tight text-[#0f172a] leading-tight">
                      {currentLang === 'en' ? 'Practice vs Bots' : currentLang === 'it' ? 'Pratica vs Bot' : 'Práctica vs Bots'}
                    </h2>
                    <p className="text-[13.5px] text-[#334155] font-normal mt-1 leading-snug">
                      {currentLang === 'en'
                        ? 'Train your strategies instantly against 5 AI bots'
                        : currentLang === 'it'
                        ? 'Allenati subito contro 5 bot con IA'
                        : 'Entrena jugadas al instante contra los 5 bots IA'}
                    </p>
                  </div>
                </button>
              </div>

              {/* ACTIVE OPEN ROOM QUICK BANNER OR EMPTY STATE */}
              <div className="px-5">
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
                            : currentLang === 'en'
                            ? '👥 Real Friends'
                            : currentLang === 'it'
                            ? '👥 Amici Reali'
                            : '👥 Solo Reales'}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#7c7d85] mt-0.5">
                        #{primaryOpenRoom.code} · {currentLang === 'en' ? 'Buy-in' : currentLang === 'it' ? 'Buy-in' : 'Entrada'}: {primaryOpenRoom.buyIn ?? (primaryOpenRoom.roomMode === 'bots' ? 100 : 200)} · {primaryOpenRoom.playerCount}/
                        {primaryOpenRoom.maxPlayers} · {t(currentLang, 'roomsBtn')} ({openRooms.length})
                      </span>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteRoom(primaryOpenRoom.code, e)}
                        aria-label={`Eliminar sala ${primaryOpenRoom.code}`}
                        title="Eliminar sala"
                        className="w-7 h-7 rounded-full bg-[#23252a] text-[#9ca3af] hover:text-[#ef4444] flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsRoomsModalOpen(true)}
                        className="h-7 px-2.5 rounded-full bg-[#23252a] text-white text-[11.5px] font-medium active:scale-95 transition-transform cursor-pointer"
                      >
                        {t(currentLang, 'roomsBtn')}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onJoinOrCreateRoom(
                            primaryOpenRoom.code,
                            primaryOpenRoom.pacingMode,
                            primaryOpenRoom.name,
                            primaryOpenRoom.roomMode,
                            primaryOpenRoom.buyIn ?? (primaryOpenRoom.roomMode === 'bots' ? 100 : 200)
                          )
                        }
                        className="h-7 px-3 rounded-full bg-white text-black text-[11.5px] font-semibold active:scale-95 transition-transform cursor-pointer"
                      >
                        {t(currentLang, 'joinBtn')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 bg-[#121316] border border-[#23252a] rounded-[18px] px-3.5 py-2.5 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex flex-col text-left">
                      <span className="text-[12px] font-medium text-white leading-snug">
                        {t(currentLang, 'noOpenRoomsTitle')}
                      </span>
                      <span className="text-[10.5px] text-[#7c7d85] mt-0.5">
                        {t(currentLang, 'noOpenRoomsDesc')}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsRoomsModalOpen(true)}
                      className="h-7 px-3 rounded-full bg-white text-black text-[11.5px] font-semibold shrink-0 active:scale-95 transition-transform cursor-pointer"
                    >
                      {t(currentLang, 'createTableBtn')}
                    </button>
                  </div>
                )}

                {/* CATÁLOGO DE JUEGOS DE CARTAS (Replaces Leaderboard) */}
                <div className="mt-4 pb-6">
                  <div className="flex items-center justify-between px-1 mb-2.5">
                    <div>
                      <h3 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-1.5">
                        <span>{t(currentLang, 'gameCatalogTitle')}</span>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      </h3>
                      <p className="text-[11px] text-[#7c7d85] -mt-0.5">
                        {t(currentLang, 'gameCatalogSub')}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#1b1d24] text-[#9ca3af] border border-[#23252a]">
                      {t(currentLang, 'gamesCountBadge', { count: cardGames.length })}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {cardGames.map((game) => {
                      const isVoted = votedGameIds.includes(game.id);
                      return (
                        <div
                          key={game.id}
                          className="relative overflow-hidden bg-[#121316] border border-[#1d1f26] hover:border-[#282a33] transition-all rounded-[20px] p-3 flex flex-col gap-2"
                        >
                          {/* Top Row: Icon + Names + Tag */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-9 h-9 rounded-[12px] bg-gradient-to-br ${game.accentGradient} border border-white/10 flex items-center justify-center text-lg shrink-0`}
                              >
                                {game.id === 'uno' ? (
                                  <div className="grid grid-cols-2 gap-0.5 p-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                  </div>
                                ) : (
                                  <span>{game.iconEmoji}</span>
                                )}
                              </div>
                              <div className="flex flex-col text-left">
                                <span className="text-[14px] font-semibold text-white leading-tight">
                                  {game.name}
                                </span>
                                <span className="text-[11px] text-[#8e9099] flex items-center gap-1 mt-0.5">
                                  <span>{game.category}</span>
                                  <span>·</span>
                                  <span>{game.players}</span>
                                </span>
                              </div>
                            </div>

                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${game.tagColor} shrink-0`}
                            >
                              {game.tag}
                            </span>
                          </div>

                          {/* Description */}
                          <p className="text-[11.5px] text-[#9ca3af] leading-relaxed line-clamp-2 text-left pl-0.5">
                            {game.description}
                          </p>

                          {/* Bottom Action Row */}
                          <div className="flex items-center justify-between pt-1 border-t border-[#1b1d24] mt-0.5">
                            <button
                              type="button"
                              onClick={() => setSelectedGameForModal(game)}
                              className="text-[11px] font-medium text-[#9ca3af] hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Info className="w-3.5 h-3.5 text-[#7c7d85]" />
                              <span>{t(currentLang, 'rulesAndDetails')}</span>
                              <ChevronRight className="w-3 h-3 text-[#7c7d85]" />
                            </button>

                            {game.status === 'active' ? (
                              <button
                                type="button"
                                onClick={() => setIsRoomsModalOpen(true)}
                                className="h-7 px-3.5 rounded-full bg-white text-black text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                              >
                                <span>{t(currentLang, 'playPoker')}</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleVote(game.id)}
                                className={`h-7 px-2.5 rounded-full text-[10.5px] font-medium flex items-center gap-1 active:scale-95 transition-all cursor-pointer border ${
                                  isVoted
                                    ? 'bg-[#22c55e]/15 text-[#4ade80] border-[#22c55e]/30'
                                    : 'bg-[#181a20] text-[#a1a1aa] border-[#272930] hover:text-white'
                                }`}
                              >
                                {isVoted ? (
                                  <>
                                    <Check className="w-3 h-3 text-[#4ade80]" />
                                    <span>{t(currentLang, 'votedMode')}</span>
                                  </>
                                ) : (
                                  <>
                                    <span>👍</span>
                                    <span>{t(currentLang, 'voteMode')}</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-5">
              <ProfileView
                profile={profile}
                activeRoomCode={activeRoomCode}
                onProfileChange={setProfile}
                onOpenCreateOrInviteModal={() => setIsRoomsModalOpen(true)}
              />
            </div>
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
            aria-label={t(currentLang, 'home')}
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
            aria-label={t(currentLang, 'profile')}
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
        {/* FIRST-TIME WELCOME MODAL: "¿Cómo te llamas?" OR "¿Ya tienes una cuenta?" */}
        {!profile.hasSetCustomName && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-5">
            {welcomeIsLinking ? (
              <div className="w-full max-w-[380px] bg-[#16171b] border border-[#282a33] rounded-[28px] p-6 flex flex-col gap-4 shadow-2xl text-left">
                <div className="flex flex-col items-center text-center gap-1">
                  <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-[26px] mb-1">
                    🔗
                  </div>
                  <h2 className="text-[19px] font-semibold text-white tracking-tight">
                    Vincular tu cuenta existente
                  </h2>
                  <p className="text-[12px] text-[#8e9099]">
                    Si ya creaste tu cuenta en la app de inicio o en otro navegador, vincúlala aquí
                  </p>
                </div>

                {knownPlayersList.length > 0 && (
                  <div className="flex flex-col gap-1.5 bg-black/40 border border-[#23252a] rounded-[18px] p-3">
                    <span className="text-[11px] font-medium text-[#9ca3af]">
                      Cuentas guardadas en este dispositivo:
                    </span>
                    <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto">
                      {knownPlayersList.map((kp) => (
                        <button
                          key={kp.id}
                          type="button"
                          onClick={() => handleWelcomeLinkAccount(kp.id)}
                          className="flex items-center justify-between p-2 rounded-[12px] bg-[#1c1e26] hover:bg-[#252834] active:scale-98 transition-all cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar3D avatarId={kp.avatarId} size={28} />
                            <span className="text-[12.5px] font-medium text-white">
                              {kp.name}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#eab308] font-semibold">
                            Usar esta →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleWelcomeLinkAccount();
                  }}
                  className="flex flex-col gap-2.5"
                >
                  <label className="text-[11.5px] text-[#9ca3af] font-medium">
                    O escribe tu ID o pega el enlace de sincronización:
                  </label>
                  <input
                    type="text"
                    value={welcomeLinkInput}
                    onChange={(e) => setWelcomeLinkInput(e.target.value)}
                    placeholder="ID (ej. p_abc123) o enlace ?sync=..."
                    autoFocus
                    className="h-11 px-3.5 rounded-[14px] bg-black border border-[#2e313b] text-white text-[13px] placeholder:text-[#6b6d76] focus:outline-none focus:border-white"
                  />

                  {welcomeLinkError && (
                    <span className="text-[11px] text-red-400 font-medium">
                      {welcomeLinkError}
                    </span>
                  )}

                  <button
                    type="submit"
                    className="w-full h-10 rounded-full bg-white text-black text-[13px] font-bold cursor-pointer active:scale-95 transition-transform mt-1"
                  >
                    Vincular y Continuar
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => setWelcomeIsLinking(false)}
                  className="text-[12px] text-[#7c7d85] hover:text-white text-center cursor-pointer mt-1"
                >
                  ← Volver a crear nuevo perfil
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleCompleteWelcome}
                className="w-full max-w-[380px] bg-[#16171b] border border-[#282a33] rounded-[28px] p-6 flex flex-col gap-4 shadow-2xl"
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

                <div className="pt-2 border-t border-[#23252a] flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setWelcomeIsLinking(true)}
                    className="text-[12px] text-[#fb923c] hover:underline font-medium cursor-pointer"
                  >
                    ¿Ya creaste tu cuenta antes? Vincular con ID
                  </button>
                </div>
              </form>
            )}
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
                    Las salas en vivo expiran tras 2h sin actividad (7d por turnos)
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
                    <div
                      key={room.code}
                      className="w-full rounded-[18px] px-3.5 py-3 bg-black/50 border border-[#23252a] hover:border-white/30 flex items-center justify-between gap-2 text-left"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsRoomsModalOpen(false);
                          onJoinOrCreateRoom(
                            room.code,
                            room.pacingMode,
                            room.name,
                            room.roomMode,
                            room.buyIn ?? (room.roomMode === 'bots' ? 100 : 200)
                          );
                        }}
                        className="flex-1 flex flex-col text-left min-w-0 cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[14px] font-medium text-white truncate">
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
                          #{room.code} · Entrada: {room.buyIn ?? (room.roomMode === 'bots' ? 100 : 200)} · {room.playerCount}/{room.maxPlayers}{' '}
                          jugadores · Ciegas {room.blindsLabel}
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRoom(room.code, e)}
                          aria-label={`Eliminar sala ${room.code}`}
                          title="Eliminar sala"
                          className="w-7 h-7 rounded-full bg-[#23252a] text-[#9ca3af] hover:text-[#ef4444] flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsRoomsModalOpen(false);
                            onJoinOrCreateRoom(
                              room.code,
                              room.pacingMode,
                              room.name,
                              room.roomMode,
                              room.buyIn ?? (room.roomMode === 'bots' ? 100 : 200)
                            );
                          }}
                          className="h-7 px-3 rounded-full bg-white text-black text-[12px] font-semibold flex items-center shrink-0 active:scale-95 transition-transform cursor-pointer"
                        >
                          Unirse
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Create new room section */}
              <div className="border-t border-[#23252a] pt-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-white">
                    {t(currentLang, 'modalTitle')}
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
                      <span>{t(currentLang, 'turnNotifications')}</span>
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
                    <span>
                      {currentLang === 'en'
                        ? '👥 Real Friends Only'
                        : currentLang === 'it'
                        ? '👥 Solo Amici Reali'
                        : '👥 Solo Amigos Reales'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRoomMode('bots');
                      if (selectedBuyIn > 100) setSelectedBuyIn(100);
                    }}
                    className={`h-8 rounded-full text-[12px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
                      selectedRoomMode === 'bots'
                        ? 'bg-white text-black'
                        : 'text-[#7c7d85]'
                    }`}
                  >
                    <span>
                      {currentLang === 'en'
                        ? '🤖 With Bots'
                        : currentLang === 'it'
                        ? '🤖 Con i Bot'
                        : '🤖 Con Bots'}
                    </span>
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
                    <span>
                      {currentLang === 'en' ? 'Live' : currentLang === 'it' ? 'Dal Vivo' : 'En Vivo'}
                    </span>
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
                    <span>
                      {currentLang === 'en' ? 'Turn-Based' : currentLang === 'it' ? 'A Turni' : 'Por Turnos'}
                    </span>
                  </button>
                </div>

                {/* Selector 3: Buy-in / Valor de la Mesa */}
                <div className="flex flex-col gap-1.5 bg-black/60 p-2.5 rounded-[18px] border border-[#23252a]">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11.5px] font-medium text-[#9ca3af]">
                      {t(currentLang, 'buyInLabel')}
                    </span>
                    <span className="text-[12px] font-bold text-[#eab308]">
                      🪙 {selectedBuyIn}{' '}
                      {currentLang === 'en' ? 'chips' : currentLang === 'it' ? 'chip' : 'fichas'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(selectedRoomMode === 'bots'
                      ? [50, 100]
                      : [100, 200, 300, 500]
                    ).map((amt) => {
                      const isSelected = selectedBuyIn === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setSelectedBuyIn(amt)}
                          className={`h-7 rounded-[10px] text-[11.5px] font-medium transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-white text-black font-semibold'
                              : 'bg-[#18191e] text-[#9ca3af] hover:text-white'
                          }`}
                        >
                          {amt}
                        </button>
                      );
                    })}
                  </div>
                  {selectedRoomMode === 'bots' && (
                    <span className="text-[10px] text-[#7c7d85] px-1">
                      {currentLang === 'en'
                        ? 'In bot practice, max buy-in is 100 and session lasts max 100 hands.'
                        : currentLang === 'it'
                        ? 'Nei tavoli contro i bot il buy-in massimo è 100 e dura max 100 mani.'
                        : 'En práctica con bots el buy-in máximo es 100 y la sesión dura máx. 100 manos.'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder={t(currentLang, 'roomNamePlaceholder')}
                    maxLength={28}
                    className="flex-1 h-10 rounded-full bg-black border border-[#23252a] px-4 text-[13px] text-white placeholder:text-[#7c7d85] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    className="h-10 px-4 rounded-full bg-white text-black text-[13px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t(currentLang, 'createBtn')}</span>
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
                    placeholder={t(currentLang, 'orJoinWithCode')}
                    maxLength={8}
                    className="flex-1 h-9 rounded-full bg-black border border-[#23252a] px-4 text-[12px] text-white placeholder:text-[#7c7d85] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="h-9 px-3.5 rounded-full bg-[#23252a] text-white text-[12px] font-medium cursor-pointer"
                  >
                    {t(currentLang, 'goBtn')}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* GAME DETAILS & RULES MODAL */}
        {selectedGameForModal && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedGameForModal(null)}
          >
            <div
              className="bg-[#121316] border border-[#23252a] rounded-[24px] w-full max-w-sm p-5 text-white shadow-2xl flex flex-col gap-4 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-[14px] bg-gradient-to-br ${selectedGameForModal.accentGradient} border border-white/10 flex items-center justify-center text-2xl shrink-0`}
                  >
                    {selectedGameForModal.id === 'uno' ? (
                      <div className="grid grid-cols-2 gap-1 p-1">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      </div>
                    ) : (
                      <span>{selectedGameForModal.iconEmoji}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-[17px] font-semibold text-white leading-tight">
                      {selectedGameForModal.name}
                    </h3>
                    <p className="text-[12px] text-[#8e9099] mt-0.5">
                      {selectedGameForModal.category} · {selectedGameForModal.players}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedGameForModal(null)}
                  className="w-8 h-8 rounded-full bg-[#1c1e24] text-[#9ca3af] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tag & Description */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full border ${selectedGameForModal.tagColor}`}
                  >
                    {selectedGameForModal.tag}
                  </span>
                  {selectedGameForModal.status === 'active' && (
                    <span className="text-[10.5px] text-emerald-400 font-medium">
                      {t(currentLang, 'liveAndAsyncAvailable')}
                    </span>
                  )}
                </div>
                <p className="text-[12.5px] text-[#cbd5e1] leading-relaxed">
                  {selectedGameForModal.description}
                </p>
              </div>

              {/* Rules / Mechanics */}
              <div className="bg-[#181a20] border border-[#23252a] rounded-[18px] p-3.5 flex flex-col gap-2">
                <span className="text-[12px] font-semibold text-white flex items-center gap-1.5">
                  <span>{t(currentLang, 'rulesTitle')}</span>
                </span>
                <ul className="flex flex-col gap-2">
                  {selectedGameForModal.rules.map((rule, idx) => (
                    <li
                      key={idx}
                      className="text-[11.5px] text-[#9ca3af] flex items-start gap-2 leading-snug"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 mt-1 shrink-0" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Footer CTA */}
              <div className="flex items-center gap-2 pt-1">
                {selectedGameForModal.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGameForModal(null);
                      setIsRoomsModalOpen(true);
                    }}
                    className="flex-1 h-11 rounded-full bg-white text-black font-semibold text-[13px] flex items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
                  >
                    <span>{t(currentLang, 'playPoker')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleToggleVote(selectedGameForModal.id)}
                      className={`flex-1 h-11 rounded-full text-[12.5px] font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        votedGameIds.includes(selectedGameForModal.id)
                          ? 'bg-[#22c55e]/15 text-[#4ade80] border-[#22c55e]/30'
                          : 'bg-[#1e2027] text-white border-[#2e313b] hover:bg-[#252831]'
                      }`}
                    >
                      {votedGameIds.includes(selectedGameForModal.id) ? (
                        <>
                          <Check className="w-4 h-4 text-[#4ade80]" />
                          <span>{t(currentLang, 'votedPrompt')}</span>
                        </>
                      ) : (
                        <>
                          <span>👍</span>
                          <span>{t(currentLang, 'votePrompt')}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedGameForModal(null)}
                      className="h-11 px-4 rounded-full bg-[#181a20] border border-[#23252a] text-[#a1a1aa] text-[12.5px] font-medium hover:text-white cursor-pointer"
                    >
                      {t(currentLang, 'close')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
