import { createStandardDeck } from '../deck';
import type { Card, EquityResult } from '../types';
import { evaluateHoldemHand, HAND_CATEGORIES } from './evaluator';

/**
 * Fast Monte Carlo simulator for Texas Hold'em win equity & next-hand hit probability.
 * Matches Offsuit's HUD View 2 (e.g., Win 26%, Two Pair 39%).
 */
export function calculateHoldemEquity(
  holeCards: Card[],
  communityCards: Card[],
  activeOpponents: number,
  iterations = 600
): EquityResult {
  if (holeCards.length < 2) {
    return {
      winPct: 0,
      tiePct: 0,
      nextHandLabel: 'Pair',
      nextHandPct: 0,
    };
  }

  const currentEval = evaluateHoldemHand([...holeCards, ...communityCards]);
  const numOpponents = Math.max(1, activeOpponents);

  const knownIds = new Set<string>([
    ...holeCards.map((c) => c.id),
    ...communityCards.map((c) => c.id),
  ]);
  const remainingDeck = createStandardDeck().filter((c) => !knownIds.has(c.id));

  const cardsNeededForBoard = Math.max(0, 5 - communityCards.length);
  const totalCardsNeeded = cardsNeededForBoard + numOpponents * 2;

  let wins = 0;
  let ties = 0;
  const categoryCounts = new Array<number>(HAND_CATEGORIES.length).fill(0);

  // Partial Fisher-Yates sample per iteration for speed
  const pool = [...remainingDeck];
  const poolLen = pool.length;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < totalCardsNeeded; i++) {
      const r = i + Math.floor(Math.random() * (poolLen - i));
      const tmp = pool[i];
      pool[i] = pool[r];
      pool[r] = tmp;
    }

    const simBoard =
      cardsNeededForBoard > 0
        ? [...communityCards, ...pool.slice(0, cardsNeededForBoard)]
        : communityCards;

    const heroEval = evaluateHoldemHand([...holeCards, ...simBoard]);
    categoryCounts[heroEval.categoryRank]++;

    let heroBeatsAll = true;
    let heroTiedBest = false;

    let offset = cardsNeededForBoard;
    for (let opp = 0; opp < numOpponents; opp++) {
      const oppHole = [pool[offset], pool[offset + 1]];
      offset += 2;
      const oppEval = evaluateHoldemHand([...oppHole, ...simBoard]);

      if (oppEval.score > heroEval.score) {
        heroBeatsAll = false;
        heroTiedBest = false;
        break;
      } else if (oppEval.score === heroEval.score) {
        heroTiedBest = true;
      }
    }

    if (heroBeatsAll) {
      if (heroTiedBest) {
        ties++;
      } else {
        wins++;
      }
    }
  }

  const winPct = Math.round(((wins + ties * 0.5) / iterations) * 100);
  const tiePct = Math.round((ties / iterations) * 100);

  // Determine the most likely improvement hand above current categoryRank
  let bestNextRank = Math.min(9, currentEval.categoryRank + 1);
  let bestNextCount = -1;

  for (let r = currentEval.categoryRank + 1; r < HAND_CATEGORIES.length; r++) {
    if (categoryCounts[r] > bestNextCount) {
      bestNextCount = categoryCounts[r];
      bestNextRank = r;
    }
  }

  // If already on the river (no cards left to come) or no improvement found, show current hand category at 100%
  if (cardsNeededForBoard === 0 || bestNextCount <= 0) {
    const currentPct = Math.round(
      (categoryCounts[currentEval.categoryRank] / iterations) * 100
    );
    return {
      winPct,
      tiePct,
      nextHandLabel: currentEval.categoryName,
      nextHandPct: Math.max(1, currentPct),
    };
  }

  const nextHandPct = Math.round((bestNextCount / iterations) * 100);

  return {
    winPct,
    tiePct,
    nextHandLabel: HAND_CATEGORIES[bestNextRank],
    nextHandPct,
  };
}
