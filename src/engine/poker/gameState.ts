import { createStandardDeck, shuffleDeck } from '../deck';
import type { Card, Player } from '../types';
import { evaluateHoldemHand } from './evaluator';

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface PokerTableState {
  roomId: string;
  players: Player[]; // index 0 is local hero, 1..5 are top row left-to-right (Emma, Leo, Akash, Tori, Evelyn)
  deck: Card[];
  communityCards: Card[]; // 0, 3, 4, or 5 revealed cards
  collectedPot: number; // Pot swept into center from completed streets (shown below 5th community card)
  sidePots: SidePot[];
  dealerIndex: number;
  currentTurnIndex: number;
  street: Street;
  smallBlind: number;
  bigBlind: number;
  currentHighestBet: number;
  minRaiseTo: number;
  lastRaiseIncrement: number;
  actedPlayerIds: string[];
  winnerIds: string[];
  winningHandName: string | null;
  handNumber: number;
}

export interface PlayerActionInput {
  type: 'fold' | 'check' | 'call' | 'raise';
  raiseToAmount?: number; // Total street bet amount when raising (e.g. "Raise 4" means raiseToAmount = 4)
}

export const DEFAULT_OPPONENTS = [
  { id: 'bot-emma', name: 'Emma', avatarId: 'emma' },
  { id: 'bot-leo', name: 'Leo', avatarId: 'leo' },
  { id: 'bot-akash', name: 'Akash', avatarId: 'akash' },
  { id: 'bot-tori', name: 'Tori', avatarId: 'tori' },
  { id: 'bot-evelyn', name: 'Evelyn', avatarId: 'evelyn' },
];

export function createInitialTableState(roomId = 'local-offsuit'): PokerTableState {
  const players: Player[] = [
    {
      id: 'hero',
      name: 'You',
      avatarId: 'hero',
      stack: 200,
      currentBet: 0,
      totalHandBet: 0,
      holeCards: [],
      status: 'active',
      lastAction: null,
      isBot: false,
      seatIndex: 0,
    },
    ...DEFAULT_OPPONENTS.map((opp, idx) => ({
      id: opp.id,
      name: opp.name,
      avatarId: opp.avatarId,
      stack: 200,
      currentBet: 0,
      totalHandBet: 0,
      holeCards: [],
      status: 'active' as const,
      lastAction: null,
      isBot: true,
      seatIndex: idx + 1,
    })),
  ];

  const baseState: PokerTableState = {
    roomId,
    players,
    deck: [],
    communityCards: [],
    collectedPot: 0,
    sidePots: [],
    dealerIndex: 2, // So startNewHand advances dealerIndex to 3 (Akash), matching IMG_8408!
    currentTurnIndex: 0,
    street: 'preflop',
    smallBlind: 1,
    bigBlind: 2,
    currentHighestBet: 2,
    minRaiseTo: 4,
    lastRaiseIncrement: 2,
    actedPlayerIds: [],
    winnerIds: [],
    winningHandName: null,
    handNumber: 0,
  };

  return startNewHand(baseState, true);
}

function findNextActiveIndex(players: Player[], fromIndex: number): number {
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIndex + offset) % n;
    if (players[idx].status === 'active') {
      return idx;
    }
  }
  return fromIndex;
}

function findNextNonOutIndex(players: Player[], fromIndex: number): number {
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIndex + offset) % n;
    if (players[idx].status !== 'out' && players[idx].stack > 0) {
      return idx;
    }
  }
  return 0;
}

export function startNewHand(
  prevState: PokerTableState,
  useOpeningSeed = false
): PokerTableState {
  // Replenish busted players so game never deadlocks
  const refreshedPlayers: Player[] = prevState.players.map((p) => ({
    ...p,
    stack: p.stack <= 0 ? 200 : p.stack,
    currentBet: 0,
    totalHandBet: 0,
    holeCards: [] as Card[],
    status: 'active',
    lastAction: null,
  }));

  const dealerIndex = findNextNonOutIndex(refreshedPlayers, prevState.dealerIndex);
  const sbIndex = findNextNonOutIndex(refreshedPlayers, dealerIndex);
  const bbIndex = findNextNonOutIndex(refreshedPlayers, sbIndex);
  const utgIndex = findNextNonOutIndex(refreshedPlayers, bbIndex);

  let deck = shuffleDeck(createStandardDeck());

  if (useOpeningSeed) {
    // Seed the opening hand so Hero gets 9♠ 9♥ and board has J♥ K♥ 6♥ 7♦ on top of deck,
    // matching the exact Offsuit reference screenshots (IMG_8408 - IMG_8413)
    const pinnedIds = [
      '9-spades',
      '9-hearts', // Hero hole cards
      '14-diamonds',
      '13-spades', // Emma hole cards (strong hand so she raises like IMG_8411)
      '7-clubs',
      '2-diamonds', // Leo
      '10-clubs',
      '4-spades', // Akash
      '8-diamonds',
      '5-clubs', // Tori
      '12-clubs',
      '6-spades', // Evelyn
      '11-hearts', // Flop 1: J♥
      '13-hearts', // Flop 2: K♥
      '6-hearts', // Flop 3: 6♥
      '7-diamonds', // Turn: 7♦
    ];
    const cardMap = new Map(deck.map((c) => [c.id, c]));
    const pinnedCards = pinnedIds.map((id) => cardMap.get(id)!).filter(Boolean);
    const rest = deck.filter((c) => !pinnedIds.includes(c.id));
    deck = [...pinnedCards, ...rest];
  }

  let deckCursor = 0;
  const playersWithCards = refreshedPlayers.map((p) => {
    const holeCards = [deck[deckCursor], deck[deckCursor + 1]];
    deckCursor += 2;
    return {
      ...p,
      holeCards,
    };
  });

  // Post Small Blind and Big Blind
  const sbPlayer = playersWithCards[sbIndex];
  const sbAmount = Math.min(prevState.smallBlind, sbPlayer.stack);
  playersWithCards[sbIndex] = {
    ...sbPlayer,
    stack: sbPlayer.stack - sbAmount,
    currentBet: sbAmount,
    totalHandBet: sbAmount,
    status: sbPlayer.stack - sbAmount === 0 ? 'all-in' : 'active',
  };

  const bbPlayer = playersWithCards[bbIndex];
  const bbAmount = Math.min(prevState.bigBlind, bbPlayer.stack);
  playersWithCards[bbIndex] = {
    ...bbPlayer,
    stack: bbPlayer.stack - bbAmount,
    currentBet: bbAmount,
    totalHandBet: bbAmount,
    status: bbPlayer.stack - bbAmount === 0 ? 'all-in' : 'active',
  };

  return {
    ...prevState,
    players: playersWithCards,
    deck: deck.slice(deckCursor),
    communityCards: [],
    collectedPot: 0,
    sidePots: [],
    dealerIndex,
    currentTurnIndex: utgIndex,
    street: 'preflop',
    currentHighestBet: bbAmount,
    minRaiseTo: bbAmount + prevState.bigBlind,
    lastRaiseIncrement: prevState.bigBlind,
    actedPlayerIds: [],
    winnerIds: [],
    winningHandName: null,
    handNumber: prevState.handNumber + 1,
  };
}

export function getTotalPot(state: PokerTableState): number {
  const streetBets = state.players.reduce((sum, p) => sum + p.currentBet, 0);
  return state.collectedPot + streetBets;
}

export function computeSidePots(players: Player[]): SidePot[] {
  const contributors = players.filter((p) => p.totalHandBet > 0);
  if (contributors.length === 0) return [];

  const levels = Array.from(new Set(contributors.map((p) => p.totalHandBet))).sort(
    (a, b) => a - b
  );

  const pots: SidePot[] = [];
  let prevLevel = 0;

  for (const level of levels) {
    const slice = level - prevLevel;
    if (slice <= 0) continue;

    const involved = contributors.filter((p) => p.totalHandBet >= level);
    const amount = slice * involved.length;
    const eligiblePlayerIds = involved
      .filter((p) => p.status !== 'folded')
      .map((p) => p.id);

    pots.push({ amount, eligiblePlayerIds });
    prevLevel = level;
  }

  return pots;
}

function resolveShowdown(state: PokerTableState): PokerTableState {
  const totalStreetBets = state.players.reduce((sum, p) => sum + p.currentBet, 0);
  const finalPot = state.collectedPot + totalStreetBets;

  const playersClearedBets = state.players.map((p) => ({
    ...p,
    currentBet: 0,
  }));

  const contenders = playersClearedBets.filter((p) => p.status !== 'folded');

  if (contenders.length === 1) {
    const soleWinner = contenders[0];
    const updatedPlayers = playersClearedBets.map((p) =>
      p.id === soleWinner.id ? { ...p, stack: p.stack + finalPot } : p
    );
    return {
      ...state,
      players: updatedPlayers,
      collectedPot: finalPot,
      street: 'showdown',
      winnerIds: [soleWinner.id],
      winningHandName: null,
    };
  }

  // Evaluate all contenders' 7-card hands
  const evalMap = new Map<string, ReturnType<typeof evaluateHoldemHand>>();
  for (const c of contenders) {
    evalMap.set(c.id, evaluateHoldemHand([...c.holeCards, ...state.communityCards]));
  }

  const sidePots = computeSidePots(playersClearedBets);
  const winnings = new Map<string, number>();
  const overallWinnerIds = new Set<string>();
  let topHandName: string | null = null;
  let topHandScore = -1;

  for (const pot of sidePots) {
    const eligible = pot.eligiblePlayerIds.filter((id) => evalMap.has(id));
    if (eligible.length === 0) continue;

    let bestScore = -1;
    let potWinners: string[] = [];

    for (const id of eligible) {
      const ev = evalMap.get(id)!;
      if (ev.score > bestScore) {
        bestScore = ev.score;
        potWinners = [id];
      } else if (ev.score === bestScore) {
        potWinners.push(id);
      }
      if (ev.score > topHandScore) {
        topHandScore = ev.score;
        topHandName = ev.categoryName;
      }
    }

    const share = Math.floor(pot.amount / potWinners.length);
    const remainder = pot.amount - share * potWinners.length;

    potWinners.forEach((id, idx) => {
      overallWinnerIds.add(id);
      const extra = idx === 0 ? remainder : 0;
      winnings.set(id, (winnings.get(id) ?? 0) + share + extra);
    });
  }

  const updatedPlayers = playersClearedBets.map((p) => {
    const won = winnings.get(p.id) ?? 0;
    return won > 0 ? { ...p, stack: p.stack + won } : p;
  });

  return {
    ...state,
    players: updatedPlayers,
    collectedPot: finalPot,
    sidePots,
    street: 'showdown',
    winnerIds: Array.from(overallWinnerIds),
    winningHandName: topHandName,
  };
}

function advanceStreetOrShowdown(state: PokerTableState): PokerTableState {
  const streetBets = state.players.reduce((sum, p) => sum + p.currentBet, 0);
  const newCollectedPot = state.collectedPot + streetBets;

  const resetPlayers = state.players.map((p) => ({
    ...p,
    currentBet: 0,
    lastAction: p.status === 'folded' ? ('Fold' as const) : null,
  }));

  const nonFolded = resetPlayers.filter((p) => p.status !== 'folded');
  if (nonFolded.length <= 1) {
    return resolveShowdown({
      ...state,
      players: resetPlayers,
      collectedPot: newCollectedPot,
    });
  }

  const activeCanAct = resetPlayers.filter((p) => p.status === 'active');

  let nextStreet: Street = 'showdown';
  let newCommunity = [...state.communityCards];
  let newDeck = [...state.deck];

  if (state.street === 'preflop') {
    nextStreet = 'flop';
    newCommunity = [...newCommunity, ...newDeck.slice(0, 3)];
    newDeck = newDeck.slice(3);
  } else if (state.street === 'flop') {
    nextStreet = 'turn';
    newCommunity = [...newCommunity, newDeck[0]];
    newDeck = newDeck.slice(1);
  } else if (state.street === 'turn') {
    nextStreet = 'river';
    newCommunity = [...newCommunity, newDeck[0]];
    newDeck = newDeck.slice(1);
  } else {
    nextStreet = 'showdown';
  }

  if (nextStreet === 'showdown') {
    return resolveShowdown({
      ...state,
      players: resetPlayers,
      communityCards: newCommunity,
      deck: newDeck,
      collectedPot: newCollectedPot,
    });
  }

  // If fewer than 2 players can still make actions (everyone else is all-in), run out remaining board to showdown
  if (activeCanAct.length <= 1) {
    let runoutCommunity = [...newCommunity];
    let runoutDeck = [...newDeck];
    while (runoutCommunity.length < 5 && runoutDeck.length > 0) {
      runoutCommunity.push(runoutDeck[0]);
      runoutDeck = runoutDeck.slice(1);
    }
    return resolveShowdown({
      ...state,
      players: resetPlayers,
      communityCards: runoutCommunity,
      deck: runoutDeck,
      collectedPot: newCollectedPot,
    });
  }

  const firstToAct = findNextActiveIndex(resetPlayers, state.dealerIndex);

  return {
    ...state,
    players: resetPlayers,
    communityCards: newCommunity,
    deck: newDeck,
    collectedPot: newCollectedPot,
    street: nextStreet,
    currentTurnIndex: firstToAct,
    currentHighestBet: 0,
    minRaiseTo: state.bigBlind,
    lastRaiseIncrement: state.bigBlind,
    actedPlayerIds: [],
  };
}

export function applyPlayerAction(
  state: PokerTableState,
  playerId: string,
  action: PlayerActionInput
): PokerTableState {
  if (state.street === 'showdown') return state;

  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1 || playerIdx !== state.currentTurnIndex) {
    return state;
  }

  const player = state.players[playerIdx];
  if (player.status !== 'active') return state;

  const updatedPlayers = [...state.players];
  let currentHighestBet = state.currentHighestBet;
  let lastRaiseIncrement = state.lastRaiseIncrement;
  let minRaiseTo = state.minRaiseTo;
  let actedPlayerIds = [...state.actedPlayerIds];

  if (action.type === 'fold') {
    updatedPlayers[playerIdx] = {
      ...player,
      status: 'folded',
      lastAction: 'Fold',
    };
    actedPlayerIds.push(player.id);
  } else if (action.type === 'check') {
    const toCall = Math.max(0, currentHighestBet - player.currentBet);
    if (toCall > 0) {
      // Fallback to call if there is a bet facing the player
      return applyPlayerAction(state, playerId, { type: 'call' });
    }
    updatedPlayers[playerIdx] = {
      ...player,
      lastAction: 'Check',
    };
    actedPlayerIds.push(player.id);
  } else if (action.type === 'call') {
    const needed = Math.max(0, currentHighestBet - player.currentBet);
    const chipContribution = Math.min(needed, player.stack);
    const newStack = player.stack - chipContribution;
    const newCurrentBet = player.currentBet + chipContribution;

    updatedPlayers[playerIdx] = {
      ...player,
      stack: newStack,
      currentBet: newCurrentBet,
      totalHandBet: player.totalHandBet + chipContribution,
      status: newStack === 0 ? 'all-in' : 'active',
      lastAction: needed === 0 ? 'Check' : 'Call',
    };
    actedPlayerIds.push(player.id);
  } else if (action.type === 'raise') {
    const maxPossibleBet = player.currentBet + player.stack;
    const desiredBet = action.raiseToAmount ?? state.minRaiseTo;
    const targetBet = Math.min(
      maxPossibleBet,
      Math.max(desiredBet, state.minRaiseTo)
    );
    const addedChips = Math.max(0, targetBet - player.currentBet);
    const newStack = player.stack - addedChips;
    const actualNewBet = player.currentBet + addedChips;

    if (actualNewBet > currentHighestBet) {
      const raiseDiff = actualNewBet - currentHighestBet;
      lastRaiseIncrement = Math.max(state.bigBlind, raiseDiff);
      currentHighestBet = actualNewBet;
      minRaiseTo = currentHighestBet + lastRaiseIncrement;
      // Raising re-opens action for all other active players
      actedPlayerIds = [player.id];
    } else {
      actedPlayerIds.push(player.id);
    }

    updatedPlayers[playerIdx] = {
      ...player,
      stack: newStack,
      currentBet: actualNewBet,
      totalHandBet: player.totalHandBet + addedChips,
      status: newStack === 0 ? 'all-in' : 'active',
      lastAction: 'Raise',
    };
  }

  // Check if all other players folded
  const remainingNonFolded = updatedPlayers.filter((p) => p.status !== 'folded');
  if (remainingNonFolded.length <= 1) {
    return advanceStreetOrShowdown({
      ...state,
      players: updatedPlayers,
      currentHighestBet,
      lastRaiseIncrement,
      minRaiseTo,
      actedPlayerIds,
    });
  }

  // Check if the betting round is complete:
  // Every active player has acted AND matches currentHighestBet
  const activePlayers = updatedPlayers.filter((p) => p.status === 'active');
  const allActiveActedAndMatched = activePlayers.every(
    (p) => actedPlayerIds.includes(p.id) && p.currentBet === currentHighestBet
  );

  if (allActiveActedAndMatched || activePlayers.length === 0) {
    return advanceStreetOrShowdown({
      ...state,
      players: updatedPlayers,
      currentHighestBet,
      lastRaiseIncrement,
      minRaiseTo,
      actedPlayerIds,
    });
  }

  const nextTurnIndex = findNextActiveIndex(updatedPlayers, playerIdx);

  return {
    ...state,
    players: updatedPlayers,
    currentTurnIndex: nextTurnIndex,
    currentHighestBet,
    lastRaiseIncrement,
    minRaiseTo,
    actedPlayerIds,
  };
}

/**
 * Simple & natural AI bot decision maker for solo / practice mode.
 */
export function getBotDecision(state: PokerTableState, botId: string): PlayerActionInput {
  const bot = state.players.find((p) => p.id === botId);
  if (!bot) return { type: 'fold' };

  const toCall = Math.max(0, state.currentHighestBet - bot.currentBet);
  const evalHand = evaluateHoldemHand([...bot.holeCards, ...state.communityCards]);

  // First hand scripted behavior for Emma & others to mirror IMG_8411 if Hero calls 2 preflop
  if (state.handNumber === 1 && state.street === 'preflop') {
    if (bot.name === 'Emma' && state.currentHighestBet <= 2) {
      return { type: 'raise', raiseToAmount: 6 };
    }
    if (bot.name === 'Leo' || bot.name === 'Akash') {
      return { type: 'fold' };
    }
  }

  if (toCall === 0) {
    // Can check or bet
    if (evalHand.categoryRank >= 2 || (evalHand.categoryRank === 1 && Math.random() < 0.45)) {
      const raiseAmt = Math.min(
        bot.currentBet + bot.stack,
        Math.max(state.minRaiseTo, Math.round(getTotalPot(state) * 0.65))
      );
      if (raiseAmt >= state.minRaiseTo && bot.stack > state.bigBlind) {
        return { type: 'raise', raiseToAmount: raiseAmt };
      }
    }
    return { type: 'check' };
  }

  // Facing a bet
  const highCardRank = Math.max(
    bot.holeCards[0]?.rank ?? 2,
    bot.holeCards[1]?.rank ?? 2
  );

  if (evalHand.categoryRank >= 2) {
    // Two Pair or better: raise or call
    if (toCall <= bot.stack * 0.35 && Math.random() < 0.5) {
      return {
        type: 'raise',
        raiseToAmount: Math.min(bot.currentBet + bot.stack, state.minRaiseTo),
      };
    }
    return { type: 'call' };
  }

  if (evalHand.categoryRank === 1) {
    // One Pair: call reasonable bets
    if (toCall <= state.bigBlind * 8 || toCall <= getTotalPot(state) * 0.6) {
      return { type: 'call' };
    }
    return { type: 'fold' };
  }

  // High Card
  if (state.street === 'preflop' && highCardRank >= 12 && toCall <= state.bigBlind * 4) {
    return { type: 'call' };
  }

  if (toCall <= state.bigBlind && Math.random() < 0.4) {
    return { type: 'call' };
  }

  return { type: 'fold' };
}
