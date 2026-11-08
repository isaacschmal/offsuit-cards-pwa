import type { PlayerActionInput, PokerTableState } from '../engine/poker/gameState';

export type CardBackColorId = 'slate' | 'indigo' | 'emerald' | 'crimson';

export interface CardBackTheme {
  id: CardBackColorId;
  name: string;
  hex: string;
  accentHex: string;
}

export const CARD_BACK_THEMES: Record<CardBackColorId, CardBackTheme> = {
  slate: {
    id: 'slate',
    name: 'Clásico Gris',
    hex: '#9aa3aa',
    accentHex: '#7d8790',
  },
  indigo: {
    id: 'indigo',
    name: 'Índigo Real',
    hex: '#6366f1',
    accentHex: '#4f46e5',
  },
  emerald: {
    id: 'emerald',
    name: 'Esmeralda Casino',
    hex: '#10b981',
    accentHex: '#059669',
  },
  crimson: {
    id: 'crimson',
    name: 'Carmesí Nocturno',
    hex: '#e11d48',
    accentHex: '#be123c',
  },
};

export const CARD_BACK_ORDER: CardBackColorId[] = ['slate', 'indigo', 'emerald', 'crimson'];

export type PlaystyleArchetype = 'LAG' | 'TAG' | 'ROCK' | 'FISH';

export interface PlayerPlaystyleStats {
  handsPlayed: number;
  vpipCount: number; // Voluntarily put chips in pot (call or raise)
  aggressiveCount: number; // Raises / bets
  passiveCount: number; // Calls / checks
  foldCount: number;
  handsWon: number;
}

export interface FriendEntry {
  id: string;
  name: string;
  avatarId: string;
  addedAt: number;
}

export interface KnownPlayerEntry {
  id: string;
  name: string;
  avatarId: string;
  xp: number;
  updatedAt: number;
}

export interface UserProfilePreferences {
  playerId: string;
  name: string;
  hasSetCustomName: boolean;
  avatarId: string;
  cardBackColor: CardBackColorId;
  xp: number;
  level: number;
  bankroll: number;
  selectedEmote: string;
  unlockedEmotes: string[];
  friends: FriendEntry[];
  stats: PlayerPlaystyleStats;
}

export const PROFILE_STORAGE_KEY = 'juegos_de_cartas_profile_v3';
const PROFILE_STORAGE_KEY_V2 = 'juegos_de_cartas_profile_v2';
const KNOWN_PLAYERS_STORAGE_KEY = 'cartas_known_players_v2';

export function generatePlayerId(): string {
  return 'p_' + Math.random().toString(36).slice(2, 10);
}

export const DEFAULT_USER_PROFILE: UserProfilePreferences = {
  playerId: generatePlayerId(),
  name: 'Jugador',
  hasSetCustomName: false,
  avatarId: 'hero',
  cardBackColor: 'slate',
  xp: 0,
  level: 1,
  bankroll: 1000,
  selectedEmote: '👋',
  unlockedEmotes: ['👋', '🔥', '😎', '🤝', '🍀', '🚀'],
  friends: [],
  stats: {
    handsPlayed: 0,
    vpipCount: 0,
    aggressiveCount: 0,
    passiveCount: 0,
    foldCount: 0,
    handsWon: 0,
  },
};

let memoryUserProfile: UserProfilePreferences | null = null;

export function loadUserProfile(): UserProfilePreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryUserProfile ?? DEFAULT_USER_PROFILE;
  }
  try {
    let raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    let isMigrating = false;

    // Check previous v2 storage if v3 is not found yet
    if (!raw) {
      const v2Raw = window.localStorage.getItem(PROFILE_STORAGE_KEY_V2);
      if (v2Raw) {
        raw = v2Raw;
        isMigrating = true;
      }
    }

    if (!raw) {
      const fresh: UserProfilePreferences = {
        ...DEFAULT_USER_PROFILE,
        playerId: generatePlayerId(),
        bankroll: 1000,
        friends: [],
        stats: { ...DEFAULT_USER_PROFILE.stats },
      };
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(fresh));
      memoryUserProfile = fresh;
      return fresh;
    }

    const parsed = JSON.parse(raw) as Partial<UserProfilePreferences>;
    const resolvedPlayerId =
      typeof parsed.playerId === 'string' && parsed.playerId.trim().length > 0
        ? parsed.playerId
        : generatePlayerId();

    // When migrating or for new users: if previous bankroll was the old 200 default or < 1000, upgrade to 1000!
    let resolvedBankroll =
      typeof parsed.bankroll === 'number' && !isNaN(parsed.bankroll)
        ? Math.max(0, Math.round(parsed.bankroll))
        : 1000;

    if (isMigrating && resolvedBankroll <= 200) {
      resolvedBankroll = 1000;
    }

    const resolved: UserProfilePreferences = {
      ...DEFAULT_USER_PROFILE,
      ...parsed,
      playerId: resolvedPlayerId,
      hasSetCustomName: Boolean(parsed.hasSetCustomName),
      bankroll: resolvedBankroll,
      friends: Array.isArray(parsed.friends) ? parsed.friends : [],
      stats: {
        ...DEFAULT_USER_PROFILE.stats,
        ...(parsed.stats ?? {}),
      },
    };

    if (isMigrating || !parsed.playerId) {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(resolved));
    }
    memoryUserProfile = resolved;
    return resolved;
  } catch {
    return memoryUserProfile ?? DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: UserProfilePreferences): UserProfilePreferences {
  const safeBankroll =
    typeof profile.bankroll === 'number' && !isNaN(profile.bankroll)
      ? Math.max(0, Math.round(profile.bankroll))
      : 1000;
  const normalized: UserProfilePreferences = {
    ...profile,
    bankroll: safeBankroll,
  };
  memoryUserProfile = normalized;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));
      upsertKnownPlayer({
        id: normalized.playerId,
        name: normalized.name || 'Jugador',
        avatarId: normalized.avatarId,
        xp: normalized.xp,
      });
      window.dispatchEvent(new CustomEvent('cartas-profile-updated', { detail: normalized }));
    } catch {
      // ignore storage errors
    }
  }
  return normalized;
}

export function updateUserProfile(
  updater: (prev: UserProfilePreferences) => UserProfilePreferences
): UserProfilePreferences {
  const current = loadUserProfile();
  const next = updater(current);
  // Automatically recalculate level based on XP (every 250 XP per level)
  const computedLevel = Math.max(1, Math.floor(next.xp / 250) + 1);
  const safeBankroll =
    typeof next.bankroll === 'number' && !isNaN(next.bankroll)
      ? Math.max(0, Math.round(next.bankroll))
      : 1000;
  return saveUserProfile({
    ...next,
    level: computedLevel,
    bankroll: safeBankroll,
  });
}

/**
 * Deducts the table buy-in from the player's global wallet upon sitting at a table.
 * Returns the actual amount deducted (capped to player's current bankroll).
 */
export function deductTableBuyIn(targetBuyIn: number): {
  paid: number;
  remainingBankroll: number;
} {
  const profile = loadUserProfile();
  const paid = Math.min(Math.max(0, Math.round(targetBuyIn)), profile.bankroll);
  const updated = updateUserProfile((prev) => ({
    ...prev,
    bankroll: Math.max(0, prev.bankroll - paid),
  }));
  return { paid, remainingBankroll: updated.bankroll };
}

/**
 * Returns table chips back into the player's global wallet upon leaving the table.
 */
export function returnTableStack(finalStack: number): UserProfilePreferences {
  const safeCredit = Math.max(0, Math.round(finalStack));
  return updateUserProfile((prev) => ({
    ...prev,
    bankroll: prev.bankroll + safeCredit,
  }));
}

/**
 * Claims a 200-chip bankruptcy recovery bonus when player has 0 chips in their wallet.
 */
export function claimBankruptcyBonus(): UserProfilePreferences {
  return updateUserProfile((prev) => ({
    ...prev,
    bankroll: prev.bankroll <= 0 ? 200 : prev.bankroll + 200,
  }));
}

export function savePlayerBankroll(stack: number): UserProfilePreferences {
  const safeStack = Math.max(0, Math.round(stack));
  return updateUserProfile((prev) => ({
    ...prev,
    bankroll: safeStack,
  }));
}

export function loadKnownPlayers(): KnownPlayerEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(KNOWN_PLAYERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as KnownPlayerEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function upsertKnownPlayer(entry: {
  id: string;
  name: string;
  avatarId: string;
  xp?: number;
}): KnownPlayerEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  if (!entry.id || entry.id.startsWith('bot-') || entry.id.startsWith('empty-')) {
    return loadKnownPlayers();
  }
  try {
    const existing = loadKnownPlayers();
    const idx = existing.findIndex((p) => p.id === entry.id);
    let updated: KnownPlayerEntry[];
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = {
        ...existing[idx],
        name: entry.name || existing[idx].name,
        avatarId: entry.avatarId || existing[idx].avatarId,
        xp: typeof entry.xp === 'number' ? Math.max(existing[idx].xp, entry.xp) : existing[idx].xp,
        updatedAt: Date.now(),
      };
    } else {
      updated = [
        ...existing,
        {
          id: entry.id,
          name: entry.name || 'Jugador',
          avatarId: entry.avatarId || 'hero',
          xp: entry.xp ?? 0,
          updatedAt: Date.now(),
        },
      ];
    }
    window.localStorage.setItem(KNOWN_PLAYERS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function cycleCardBackColor(): UserProfilePreferences {
  return updateUserProfile((prev) => {
    const idx = CARD_BACK_ORDER.indexOf(prev.cardBackColor);
    const nextColor = CARD_BACK_ORDER[(idx + 1) % CARD_BACK_ORDER.length];
    return {
      ...prev,
      cardBackColor: nextColor,
    };
  });
}

export function recordPlayerActionStats(action: PlayerActionInput): UserProfilePreferences {
  return updateUserProfile((prev) => {
    const stats = { ...prev.stats };
    if (action.type === 'raise') {
      stats.aggressiveCount += 1;
      stats.vpipCount += 1;
    } else if (action.type === 'call') {
      stats.passiveCount += 1;
      stats.vpipCount += 1;
    } else if (action.type === 'check') {
      stats.passiveCount += 1;
    } else if (action.type === 'fold') {
      stats.foldCount += 1;
    }
    return {
      ...prev,
      xp: prev.xp + 4,
      stats,
    };
  });
}

export function recordHandCompletedStats(
  state: PokerTableState,
  heroId = 'hero'
): UserProfilePreferences {
  const profile = loadUserProfile();
  const heroWon =
    state.winnerIds.includes(heroId) ||
    state.winnerIds.includes(profile.playerId) ||
    (state.players[0] && state.winnerIds.includes(state.players[0].id));

  return updateUserProfile((prev) => ({
    ...prev,
    xp: prev.xp + (heroWon ? 25 : 8),
    stats: {
      ...prev.stats,
      handsPlayed: prev.stats.handsPlayed + 1,
      handsWon: prev.stats.handsWon + (heroWon ? 1 : 0),
    },
  }));
}

export interface PlaystyleRadarMetrics {
  aggressive: number; // 0.15 .. 1.0 (Top vertex)
  loose: number; // 0.15 .. 1.0 (Right vertex)
  passive: number; // 0.15 .. 1.0 (Bottom vertex)
  tight: number; // 0.15 .. 1.0 (Left vertex)
  archetype: PlaystyleArchetype | null;
}

/**
 * Computes normalized [0.15 .. 0.95] diamond radar axis values and active archetype
 * ('LAG', 'TAG', 'ROCK', 'FISH', or null when no hands played yet) from tracked statistics.
 */
export function computePlaystyleMetrics(stats: PlayerPlaystyleStats): PlaystyleRadarMetrics {
  const rawTotalActions =
    stats.aggressiveCount + stats.passiveCount + stats.foldCount;

  if (stats.handsPlayed === 0 || rawTotalActions === 0) {
    return {
      aggressive: 0.18,
      loose: 0.18,
      passive: 0.18,
      tight: 0.18,
      archetype: null,
    };
  }

  const totalDecisions = Math.max(1, rawTotalActions);
  const activeDecisions = Math.max(1, stats.aggressiveCount + stats.passiveCount);

  // Looseness ratio: how often player enters pots vs folds
  const rawLoose = (stats.vpipCount + stats.aggressiveCount * 0.3) / (totalDecisions + 4);
  const loose = Math.min(0.92, Math.max(0.22, rawLoose * 1.15));
  const tight = Math.min(0.92, Math.max(0.22, 1.08 - loose));

  // Aggression ratio: raises vs passive calls/checks
  const rawAggressive = stats.aggressiveCount / activeDecisions;
  const aggressive = Math.min(0.92, Math.max(0.22, rawAggressive * 1.2));
  const passive = Math.min(0.92, Math.max(0.22, 1.08 - aggressive));

  const isLoose = loose >= tight;
  const isAggressive = aggressive >= passive;

  let archetype: PlaystyleArchetype = 'LAG';
  if (isLoose && isAggressive) {
    archetype = 'LAG';
  } else if (!isLoose && isAggressive) {
    archetype = 'TAG';
  } else if (!isLoose && !isAggressive) {
    archetype = 'ROCK';
  } else {
    archetype = 'FISH';
  }

  return {
    aggressive,
    loose,
    passive,
    tight,
    archetype,
  };
}
