import { Check, Copy, Pencil, Plus, Settings, Trophy, Users, X } from 'lucide-react';
import React, { useState } from 'react';
import {
  getNotificationPermission,
  isPartyKitConfigured,
  requestTurnNotificationPermission,
} from '../lib/multiplayer';
import {
  CARD_BACK_ORDER,
  CARD_BACK_THEMES,
  type CardBackColorId,
  computePlaystyleMetrics,
  DEFAULT_USER_PROFILE,
  type PlaystyleArchetype,
  saveUserProfile,
  type UserProfilePreferences,
  updateUserProfile,
} from '../lib/profile';
import { isSupabaseConfigured } from '../lib/supabase';
import { Avatar3D } from './poker/Avatar3D';
import { OffsuitCardBack } from './poker/PlayingCard';

interface ProfileViewProps {
  profile: UserProfilePreferences;
  activeRoomCode: string;
  onProfileChange: (next: UserProfilePreferences) => void;
  onOpenCreateOrInviteModal: () => void;
}

const AVATAR_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'hero', label: 'Gafas Verdes' },
  { id: 'emma', label: 'Emma' },
  { id: 'leo', label: 'Leo' },
  { id: 'akash', label: 'Akash' },
  { id: 'tori', label: 'Tori' },
  { id: 'evelyn', label: 'Evelyn' },
];

const RANK_TIERS = [
  { emoji: '🦐', name: 'Shrimp', minLevel: 1, xpRange: '0 – 499 XP' },
  { emoji: '🦀', name: 'Crab', minLevel: 3, xpRange: '500 – 999 XP' },
  { emoji: '🐬', name: 'Dolphin', minLevel: 5, xpRange: '1,000 – 1,999 XP' },
  { emoji: '🦈', name: 'Shark', minLevel: 9, xpRange: '2,000 – 4,999 XP' },
  { emoji: '🐋', name: 'Whale', minLevel: 21, xpRange: '5,000+ XP' },
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  activeRoomCode,
  onProfileChange,
  onOpenCreateOrInviteModal,
}) => {
  const [nameDraft, setNameDraft] = useState(profile.name);
  const [avatarDraft, setAvatarDraft] = useState(profile.avatarId);
  const [activeSheet, setActiveSheet] = useState<
    null | 'editProfile' | 'friends' | 'emotes' | 'cardBacks' | 'rank' | 'settings'
  >(null);
  const [copiedFriendLink, setCopiedFriendLink] = useState(false);

  const metrics = computePlaystyleMetrics(profile.stats);

  // SVG Diamond Radar Geometry (viewBox 0 0 360 300, center at cx=180, cy=150, max radius R=82)
  const cx = 180;
  const cy = 150;
  const maxR = 82;

  const topPt = { x: cx, y: cy - maxR * metrics.aggressive };
  const rightPt = { x: cx + maxR * metrics.loose, y: cy };
  const bottomPt = { x: cx, y: cy + maxR * metrics.passive };
  const leftPt = { x: cx - maxR * metrics.tight, y: cy };

  const polygonPoints = `${topPt.x.toFixed(1)},${topPt.y.toFixed(1)} ${rightPt.x.toFixed(
    1
  )},${rightPt.y.toFixed(1)} ${bottomPt.x.toFixed(1)},${bottomPt.y.toFixed(
    1
  )} ${leftPt.x.toFixed(1)},${leftPt.y.toFixed(1)}`;

  // Corner archetype coordinates & callout line anchor
  const archetypeConfig: Record<
    PlaystyleArchetype,
    {
      badgeX: number;
      badgeY: number;
      lineStartX: number;
      lineStartY: number;
      lineEndX: number;
      lineEndY: number;
    }
  > = {
    TAG: {
      badgeX: 54,
      badgeY: 66,
      lineStartX: (topPt.x + leftPt.x) / 2,
      lineStartY: (topPt.y + leftPt.y) / 2,
      lineEndX: 84,
      lineEndY: 74,
    },
    LAG: {
      badgeX: 306,
      badgeY: 66,
      lineStartX: (topPt.x + rightPt.x) / 2,
      lineStartY: (topPt.y + rightPt.y) / 2,
      lineEndX: 276,
      lineEndY: 74,
    },
    ROCK: {
      badgeX: 54,
      badgeY: 234,
      lineStartX: (bottomPt.x + leftPt.x) / 2,
      lineStartY: (bottomPt.y + leftPt.y) / 2,
      lineEndX: 86,
      lineEndY: 226,
    },
    FISH: {
      badgeX: 306,
      badgeY: 234,
      lineStartX: (bottomPt.x + rightPt.x) / 2,
      lineStartY: (bottomPt.y + rightPt.y) / 2,
      lineEndX: 274,
      lineEndY: 226,
    },
  };

  const activeCallout = archetypeConfig[metrics.archetype];

  const handleOpenProfileEditor = () => {
    setNameDraft(profile.name);
    setAvatarDraft(profile.avatarId);
    setActiveSheet('editProfile');
  };

  const handleSaveProfileEdit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = nameDraft.trim() || 'isaac';
    const next = updateUserProfile((prev) => ({
      ...prev,
      name: trimmed,
      avatarId: avatarDraft,
    }));
    onProfileChange(next);
    setActiveSheet(null);
  };

  const handleSelectCardBack = (colorId: CardBackColorId) => {
    const next = updateUserProfile((prev) => ({ ...prev, cardBackColor: colorId }));
    onProfileChange(next);
  };

  const handleSelectEmote = (emote: string) => {
    const next = updateUserProfile((prev) => ({ ...prev, selectedEmote: emote }));
    onProfileChange(next);
  };

  const rankProgressPct = Math.min(100, Math.max(18, Math.round(((profile.xp % 250) / 250) * 100)));
  const xpToNextLevel = 250 - (profile.xp % 250);
  const cardBackIndex = CARD_BACK_ORDER.indexOf(profile.cardBackColor) + 1;

  return (
    <div className="flex flex-col pb-24 pt-2">
      {/* Top Row: Settings Gear on Right + Centered Avatar & Editable Name */}
      <div className="relative flex flex-col items-center pt-2 pb-5">
        <button
          type="button"
          onClick={() => setActiveSheet('settings')}
          aria-label="Configuración"
          className="absolute right-0 top-1 w-10 h-10 rounded-full flex items-center justify-center text-[#8e9099] hover:text-white active:scale-95 transition-all cursor-pointer"
        >
          <Settings className="w-6 h-6 stroke-[1.8]" />
        </button>

        {/* Centered 3D Avatar with small edit badge (✎) — opens Profile Editor Modal */}
        <div className="relative">
          <button
            type="button"
            onClick={handleOpenProfileEditor}
            className="w-[84px] h-[84px] rounded-full bg-[#16181d] border border-[#25272e] flex items-center justify-center overflow-hidden active:scale-95 transition-transform cursor-pointer"
            title="Editar nombre y avatar"
          >
            <Avatar3D avatarId={profile.avatarId} size={74} />
          </button>
          <button
            type="button"
            onClick={handleOpenProfileEditor}
            aria-label="Editar perfil"
            className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-[#1e2028] border border-[#323540] text-white flex items-center justify-center shadow-md cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tappable Player Name — opens Profile Editor Modal */}
        <button
          type="button"
          onClick={handleOpenProfileEditor}
          className="mt-2.5 text-[22px] font-medium text-white tracking-tight hover:opacity-80 cursor-pointer"
        >
          {profile.name}
        </button>
      </div>

      {/* 2x2 Action Pills + Full-Width Rank Progress Pill (matching image_2.png) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Top-left: 👫 Amigos pill */}
        <button
          type="button"
          onClick={() => setActiveSheet('friends')}
          className="h-[66px] rounded-[20px] bg-[#141519] border border-[#22242a] px-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform cursor-pointer"
        >
          <span className="text-[24px] leading-none">👫</span>
          <div className="flex flex-col">
            <span className="text-[15px] font-medium text-white leading-tight">
              Amigos
            </span>
            <span className="text-[12px] text-[#7c7d85] mt-0.5">4 conectados</span>
          </div>
        </button>

        {/* Top-right: High-contrast white-bordered pill button (CREAR SALA / INVITAR AMIGOS) */}
        <button
          type="button"
          onClick={onOpenCreateOrInviteModal}
          className="h-[66px] rounded-[20px] bg-[#141519] border-2 border-white px-4 flex flex-col items-center justify-center text-center active:scale-[0.99] transition-transform cursor-pointer"
        >
          <span className="text-[13px] font-bold tracking-wider text-white uppercase leading-tight">
            CREAR SALA
          </span>
          <span className="text-[10px] font-medium text-white/75 tracking-wide uppercase mt-0.5">
            INVITAR AMIGOS
          </span>
        </button>

        {/* Middle-left: 👋 6 (24) Emotes pill */}
        <button
          type="button"
          onClick={() => setActiveSheet('emotes')}
          className="h-[68px] rounded-[20px] bg-[#141519] border border-[#22242a] px-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform cursor-pointer"
        >
          <span className="text-[26px] leading-none">{profile.selectedEmote}</span>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span className="text-[15px] font-semibold text-white">
                {profile.unlockedEmotes.length}
              </span>
              <span className="text-[13px] text-[#7c7d85]">(24)</span>
            </div>
            <span className="text-[12px] text-[#7c7d85]">Emotes</span>
          </div>
        </button>

        {/* Middle-right: 2 (20) Card backs pill with mini card-back preview — opens Card Backs sheet */}
        <button
          type="button"
          onClick={() => setActiveSheet('cardBacks')}
          className="h-[68px] rounded-[20px] bg-[#141519] border border-[#22242a] px-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform cursor-pointer"
        >
          <div className="w-8 h-11 shrink-0">
            <OffsuitCardBack
              colorId={profile.cardBackColor}
              className="w-full h-full !rounded-[7px] !p-[1.5px]"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-[15px] font-semibold text-white">
                {cardBackIndex}
              </span>
              <span className="text-[13px] text-[#7c7d85]">(20)</span>
            </div>
            <span className="text-[12px] text-[#7c7d85] truncate">Card backs</span>
          </div>
        </button>
      </div>

      {/* Quick Card Back Color Swatches Row */}
      <div className="mt-2.5 flex items-center justify-between bg-[#111216] border border-[#1f2127] rounded-[16px] px-3.5 py-2">
        <span className="text-[11px] text-[#7c7d85]">
          Dorso activo:{' '}
          <strong className="text-white font-medium">
            {CARD_BACK_THEMES[profile.cardBackColor].name}
          </strong>
        </span>
        <div className="flex items-center gap-2">
          {CARD_BACK_ORDER.map((cid) => {
            const theme = CARD_BACK_THEMES[cid];
            const isSelected = profile.cardBackColor === cid;
            return (
              <button
                key={cid}
                type="button"
                onClick={() => handleSelectCardBack(cid)}
                aria-label={`Color de dorso ${theme.name}`}
                className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                  isSelected ? 'ring-2 ring-white scale-110' : 'opacity-65 hover:opacity-100'
                }`}
                style={{ backgroundColor: theme.hex }}
              />
            );
          })}
        </div>
      </div>

      {/* Full-width bottom pill: 🦐 Shrimp · Rank progress (Interactive Button) */}
      <button
        type="button"
        onClick={() => setActiveSheet('rank')}
        className="mt-3 w-full rounded-[20px] bg-[#141519] border border-[#22242a] px-4 py-3.5 flex items-center gap-3.5 text-left active:scale-[0.99] transition-transform cursor-pointer"
      >
        <span className="text-[26px] leading-none">🦐</span>
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-medium text-white leading-none">
              Shrimp
            </span>
            <span className="text-[11px] text-[#7c7d85]">
              Nivel {profile.level} · {profile.xp} XP
            </span>
          </div>
          <div className="w-full h-[5px] rounded-full bg-[#25272f] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#f43f5e] to-[#fb923c] transition-all duration-300"
              style={{ width: `${rankProgressPct}%` }}
            />
          </div>
          <span className="text-[11px] text-[#7c7d85] leading-none">
            Rank progress
          </span>
        </div>
      </button>

      {/* Statistics Section + Playstyle Diamond Radar Chart (matching image_2.png) */}
      <div className="mt-7">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[20px] font-semibold text-white tracking-tight">
            Statistics
          </h2>
          <span className="text-[12px] text-[#7c7d85]">
            {profile.stats.handsPlayed} manos jugadas
          </span>
        </div>

        <div className="w-full flex flex-col items-center">
          <svg
            viewBox="0 0 360 300"
            className="w-full max-w-[360px] h-auto overflow-visible select-none"
          >
            <defs>
              <linearGradient
                id="playstyle-poly-grad"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#ec4899" stopOpacity="0.62" />
                <stop offset="52%" stopColor="#f97316" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.52" />
              </linearGradient>
              <linearGradient
                id="playstyle-stroke-grad"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="50%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>

            {/* 4 Concentric Dashed Diamonds */}
            {[0.25, 0.5, 0.75, 1].map((scale) => {
              const r = maxR * scale;
              const pts = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
              return (
                <polygon
                  key={scale}
                  points={pts}
                  fill="none"
                  stroke="#262830"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
              );
            })}

            {/* Vertical & Horizontal Dashed Axes */}
            <line
              x1={cx}
              y1={cy - maxR}
              x2={cx}
              y2={cy + maxR}
              stroke="#262830"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />
            <line
              x1={cx - maxR}
              y1={cy}
              x2={cx + maxR}
              y2={cy}
              stroke="#262830"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />

            {/* Dynamic Playstyle Gradient Polygon */}
            <polygon
              points={polygonPoints}
              fill="url(#playstyle-poly-grad)"
              stroke="url(#playstyle-stroke-grad)"
              strokeWidth="2"
              strokeLinejoin="round"
            />

            {/* Callout dashed line pointing from polygon edge to active archetype badge */}
            <line
              x1={activeCallout.lineStartX}
              y1={activeCallout.lineStartY}
              x2={activeCallout.lineEndX}
              y2={activeCallout.lineEndY}
              stroke="#fb7185"
              strokeWidth="1.4"
              strokeDasharray="2.5 2.5"
            />
            <circle
              cx={activeCallout.lineStartX}
              cy={activeCallout.lineStartY}
              r="2.8"
              fill="#fb7185"
            />

            {/* 4 Axis Labels */}
            <text
              x={cx}
              y={26}
              textAnchor="middle"
              fill="#f43f5e"
              fontSize="13"
              fontWeight="600"
            >
              Aggressive
            </text>
            <text
              x={cx}
              y={42}
              textAnchor="middle"
              fill="#7c7d85"
              fontSize="10.5"
            >
              More bets &amp; raises
            </text>

            <text
              x={cx}
              y={266}
              textAnchor="middle"
              fill="#38bdf8"
              fontSize="13"
              fontWeight="600"
            >
              Passive
            </text>
            <text
              x={cx}
              y={282}
              textAnchor="middle"
              fill="#7c7d85"
              fontSize="10.5"
            >
              More calls
            </text>

            <text
              x={44}
              y={146}
              textAnchor="middle"
              fill="#a855f7"
              fontSize="13"
              fontWeight="600"
            >
              Tight
            </text>
            <text
              x={44}
              y={162}
              textAnchor="middle"
              fill="#7c7d85"
              fontSize="10.5"
            >
              Less hands
            </text>

            <text
              x={316}
              y={146}
              textAnchor="middle"
              fill="#f59e0b"
              fontSize="13"
              fontWeight="600"
            >
              Loose
            </text>
            <text
              x={316}
              y={162}
              textAnchor="middle"
              fill="#7c7d85"
              fontSize="10.5"
            >
              More hands
            </text>

            {/* 4 Corner Archetype Pill Badges: TAG, LAG, ROCK, FISH */}
            {(['TAG', 'LAG', 'ROCK', 'FISH'] as PlaystyleArchetype[]).map((arch) => {
              const cfg = archetypeConfig[arch];
              const isActive = metrics.archetype === arch;
              return (
                <g
                  key={arch}
                  transform={`translate(${cfg.badgeX - 24}, ${cfg.badgeY - 12})`}
                >
                  <rect
                    width="48"
                    height="24"
                    rx="8"
                    fill={isActive ? 'rgba(244, 63, 94, 0.14)' : '#121317'}
                    stroke={isActive ? '#fb7185' : '#262830'}
                    strokeWidth={isActive ? '1.5' : '1'}
                  />
                  <text
                    x="24"
                    y="16"
                    textAnchor="middle"
                    fill={isActive ? '#fb7185' : '#7c7d85'}
                    fontSize="11"
                    fontWeight="700"
                    letterSpacing="0.04em"
                  >
                    {arch}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* SHEET 1: EDIT PROFILE (Name + Avatar Picker) */}
      {activeSheet === 'editProfile' && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <form
            onSubmit={handleSaveProfileEdit}
            className="w-full max-w-[400px] bg-[#16171b] border border-[#262830] rounded-[28px] p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-semibold text-white">
                Editar Perfil y Avatar
              </span>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="w-8 h-8 rounded-full bg-[#23252a] flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] text-[#9ca3af] font-medium">
                Tu nombre de jugador
              </label>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={18}
                autoFocus
                placeholder="Tu nombre"
                className="h-11 px-4 rounded-[16px] bg-black border border-[#2e313b] text-white text-[15px] focus:outline-none focus:border-white"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[12px] text-[#9ca3af] font-medium">
                Elige tu Avatar 3D
              </span>
              <div className="grid grid-cols-3 gap-2.5">
                {AVATAR_OPTIONS.map((av) => {
                  const isSelected = avatarDraft === av.id;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setAvatarDraft(av.id)}
                      className={`p-2.5 rounded-[18px] border flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-white/15 border-white'
                          : 'bg-black/40 border-[#25272e] hover:border-white/30'
                      }`}
                    >
                      <Avatar3D avatarId={av.id} size={46} />
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
              Guardar cambios
            </button>
          </form>
        </div>
      )}

      {/* SHEET 2: CARD BACKS SELECTOR */}
      {activeSheet === 'cardBacks' && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="w-full max-w-[400px] bg-[#16171b] border border-[#262830] rounded-[28px] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-semibold text-white">
                Dorsos de Cartas (Card Backs)
              </span>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="w-8 h-8 rounded-full bg-[#23252a] flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {CARD_BACK_ORDER.map((cid) => {
                const theme = CARD_BACK_THEMES[cid];
                const isSelected = profile.cardBackColor === cid;
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => {
                      handleSelectCardBack(cid);
                      setActiveSheet(null);
                    }}
                    className={`p-3 rounded-[20px] border flex flex-col items-center gap-2.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white/12 border-white'
                        : 'bg-black/40 border-[#25272e]'
                    }`}
                  >
                    <div className="w-[72px] h-[102px]">
                      <OffsuitCardBack colorId={cid} className="w-full h-full" />
                    </div>
                    <span className="text-[12px] font-medium text-white">
                      {theme.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SHEET 3: RANK PROGRESS & LEVELS */}
      {activeSheet === 'rank' && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="w-full max-w-[400px] bg-[#16171b] border border-[#262830] rounded-[28px] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#fb923c]" />
                <span className="text-[16px] font-semibold text-white">
                  Progreso de Rango · Nivel {profile.level}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="w-8 h-8 rounded-full bg-[#23252a] flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-black/50 border border-[#23252a] rounded-[18px] p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-white font-medium">
                  XP Actual: {profile.xp} XP
                </span>
                <span className="text-[#fb923c]">
                  Faltan {xpToNextLevel} XP para Nivel {profile.level + 1}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#25272f] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#f43f5e] to-[#fb923c]"
                  style={{ width: `${rankProgressPct}%` }}
                />
              </div>
              <span className="text-[11px] text-[#7c7d85]">
                Ganas +4 XP por cada decisión y +25 XP al ganar una mano.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {RANK_TIERS.map((tier) => {
                const isCurrent = tier.name === 'Shrimp';
                return (
                  <div
                    key={tier.name}
                    className={`flex items-center justify-between px-3.5 py-2 rounded-[14px] border ${
                      isCurrent
                        ? 'bg-white/10 border-white/40'
                        : 'bg-black/30 border-[#23252a]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-[20px]">{tier.emoji}</span>
                      <span className="text-[13px] font-medium text-white">
                        {tier.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#7c7d85]">
                      {tier.xpRange}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SHEET 4: EMOTES */}
      {activeSheet === 'emotes' && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="w-full max-w-[400px] bg-[#16171b] border border-[#262830] rounded-[28px] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-semibold text-white">
                Seleccionar Emote de Mesa
              </span>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="w-8 h-8 rounded-full bg-[#23252a] flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-6 gap-2.5">
              {profile.unlockedEmotes.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    handleSelectEmote(em);
                    setActiveSheet(null);
                  }}
                  className={`h-12 rounded-[16px] text-[24px] flex items-center justify-center border cursor-pointer ${
                    profile.selectedEmote === em
                      ? 'bg-white/15 border-white'
                      : 'bg-black/40 border-[#25272e]'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SHEET 5: FRIENDS */}
      {activeSheet === 'friends' && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="w-full max-w-[400px] bg-[#16171b] border border-[#262830] rounded-[28px] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="text-[16px] font-semibold text-white">
                  Amigos &amp; Primos
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="w-8 h-8 rounded-full bg-[#23252a] flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {[
                { id: 'leo', name: 'primo_leo', status: 'En Mesa de los Primos' },
                { id: 'akash', name: 'akash', status: 'En Mesa en Vivo' },
                { id: 'emma', name: 'emma_poker', status: 'Conectada' },
                { id: 'tori', name: 'tori_v', status: 'Turno pendiente' },
              ].map((fr) => (
                <div
                  key={fr.id}
                  className="flex items-center justify-between bg-black/40 border border-[#23252a] rounded-[16px] px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar3D avatarId={fr.id} size={34} />
                    <div>
                      <div className="text-[14px] font-medium text-white">
                        {fr.name}
                      </div>
                      <div className="text-[11px] text-emerald-400">{fr.status}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSheet(null);
                      onOpenCreateOrInviteModal();
                    }}
                    className="h-7 px-3 rounded-full bg-white text-black text-[11px] font-semibold cursor-pointer"
                  >
                    Invitar
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(
                  `${window.location.origin}/?room=${activeRoomCode}`
                );
                setCopiedFriendLink(true);
                setTimeout(() => setCopiedFriendLink(false), 1800);
              }}
              className="w-full h-11 rounded-full bg-[#23252a] text-white text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer"
            >
              {copiedFriendLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>¡Enlace de sala #{activeRoomCode} copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar invitación a Sala #{activeRoomCode}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* SHEET 6: SETTINGS */}
      {activeSheet === 'settings' && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="w-full max-w-[400px] bg-[#16171b] border border-[#262830] rounded-[28px] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-semibold text-white">
                Ajustes · Juegos de Cartas
              </span>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="w-8 h-8 rounded-full bg-[#23252a] flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-black/40 border border-[#23252a] rounded-[16px] p-3.5 flex flex-col gap-1.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[#7c7d85]">Sincronización de Salas</span>
                <span className="text-emerald-400 font-medium">
                  {isPartyKitConfigured
                    ? 'PartyKit Cloudflare WS'
                    : isSupabaseConfigured
                    ? 'Supabase Realtime'
                    : 'Local + BroadcastChannel'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7c7d85]">Notificaciones de Turno</span>
                <button
                  type="button"
                  onClick={() => void requestTurnNotificationPermission()}
                  className="text-[#eab308] underline cursor-pointer"
                >
                  {getNotificationPermission() === 'granted'
                    ? 'Activadas'
                    : 'Activar ahora'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const reset = saveUserProfile(DEFAULT_USER_PROFILE);
                onProfileChange(reset);
                setActiveSheet(null);
              }}
              className="w-full h-10 rounded-full bg-[#23252a] text-white/80 text-[12px] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 rotate-45" />
              <span>Restaurar estadísticas de demostración</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
