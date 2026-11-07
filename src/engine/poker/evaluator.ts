import type { Card, EvaluatedHand, HandRankCategory, Rank } from '../types';

export const HAND_CATEGORIES: HandRankCategory[] = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
  'Royal Flush',
];

function encodeTiebreaker(categoryRank: number, kickers: number[]): number {
  // Base-15 positional encoding so categoryRank + up to 5 kickers fit cleanly in a standard JS number
  let value = categoryRank;
  for (let i = 0; i < 5; i++) {
    value = value * 15 + (kickers[i] ?? 0);
  }
  return value;
}

export function evaluateFiveCardHand(cards: Card[]): EvaluatedHand {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank);
  const suits = sorted.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  // Check for straight (including A-2-3-4-5 wheel)
  let isStraight = false;
  let straightHigh = ranks[0];

  const uniqueRanks = Array.from(new Set(ranks));
  if (uniqueRanks.length === 5) {
    if (ranks[0] - ranks[4] === 4) {
      isStraight = true;
      straightHigh = ranks[0];
    } else if (
      ranks[0] === 14 &&
      ranks[1] === 5 &&
      ranks[2] === 4 &&
      ranks[3] === 3 &&
      ranks[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return {
        categoryRank: 9,
        categoryName: 'Royal Flush',
        score: encodeTiebreaker(9, [14, 13, 12, 11, 10]),
        bestFive: sorted,
      };
    }
    return {
      categoryRank: 8,
      categoryName: 'Straight Flush',
      score: encodeTiebreaker(8, [straightHigh]),
      bestFive: sorted,
    };
  }

  // Count rank frequencies
  const counts = new Map<Rank, number>();
  for (const r of ranks) {
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }

  // Sort groups by frequency desc, then rank desc
  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const groupRanks = groups.map((g) => g[0]);
  const topCount = groups[0][1];
  const secondCount = groups[1]?.[1] ?? 0;

  if (topCount === 4) {
    return {
      categoryRank: 7,
      categoryName: 'Four of a Kind',
      score: encodeTiebreaker(7, groupRanks),
      bestFive: sorted,
    };
  }

  if (topCount === 3 && secondCount === 2) {
    return {
      categoryRank: 6,
      categoryName: 'Full House',
      score: encodeTiebreaker(6, groupRanks),
      bestFive: sorted,
    };
  }

  if (isFlush) {
    return {
      categoryRank: 5,
      categoryName: 'Flush',
      score: encodeTiebreaker(5, ranks),
      bestFive: sorted,
    };
  }

  if (isStraight) {
    return {
      categoryRank: 4,
      categoryName: 'Straight',
      score: encodeTiebreaker(4, [straightHigh]),
      bestFive: sorted,
    };
  }

  if (topCount === 3) {
    return {
      categoryRank: 3,
      categoryName: 'Three of a Kind',
      score: encodeTiebreaker(3, groupRanks),
      bestFive: sorted,
    };
  }

  if (topCount === 2 && secondCount === 2) {
    return {
      categoryRank: 2,
      categoryName: 'Two Pair',
      score: encodeTiebreaker(2, groupRanks),
      bestFive: sorted,
    };
  }

  if (topCount === 2) {
    return {
      categoryRank: 1,
      categoryName: 'Pair',
      score: encodeTiebreaker(1, groupRanks),
      bestFive: sorted,
    };
  }

  return {
    categoryRank: 0,
    categoryName: 'High Card',
    score: encodeTiebreaker(0, ranks),
    bestFive: sorted,
  };
}

/**
 * Evaluates 2 to 7 cards (e.g. 2 hole cards preflop, or 5..7 cards postflop).
 */
export function evaluateHoldemHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    const sorted = [...cards].sort((a, b) => b.rank - a.rank);
    const counts = new Map<Rank, number>();
    for (const c of sorted) {
      counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
    }
    const groups = Array.from(counts.entries()).sort((a, b) =>
      b[1] !== a[1] ? b[1] - a[1] : b[0] - a[0]
    );
    const groupRanks = groups.map((g) => g[0]);
    const topCount = groups[0]?.[1] ?? 0;
    const secondCount = groups[1]?.[1] ?? 0;

    if (topCount === 4) {
      return {
        categoryRank: 7,
        categoryName: 'Four of a Kind',
        score: encodeTiebreaker(7, groupRanks),
        bestFive: sorted,
      };
    }
    if (topCount === 3) {
      return {
        categoryRank: 3,
        categoryName: 'Three of a Kind',
        score: encodeTiebreaker(3, groupRanks),
        bestFive: sorted,
      };
    }
    if (topCount === 2 && secondCount === 2) {
      return {
        categoryRank: 2,
        categoryName: 'Two Pair',
        score: encodeTiebreaker(2, groupRanks),
        bestFive: sorted,
      };
    }
    if (topCount === 2) {
      return {
        categoryRank: 1,
        categoryName: 'Pair',
        score: encodeTiebreaker(1, groupRanks),
        bestFive: sorted,
      };
    }
    return {
      categoryRank: 0,
      categoryName: 'High Card',
      score: encodeTiebreaker(0, groupRanks),
      bestFive: sorted,
    };
  }

  if (cards.length === 5) {
    return evaluateFiveCardHand(cards);
  }

  // Generate all 5-card combinations from 6 or 7 cards
  let best: EvaluatedHand | null = null;
  const n = cards.length;

  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            const candidate = evaluateFiveCardHand([
              cards[i],
              cards[j],
              cards[k],
              cards[l],
              cards[m],
            ]);
            if (!best || candidate.score > best.score) {
              best = candidate;
            }
          }
        }
      }
    }
  }

  return best!;
}
