export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export type GameMode = 'texas-holdem' | 'blackjack' | 'truco' | 'uno';

export type PlayerStatus = 'active' | 'folded' | 'all-in' | 'out';

export type LastAction = 'Fold' | 'Check' | 'Call' | 'Raise' | null;

export interface Player {
  id: string;
  name: string;
  avatarId: string;
  stack: number;
  currentBet: number;
  totalHandBet: number;
  holeCards: Card[];
  status: PlayerStatus;
  lastAction: LastAction;
  isBot: boolean;
  seatIndex: number;
}

export type HandRankCategory =
  | 'High Card'
  | 'Pair'
  | 'Two Pair'
  | 'Three of a Kind'
  | 'Straight'
  | 'Flush'
  | 'Full House'
  | 'Four of a Kind'
  | 'Straight Flush'
  | 'Royal Flush';

export interface EvaluatedHand {
  categoryRank: number; // 0 (High Card) .. 9 (Royal Flush)
  categoryName: HandRankCategory;
  score: number; // Deterministic numeric score for comparing any two hands
  bestFive: Card[];
}

export interface EquityResult {
  winPct: number;
  tiePct: number;
  nextHandLabel: HandRankCategory;
  nextHandPct: number;
}
