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

export interface UserProfilePreferences {
  name: string;
  avatarId: string;
  cardBackColor: CardBackColorId;
  xp: number;
  level: number;
  selectedEmote: string;
  unlockedEmotes: string[];
  stats: PlayerPlaystyleStats;
}

const PROFILE_STORAGE_KEY = 'juegos_de_cartas_profile_v1';

export const DEFAULT_USER_PROFILE: UserProfilePreferences = {
  name: 'isaac',
  avatarId: 'hero',
  cardBackColor: 'slate',
  xp: 516,
  level: 2,
  selectedEmote: '👋',
  unlockedEmotes: ['👋', '🔥', '😎', '🤝', '🍀', '🚀'],
  // Initial stats calibrated to Loose-Aggressive (LAG) matching image_2.png
  stats: {
    handsPlayed: 28,
    vpipCount: 19,
    aggressiveCount: 24,
    passiveCount: 11,
    foldCount: 9,
    handsWon: 12,
  },
};

export function loadUserProfile(): UserProfilePreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_USER_PROFILE;
  }
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(DEFAULT_USER_PROFILE));
      return DEFAULT_USER_PROFILE;
    }
    const parsed = JSON.parse(raw) as Partial<UserProfilePreferences>;
    return {
      ...DEFAULT_USER_PROFILE,
      ...parsed,
      stats: {
        ...DEFAULT_USER_PROFILE.stats,
        ...(parsed.stats ?? {}),
      },
    };
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: UserProfilePreferences): UserProfilePreferences {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      window.dispatchEvent(new CustomEvent('cartas-profile-updated', { detail: profile }));
    } catch {
      // ignore storage errors
    }
  }
  return profile;
}

export function updateUserProfile(
  updater: (prev: UserProfilePreferences) => UserProfilePreferences
): UserProfilePreferences {
  const current = loadUserProfile();
  const next = updater(current);
  // Automatically recalculate level based on XP (every 250 XP per level)
  const computedLevel = Math.max(1, Math.floor(next.xp / 250) + 1);
  return saveUserProfile({
    ...next,
    level: computedLevel,
  });
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
  const heroWon = state.winnerIds.includes(heroId);
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
  archetype: PlaystyleArchetype;
}

/**
 * Computes normalized [0.15 .. 0.95] diamond radar axis values and active archetype
 * ('LAG', 'TAG', 'ROCK', 'FISH') from the player's tracked statistics.
 */
export function computePlaystyleMetrics(stats: PlayerPlaystyleStats): PlaystyleRadarMetrics {
  const totalDecisions = Math.max(
    1,
    stats.aggressiveCount + stats.passiveCount + stats.foldCount
  );
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
