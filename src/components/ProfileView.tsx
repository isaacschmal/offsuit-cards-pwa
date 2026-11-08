import { Check, Copy, Pencil, Plus, Settings, Share2, Trash2, Trophy, Users, X } from 'lucide-react';
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
  claimBankruptcyBonus,
  computePlaystyleMetrics,
  DEFAULT_USER_PROFILE,
  generateAccountSyncToken,
  linkAccountById,
  type PlaystyleArchetype,
  restoreAccountFromSyncToken,
  type UserProfilePreferences,
  updateUserProfile,
  upsertKnownPlayer,
} from '../lib/profile';
import { isSupabaseConfigured } from '../lib/supabase';
import { SUPPORTED_LANGUAGES, type SupportedLanguage, t } from '../lib/i18n';
import { Avatar3D } from './poker/Avatar3D';
import { OffsuitCardBack } from './poker/PlayingCard';

interface ProfileViewProps {
  profile: UserProfilePreferences;
  activeRoomCode: string;
  onProfileChange: (next: UserProfilePreferences) => void;
  onOpenCreateOrInviteModal: () => void;
}

export const AVATAR_OPTIONS: Array<{ id: string; label: string }> = [
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
  const [friendNameInput, setFriendNameInput] = useState('');
  const [activeSheet, setActiveSheet] = useState<
    null | 'editProfile' | 'friends' | 'emotes' | 'cardBacks' | 'rank' | 'settings'
  >(null);
  const [copiedFriendLink, setCopiedFriendLink] = useState(false);
  const [copiedPlayerId, setCopiedPlayerId] = useState(false);
  const [copiedSyncLink, setCopiedSyncLink] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [linkStatusMsg, setLinkStatusMsg] = useState<string | null>(null);

  const metrics = computePlaystyleMetrics(profile.stats);
  const hasPlayedHands = metrics.archetype !== null;

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

  const activeCallout = metrics.archetype ? archetypeConfig[metrics.archetype] : null;

  const handleOpenProfileEditor = () => {
    setNameDraft(profile.name);
    setAvatarDraft(profile.avatarId);
    setActiveSheet('editProfile');
  };

  const handleSaveProfileEdit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = nameDraft.trim() || profile.name || 'Jugador';
    const next = updateUserProfile((prev) => ({
      ...prev,
      name: trimmed,
      hasSetCustomName: true,
      avatarId: avatarDraft,
    }));
    onProfileChange(next);
    setActiveSheet(null);
  };

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = friendNameInput.trim();
    if (!clean) return;
    const avatars = ['leo', 'emma', 'akash', 'tori', 'evelyn', 'hero'];
    const randomAvatar = avatars[profile.friends.length % avatars.length];
    const friendId = 'friend_' + clean.toLowerCase().replace(/\s+/g, '_');

    const next = updateUserProfile((prev) => {
      if (prev.friends.some((f) => f.name.toLowerCase() === clean.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        friends: [
          ...prev.friends,
          {
            id: friendId,
            name: clean,
            avatarId: randomAvatar,
            addedAt: Date.now(),
          },
        ],
      };
    });
    upsertKnownPlayer({
      id: friendId,
      name: clean,
      avatarId: randomAvatar,
      xp: 0,
    });
    onProfileChange(next);
    setFriendNameInput('');
  };

  const handleRemoveFriend = (id: string) => {
    const next = updateUserProfile((prev) => ({
      ...prev,
      friends: prev.friends.filter((f) => f.id !== id),
    }));
    onProfileChange(next);
  };

  const handleShareOrCopyRoomLink = async () => {
    const code = activeRoomCode || 'MESA1';
    const url = `${window.location.origin}/?room=${encodeURIComponent(code)}`;
    const shareMessage = `🃏 ¡Únete a mi mesa de Poker (#${code}) en Juegos de Cartas!\n\n📱 Si tienes la app 'Cartas' en tu iPhone:\n1. Abre la app 'Cartas'\n2. Escribe el código #${code} en Inicio\n\n🌐 O entra desde tu navegador:\n${url}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Mesa #${code} · Juegos de Cartas`,
          text: shareMessage,
        });
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }
    navigator.clipboard?.writeText(shareMessage);
    setCopiedFriendLink(true);
    setTimeout(() => setCopiedFriendLink(false), 2000);
  };

  const handleCopyPlayerId = () => {
    navigator.clipboard?.writeText(profile.playerId);
    setCopiedPlayerId(true);
    setTimeout(() => setCopiedPlayerId(false), 2000);
  };

  const handleCopySyncLink = () => {
    const token = generateAccountSyncToken(profile);
    const syncUrl = `${window.location.origin}/?sync=${encodeURIComponent(token)}`;
    navigator.clipboard?.writeText(syncUrl);
    setCopiedSyncLink(true);
    setTimeout(() => setCopiedSyncLink(false), 2500);
  };

  const handleLinkAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = linkInput.trim();
    if (!raw) return;
    try {
      let token = raw;
      if (raw.includes('sync=')) {
        const parsed = new URL(raw, window.location.origin);
        token = parsed.searchParams.get('sync') || raw;
      }
      const restored = restoreAccountFromSyncToken(token);
      if (restored) {
        onProfileChange(restored);
        setLinkStatusMsg('¡Cuenta vinculada con éxito!');
        setLinkInput('');
        setTimeout(() => setLinkStatusMsg(null), 3000);
        return;
      }
      const linked = linkAccountById(raw);
      onProfileChange(linked);
      setLinkStatusMsg(`¡Perfil actualizado con ID: ${linked.playerId}!`);
      setLinkInput('');
      setTimeout(() => setLinkStatusMsg(null), 3000);
    } catch {
      setLinkStatusMsg('No se pudo vincular la cuenta. Revisa el código.');
      setTimeout(() => setLinkStatusMsg(null), 3000);
    }
  };

  const handleSelectCardBack = (colorId: CardBackColorId) => {
    const next = updateUserProfile((prev) => ({ ...prev, cardBackColor: colorId }));
    onProfileChange(next);
  };

  const handleSelectEmote = (emote: string) => {
    const next = updateUserProfile((prev) => ({ ...prev, selectedEmote: emote }));
    onProfileChange(next);
  };

  const handleSelectLanguage = (newLang: SupportedLanguage) => {
    const next = updateUserProfile((prev) => ({ ...prev, language: newLang }));
    onProfileChange(next);
  };

  const currentLang = profile.language ?? 'es';

  const rankProgressPct = Math.min(
    100,
    Math.max(profile.xp === 0 ? 4 : 12, Math.round(((profile.xp % 250) / 250) * 100))
  );
  const xpToNextLevel = 250 - (profile.xp % 250);
  const cardBackIndex = CARD_BACK_ORDER.indexOf(profile.cardBackColor) + 1;

  return (
    <div className="flex flex-col pt-3 pb-2">
      {/* Top Row: Settings Gear on Right + Centered Avatar & Editable Name */}
      <div className="relative flex flex-col items-center pb-2.5">
        <button
          type="button"
          onClick={() => setActiveSheet('settings')}
          aria-label="Configuración"
          className="absolute right-0 top-0 w-9 h-9 rounded-full flex items-center justify-center text-[#8e9099] hover:text-white active:scale-95 transition-all cursor-pointer"
        >
          <Settings className="w-5 h-5 stroke-[1.8]" />
        </button>

        {/* Centered 3D Avatar with small edit badge (✎) — full 72px circular avatar never cut off at top */}
        <div className="relative">
          <button
            type="button"
            onClick={handleOpenProfileEditor}
            className="w-[72px] h-[72px] rounded-full bg-[#16181d] border border-[#25272e] flex items-center justify-center overflow-hidden active:scale-95 transition-transform cursor-pointer"
            title="Editar nombre y avatar"
          >
            <Avatar3D avatarId={profile.avatarId} size={64} />
          </button>
          <button
            type="button"
            onClick={handleOpenProfileEditor}
            aria-label="Editar perfil"
            className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#1e2028] border border-[#323540] text-white flex items-center justify-center shadow-md cursor-pointer"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>

        {/* Tappable Player Name — opens Profile Editor Modal */}
        <button
          type="button"
          onClick={handleOpenProfileEditor}
          className="mt-1.5 text-[19px] font-medium text-white tracking-tight hover:opacity-80 cursor-pointer leading-tight"
        >
          {profile.name || 'Jugador'}
        </button>
      </div>

      {/* 2x2 Action Pills + Full-Width Rank Progress Pill */}
      <div className="grid grid-cols-2 gap-2">
        {/* Top-left: 👫 Amigos pill (real friend count) */}
        <button
          type="button"
          onClick={() => setActiveSheet('friends')}
          className="h-[54px] rounded-[18px] bg-[#141519] border border-[#22242a] px-3.5 flex items-center gap-2.5 text-left active:scale-[0.99] transition-transform cursor-pointer"
        >
          <span className="text-[21px] leading-none">👫</span>
          <div className="flex flex-col">
            <span className="text-[14px] font-medium text-white leading-tight">
              Amigos
            </span>
            <span className="text-[11px] text-[#7c7d85]">
              {profile.friends.length}{' '}
              {profile.friends.length === 1 ? 'agregado' : 'agregados'}
            </span>
          </div>
        </button>

        {/* Top-right: High-contrast white-bordered pill button (CREAR SALA / INVITAR AMIGOS) */}
        <button
          type="button"
          onClick={onOpenCreateOrInviteModal}
          className="h-[54px] rounded-[18px] bg-[#141519] border-2 border-white px-3 flex flex-col items-center justify-center text-center active:scale-[0.99] transition-transform cursor-pointer"
        >
          <span className="text-[12px] font-bold tracking-wider text-white uppercase leading-tight">
            CREAR SALA
          </span>
          <span className="text-[9.5px] font-medium text-white/75 tracking-wide uppercase mt-0.5">
            INVITAR AMIGOS
          </span>
        </button>

        {/* Middle-left: 👋 6 (24) Emotes pill */}
        <button
          type="button"
          onClick={() => setActiveSheet('emotes')}
          className="h-[54px] rounded-[18px] bg-[#141519] border border-[#22242a] px-3.5 flex items-center gap-2.5 text-left active:scale-[0.99] transition-transform cursor-pointer"
        >
          <span className="text-[22px] leading-none">{profile.selectedEmote}</span>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span className="text-[14px] font-semibold text-white leading-tight">
                {profile.unlockedEmotes.length}
              </span>
              <span className="text-[11.5px] text-[#7c7d85]">(24)</span>
            </div>
            <span className="text-[11px] text-[#7c7d85]">Emotes</span>
          </div>
        </button>

        {/* Middle-right: Card backs pill with mini card-back preview */}
        <button
          type="button"
          onClick={() => setActiveSheet('cardBacks')}
          className="h-[54px] rounded-[18px] bg-[#141519] border border-[#22242a] px-3 flex items-center gap-2.5 text-left active:scale-[0.99] transition-transform cursor-pointer"
        >
          <div className="w-7 h-9 shrink-0">
            <OffsuitCardBack
              colorId={profile.cardBackColor}
              className="w-full h-full !rounded-[6px] !p-[1.5px]"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-[14px] font-semibold text-white leading-tight">
                {cardBackIndex}
              </span>
              <span className="text-[11.5px] text-[#7c7d85]">(20)</span>
            </div>
            <span className="text-[11px] text-[#7c7d85] truncate">Card backs</span>
          </div>
        </button>
      </div>

      {/* Quick Card Back Color Swatches Row */}
      <div className="mt-2 flex items-center justify-between bg-[#111216] border border-[#1f2127] rounded-[14px] px-3 py-1.5">
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
                className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
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
        className="mt-2 w-full rounded-[18px] bg-[#141519] border border-[#22242a] px-3.5 py-2.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform cursor-pointer"
      >
        <span className="text-[22px] leading-none">🦐</span>
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium text-white leading-none">
              Shrimp
            </span>
            <span className="text-[11px] text-[#7c7d85]">
              Nivel {profile.level} · {profile.xp} XP · {profile.bankroll} fichas
            </span>
          </div>
          <div className="w-full h-[4.5px] rounded-full bg-[#25272f] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#f43f5e] to-[#fb923c] transition-all duration-300"
              style={{ width: `${rankProgressPct}%` }}
            />
          </div>
          <span className="text-[10.5px] text-[#7c7d85] leading-none">
            Rank progress
          </span>
        </div>
      </button>

      {/* Bankruptcy Recovery Bonus in Profile */}
      {profile.bankroll <= 0 && (
        <div className="mt-2.5 p-3 rounded-[18px] bg-red-950/40 border border-red-500/30 flex items-center justify-between gap-3">
          <div className="flex flex-col text-left">
            <span className="text-[12.5px] font-semibold text-red-200">
              Bancarrota (0 fichas)
            </span>
            <span className="text-[11px] text-red-300/80">
              Reclama 200 fichas de auxilio
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = claimBankruptcyBonus();
              onProfileChange(next);
            }}
            className="h-7 px-3 rounded-full bg-white text-black text-[11.5px] font-bold active:scale-95 transition-transform cursor-pointer"
          >
            +200 fichas
          </button>
        </div>
      )}

      {/* Sincronización de Cuenta (Safari vs PWA) */}
      <div className="mt-2.5 rounded-[18px] bg-[#141519] border border-[#22242a] p-3 flex flex-col gap-2.5 text-left">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[12px] font-semibold text-white">
              Identidad de Cuenta
            </span>
            <span className="text-[11px] text-[#7c7d85] font-mono mt-0.5">
              ID: {profile.playerId}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyPlayerId}
            className="h-7 px-2.5 rounded-full bg-[#23252a] text-white text-[11px] font-medium flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
          >
            {copiedPlayerId ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copiar ID</span>
              </>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopySyncLink}
          className="w-full h-8 rounded-full bg-[#20222a] hover:bg-[#282a35] text-white text-[11.5px] font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
        >
          {copiedSyncLink ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">¡Enlace copiado! Ábrelo en Safari o PWA</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5 text-[#fb923c]" />
              <span>Copiar enlace para sincronizar con Safari / PWA</span>
            </>
          )}
        </button>

        <form onSubmit={handleLinkAccount} className="flex items-center gap-1.5 pt-0.5">
          <input
            type="text"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="Vincular con ID o enlace ?sync=..."
            className="flex-1 h-8 rounded-full bg-black border border-[#25272e] px-3 text-[11px] text-white placeholder:text-[#6b6d76] focus:outline-none focus:border-white"
          />
          <button
            type="submit"
            className="h-8 px-3 rounded-full bg-white text-black text-[11px] font-semibold active:scale-95 transition-transform cursor-pointer shrink-0"
          >
            Vincular
          </button>
        </form>

        {linkStatusMsg && (
          <span className="text-[10.5px] text-emerald-400 font-medium px-1">
            {linkStatusMsg}
          </span>
        )}
      </div>

      {/* Statistics Section + Playstyle Diamond Radar Chart */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-0.5">
          <h2 className="text-[17px] font-semibold text-white tracking-tight">
            Statistics
          </h2>
          <span className="text-[11px] text-[#7c7d85]">
            {profile.stats.handsPlayed} manos jugadas
          </span>
        </div>

        {!hasPlayedHands && (
          <p className="text-[11px] text-[#8e9099] mb-1">
            Sin partidas aún · Juega manos para ver tu estilo
          </p>
        )}

        <div className="w-full flex flex-col items-center">
          <svg
            viewBox="0 10 360 280"
            className="w-full max-w-[300px] max-h-[210px] h-auto overflow-visible select-none"
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

            {/* Dynamic Playstyle Polygon (neutral small diamond when 0 hands played) */}
            <polygon
              points={polygonPoints}
              fill={hasPlayedHands ? 'url(#playstyle-poly-grad)' : 'rgba(148, 163, 184, 0.14)'}
              stroke={hasPlayedHands ? 'url(#playstyle-stroke-grad)' : '#475569'}
              strokeWidth="2"
              strokeLinejoin="round"
            />

            {/* Callout dashed line pointing from polygon edge to active archetype badge ONLY when hands played */}
            {activeCallout && (
              <>
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
              </>
            )}

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

      {/* SHEET 5: REAL FRIENDS */}
      {activeSheet === 'friends' && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="w-full max-w-[400px] bg-[#16171b] border border-[#262830] rounded-[28px] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="text-[16px] font-semibold text-white">
                  Amigos ({profile.friends.length})
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

            <form onSubmit={handleAddFriend} className="flex items-center gap-2">
              <input
                type="text"
                value={friendNameInput}
                onChange={(e) => setFriendNameInput(e.target.value)}
                placeholder="Nombre de tu amigo (ej. Leo)"
                maxLength={18}
                className="flex-1 h-10 rounded-full bg-black border border-[#25272e] px-4 text-[13px] text-white placeholder:text-[#7c7d85] focus:outline-none focus:border-white"
              />
              <button
                type="submit"
                className="h-10 px-4 rounded-full bg-white text-black text-[12px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </form>

            {profile.friends.length === 0 ? (
              <div className="bg-black/40 border border-[#23252a] rounded-[18px] p-4 text-center text-[12px] text-[#8e9099]">
                Aún no tienes amigos agregados · Comparte el enlace de tu sala por WhatsApp o agrega a tus amigos arriba.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto">
                {profile.friends.map((fr) => (
                  <div
                    key={fr.id}
                    className="flex items-center justify-between bg-black/40 border border-[#23252a] rounded-[16px] px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar3D avatarId={fr.avatarId} size={34} />
                      <div>
                        <div className="text-[14px] font-medium text-white">
                          {fr.name}
                        </div>
                        <div className="text-[11px] text-[#7c7d85]">Amigo</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSheet(null);
                          onOpenCreateOrInviteModal();
                        }}
                        className="h-7 px-3 rounded-full bg-white text-black text-[11px] font-semibold cursor-pointer"
                      >
                        Crear Sala
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFriend(fr.id)}
                        aria-label={`Eliminar ${fr.name}`}
                        className="w-7 h-7 rounded-full bg-[#23252a] text-[#8e9099] hover:text-white flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleShareOrCopyRoomLink}
              className="w-full h-11 rounded-full bg-[#23252a] text-white text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer"
            >
              {copiedFriendLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>¡Enlace de invitación copiado!</span>
                </>
              ) : (
                <>
                  {typeof navigator !== 'undefined' && 'share' in navigator ? (
                    <Share2 className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>
                    Compartir enlace de invitación
                    {activeRoomCode ? ` (#${activeRoomCode})` : ''}
                  </span>
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
                {t(currentLang, 'settingsTitle')}
              </span>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="w-8 h-8 rounded-full bg-[#23252a] flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Language Selection Grid */}
            <div className="bg-black/40 border border-[#23252a] rounded-[16px] p-3 flex flex-col gap-2">
              <span className="text-[11.5px] font-medium text-[#7c7d85] flex items-center gap-1.5">
                <span>🌐</span>
                <span>{t(currentLang, 'languageLabel')}</span>
              </span>
              <div className="grid grid-cols-3 gap-2">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isSelected = currentLang === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleSelectLanguage(lang.code)}
                      className={`h-10 rounded-[12px] border text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white text-black border-white font-semibold shadow-sm'
                          : 'bg-[#181a20] text-[#9ca3af] border-[#252830] hover:text-white'
                      }`}
                    >
                      <span className="text-base">{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-black/40 border border-[#23252a] rounded-[16px] p-3.5 flex flex-col gap-1.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[#7c7d85]">{t(currentLang, 'networkStatus')}</span>
                <span className="text-emerald-400 font-medium">
                  {isPartyKitConfigured
                    ? 'PartyKit Cloudflare WS'
                    : isSupabaseConfigured
                    ? 'Supabase Realtime'
                    : 'MQTT WebSockets + Local'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7c7d85]">{t(currentLang, 'turnNotifications')}</span>
                <button
                  type="button"
                  onClick={() => void requestTurnNotificationPermission()}
                  className="text-[#eab308] underline cursor-pointer"
                >
                  {getNotificationPermission() === 'granted'
                    ? t(currentLang, 'notifEnabled')
                    : t(currentLang, 'notifEnableNow')}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const reset = updateUserProfile((prev) => ({
                  ...prev,
                  xp: 0,
                  level: 1,
                  stats: { ...DEFAULT_USER_PROFILE.stats },
                }));
                onProfileChange(reset);
                setActiveSheet(null);
              }}
              className="w-full h-10 rounded-full bg-[#23252a] text-white/80 text-[12px] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 rotate-45" />
              <span>Reiniciar estadísticas a cero</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
