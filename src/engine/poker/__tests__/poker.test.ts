import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../types';
import { calculateHoldemEquity } from '../equity';
import { evaluateHoldemHand } from '../evaluator';
import { applyPlayerAction, createInitialTableState } from '../gameState';

function c(rank: Rank, suit: Suit): Card {
  return { id: `${rank}-${suit}`, rank, suit };
}

describe('Texas Holdem Hand Evaluator', () => {
  it('evaluates preflop 2-card Pair and High Card accurately', () => {
    const pocketNines = evaluateHoldemHand([c(9, 'spades'), c(9, 'hearts')]);
    expect(pocketNines.categoryName).toBe('Pair');
    expect(pocketNines.categoryRank).toBe(1);

    const aceKing = evaluateHoldemHand([c(14, 'spades'), c(13, 'hearts')]);
    expect(aceKing.categoryName).toBe('High Card');
    expect(aceKing.categoryRank).toBe(0);
  });

  it('identifies Royal Flush and Straight Flush', () => {
    const royal = evaluateHoldemHand([
      c(14, 'spades'),
      c(13, 'spades'),
      c(12, 'spades'),
      c(11, 'spades'),
      c(10, 'spades'),
      c(2, 'hearts'),
      c(3, 'clubs'),
    ]);
    expect(royal.categoryName).toBe('Royal Flush');
    expect(royal.categoryRank).toBe(9);

    const sf = evaluateHoldemHand([
      c(9, 'hearts'),
      c(8, 'hearts'),
      c(7, 'hearts'),
      c(6, 'hearts'),
      c(5, 'hearts'),
      c(14, 'clubs'),
    ]);
    expect(sf.categoryName).toBe('Straight Flush');
    expect(sf.categoryRank).toBe(8);
    expect(royal.score).toBeGreaterThan(sf.score);
  });

  it('identifies Four of a Kind, Full House, Flush, Straight, Three of a Kind, Two Pair', () => {
    const quads = evaluateHoldemHand([
      c(10, 'spades'),
      c(10, 'hearts'),
      c(10, 'diamonds'),
      c(10, 'clubs'),
      c(14, 'spades'),
    ]);
    expect(quads.categoryName).toBe('Four of a Kind');

    const boat = evaluateHoldemHand([
      c(12, 'spades'),
      c(12, 'hearts'),
      c(12, 'diamonds'),
      c(7, 'clubs'),
      c(7, 'spades'),
      c(2, 'hearts'),
    ]);
    expect(boat.categoryName).toBe('Full House');

    const wheelStraight = evaluateHoldemHand([
      c(14, 'spades'),
      c(2, 'hearts'),
      c(3, 'diamonds'),
      c(4, 'clubs'),
      c(5, 'spades'),
      c(9, 'hearts'),
    ]);
    expect(wheelStraight.categoryName).toBe('Straight');

    const twoPair = evaluateHoldemHand([
      c(11, 'spades'),
      c(11, 'hearts'),
      c(4, 'diamonds'),
      c(4, 'clubs'),
      c(14, 'spades'),
    ]);
    expect(twoPair.categoryName).toBe('Two Pair');

    expect(quads.score).toBeGreaterThan(boat.score);
    expect(boat.score).toBeGreaterThan(wheelStraight.score);
    expect(wheelStraight.score).toBeGreaterThan(twoPair.score);
  });
});

describe('Monte Carlo Equity Calculator', () => {
  it('computes preflop equity and Two Pair improvement for pocket 9s against 5 opponents', () => {
    const result = calculateHoldemEquity(
      [c(9, 'spades'), c(9, 'hearts')],
      [],
      5,
      800
    );
    // Against 5 random hands preflop, 99 wins ~23-32% and most likely improvement is Two Pair (~35-44%)
    expect(result.winPct).toBeGreaterThanOrEqual(18);
    expect(result.winPct).toBeLessThanOrEqual(40);
    expect(result.nextHandLabel).toBe('Two Pair');
    expect(result.nextHandPct).toBeGreaterThanOrEqual(28);
    expect(result.nextHandPct).toBeLessThanOrEqual(50);
  });
});

describe('Poker Table State Machine', () => {
  it('initializes 6 players with Akash as dealer, Tori SB 1, Evelyn BB 2, Hero UTG with 9s 9h', () => {
    const state = createInitialTableState();
    expect(state.players).toHaveLength(6);
    expect(state.players[state.dealerIndex].name).toBe('Akash');
    expect(state.players[4].name).toBe('Tori');
    expect(state.players[4].currentBet).toBe(1);
    expect(state.players[5].name).toBe('Evelyn');
    expect(state.players[5].currentBet).toBe(2);
    expect(state.currentTurnIndex).toBe(0); // Hero UTG
    expect(state.collectedPot).toBe(0);

    // Hero calls 2
    const nextState = applyPlayerAction(state, 'hero', { type: 'call' });
    expect(nextState.players[0].currentBet).toBe(2);
    expect(nextState.players[0].stack).toBe(198);
    expect(nextState.currentTurnIndex).toBe(1); // Emma's turn
  });

  it('supports Hero Throw-to-Fold action and advances turn sequentially through opponents', () => {
    let state = createInitialTableState('PRIMOS');
    expect(state.currentTurnIndex).toBe(0);

    // Hero throws cards to fold
    state = applyPlayerAction(state, 'hero', { type: 'fold' });
    expect(state.players[0].status).toBe('folded');
    expect(state.players[0].lastAction).toBe('Fold');
    expect(state.currentTurnIndex).toBe(1); // Advances sequentially to Emma (seat 1)

    // Emma raises to 6
    state = applyPlayerAction(state, 'bot-emma', { type: 'raise', raiseToAmount: 6 });
    expect(state.currentTurnIndex).toBe(2); // Advances to Leo (seat 2)

    // Leo folds
    state = applyPlayerAction(state, 'bot-leo', { type: 'fold' });
    expect(state.currentTurnIndex).toBe(3); // Advances to Akash (seat 3)
  });
});

