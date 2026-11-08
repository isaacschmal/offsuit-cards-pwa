import { createStandardDeck, shuffleDeck } from '../deck';
import type { Card, Player } from '../types';
import { evaluateHoldemHand } from './evaluator';

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export type RoomPlayersMode = 'real' | 'bots';

export interface PokerTableState {
  roomId: string;
  roomMode?: RoomPlayersMode;
  tableBuyIn?: number; // Configurable table buy-in (e.g. 100, 200, 300, 500)
  maxHands?: number | null; // Capped at 100 in bot mode, null in real multiplayer
  stateVersion?: number;
  updatedBy?: string;
  players: Player[]; // index 0 is host/hero, 1..5 are seats 1..5
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
  { id: 'bot-emma', name: 'Bot Emma', avatarId: 'emma' },
  { id: 'bot-leo', name: 'Bot Leo', avatarId: 'leo' },
  { id: 'bot-akash', name: 'Bot Akash', avatarId: 'akash' },
  { id: 'bot-tori', name: 'Bot Tori', avatarId: 'tori' },
  { id: 'bot-evelyn', name: 'Bot Evelyn', avatarId: 'evelyn' },
];

export function isVacantSeat(player: Player): boolean {
  return player.id.startsWith('empty-');
}

export function getSeatedPlayersCount(players: Player[]): number {
  return players.filter((p) => !isVacantSeat(p)).length;
}

export function createInitialTableState(
  roomId = 'local-offsuit',
  roomMode: RoomPlayersMode = 'bots',
  useOpeningSeed = false,
  buyIn = 200
): PokerTableState {
  const isBotMode = roomMode === 'bots';
  // Bot tables are capped at maximum 100 chips buy-in to prevent farming
  const resolvedBuyIn = isBotMode ? Math.min(100, Math.max(20, buyIn)) : Math.max(50, buyIn);
  const smallBlind = Math.max(1, Math.round(resolvedBuyIn / 100));
  const bigBlind = Math.max(2, Math.round(resolvedBuyIn / 50));
  const maxHands = isBotMode ? 100 : null;

  const players: Player[] = [
    {
      id: 'hero',
      name: 'You',
      avatarId: 'hero',
      stack: resolvedBuyIn,
      currentBet: 0,
      totalHandBet: 0,
      holeCards: [],
      status: 'active',
      lastAction: null,
      isBot: false,
      seatIndex: 0,
    },
    ...DEFAULT_OPPONENTS.map((opp, idx) =>
      isBotMode
        ? {
            id: opp.id,
            name: opp.name,
            avatarId: opp.avatarId,
            stack: resolvedBuyIn,
            currentBet: 0,
            totalHandBet: 0,
            holeCards: [],
            status: 'active' as const,
            lastAction: null,
            isBot: true,
            seatIndex: idx + 1,
          }
        : {
            id: `empty-${idx + 1}`,
            name: 'Esperando...',
            avatarId: 'empty',
            stack: 0,
            currentBet: 0,
            totalHandBet: 0,
            holeCards: [],
            status: 'out' as const,
            lastAction: null,
            isBot: false,
            seatIndex: idx + 1,
          }
    ),
  ];

  const baseState: PokerTableState = {
    roomId,
    roomMode,
    tableBuyIn: resolvedBuyIn,
    maxHands,
    stateVersion: 0,
    updatedBy: 'system',
    players,
    deck: [],
    communityCards: [],
    collectedPot: 0,
    sidePots: [],
    dealerIndex: 2, // In 6-max bot mode advances to 3 (Bot Akash)
    currentTurnIndex: 0,
    street: 'preflop',
    smallBlind,
    bigBlind,
    currentHighestBet: bigBlind,
    minRaiseTo: bigBlind * 2,
    lastRaiseIncrement: bigBlind,
    actedPlayerIds: [],
    winnerIds: [],
    winningHandName: null,
    handNumber: 0,
  };

  return startNewHand(baseState, useOpeningSeed);
}

/**
 * Seats a real human player into the table (either claiming seat 0 or taking the next vacant seat)
 * and starts a hand when the second player joins.
 */
export function seatPlayerInTable(
  state: PokerTableState,
  participant: { id: string; name: string; avatarId: string; stack?: number }
): { state: PokerTableState; changed: boolean } {
  if (!participant.id) return { state, changed: false };
  const cleanName = participant.name.trim() || 'Jugador';
  const cleanAvatar = participant.avatarId || 'hero';
  const initialStack =
    typeof participant.stack === 'number' && participant.stack > 0
      ? Math.round(participant.stack)
      : (state.tableBuyIn ?? 200);

  // In bots mode, just keep seat 0 updated with local player's identity
  if (state.roomMode === 'bots') {
    const heroSeat = state.players[0];
    if (
      heroSeat &&
      (heroSeat.name !== cleanName || heroSeat.avatarId !== cleanAvatar)
    ) {
      const updatedPlayers = [...state.players];
      updatedPlayers[0] = {
        ...heroSeat,
        name: cleanName,
        avatarId: cleanAvatar,
      };
      return {
        state: {
          ...state,
          players: updatedPlayers,
          stateVersion: (state.stateVersion ?? 1) + 1,
          updatedBy: participant.id,
        },
        changed: true,
      };
    }
    return { state, changed: false };
  }

  // Check if player is already seated
  const existingIdx = state.players.findIndex((p) => p.id === participant.id);
  if (existingIdx >= 0) {
    const existing = state.players[existingIdx];
    if (existing.name !== cleanName || existing.avatarId !== cleanAvatar) {
      const updatedPlayers = [...state.players];
      updatedPlayers[existingIdx] = {
        ...existing,
        name: cleanName,
        avatarId: cleanAvatar,
      };
      return {
        state: {
          ...state,
          players: updatedPlayers,
          stateVersion: (state.stateVersion ?? 1) + 1,
          updatedBy: participant.id,
        },
        changed: true,
      };
    }
    return { state, changed: false };
  }

  // If seat 0 is still the unclaimed default 'hero' placeholder, claim seat 0
  if (state.players[0]?.id === 'hero') {
    const updatedPlayers = [...state.players];
    updatedPlayers[0] = {
      ...updatedPlayers[0],
      id: participant.id,
      name: cleanName,
      avatarId: cleanAvatar,
      stack: initialStack,
    };
    return {
      state: {
        ...state,
        players: updatedPlayers,
        stateVersion: (state.stateVersion ?? 1) + 1,
        updatedBy: participant.id,
      },
      changed: true,
    };
  }

  // Find first vacant seat ('empty-1' .. 'empty-5')
  const emptyIdx = state.players.findIndex((p) => isVacantSeat(p));
  if (emptyIdx === -1) {
    return { state, changed: false };
  }

  const prevSeatedCount = getSeatedPlayersCount(state.players);
  const updatedPlayers = [...state.players];
  updatedPlayers[emptyIdx] = {
    id: participant.id,
    name: cleanName,
    avatarId: cleanAvatar,
    stack: initialStack,
    currentBet: 0,
    totalHandBet: 0,
    holeCards: [],
    status: 'active',
    lastAction: null,
    isBot: false,
    seatIndex: emptyIdx,
  };

  // If table was waiting for a 2nd player, or is preflop with 0 actions taken yet, deal a fresh hand for everyone
  if (
    prevSeatedCount < 2 ||
    (state.street === 'preflop' && state.actedPlayerIds.length === 0)
  ) {
    const nextState = startNewHand(
      {
        ...state,
        players: updatedPlayers,
        handNumber: Math.max(0, state.handNumber - 1),
        updatedBy: state.players[0]?.id ?? participant.id,
      },
      false
    );
    return { state: nextState, changed: true };
  }

  // Otherwise seat them folded for the current hand so they get dealt in on the next hand
  updatedPlayers[emptyIdx] = {
    ...updatedPlayers[emptyIdx],
    status: 'folded',
  };
  return {
    state: {
      ...state,
      players: updatedPlayers,
      stateVersion: (state.stateVersion ?? 1) + 1,
      updatedBy: participant.id,
    },
    changed: true,
  };
}

function findNextActiveIndex(players: Player[], fromIndex: number): number {
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIndex + offset) % n;
    if (players[idx].status === 'active' && !isVacantSeat(players[idx])) {
      return idx;
    }
  }
  return fromIndex;
}

function findNextNonOutIndex(players: Player[], fromIndex: number): number {
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIndex + offset) % n;
    if (
      !isVacantSeat(players[idx]) &&
      players[idx].status !== 'out' &&
      players[idx].stack > 0
    ) {
      return idx;
    }
  }
  return 0;
}

export function startNewHand(
  prevState: PokerTableState,
  useOpeningSeed = false
): PokerTableState {
  const isBotMode = prevState.roomMode === 'bots';

  // In bot mode, cap at max 100 hands
  if (isBotMode && prevState.handNumber >= 100) {
    return {
      ...prevState,
      street: 'showdown',
      stateVersion: (prevState.stateVersion ?? 0) + 1,
    };
  }

  // Replenish ONLY if real player rebought; BOTS NEVER REGENERATE CHIPS!
  const refreshedPlayers: Player[] = prevState.players.map((p) => {
    if (isVacantSeat(p)) {
      return {
        ...p,
        stack: 0,
        currentBet: 0,
        totalHandBet: 0,
        holeCards: [] as Card[],
        status: 'out' as const,
        lastAction: null,
      };
    }

    // Bots that busted lose permanently and DO NOT regenerate chips
    if (p.isBot && p.stack <= 0) {
      return {
        ...p,
        stack: 0,
        currentBet: 0,
        totalHandBet: 0,
        holeCards: [] as Card[],
        status: 'out' as const,
        lastAction: 'Eliminado' as const,
      };
    }

    const hasChips = p.stack > 0;
    return {
      ...p,
      stack: Math.max(0, p.stack),
      currentBet: 0,
      totalHandBet: 0,
      holeCards: [] as Card[],
      status: hasChips ? ('active' as const) : ('out' as const),
      lastAction: hasChips ? null : ('Eliminado' as const),
    };
  });

  const activePlayersWithChips = refreshedPlayers.filter(
    (p) => !isVacantSeat(p) && p.status !== 'out' && p.stack > 0
  );

  // If fewer than 2 active players with chips, table cannot deal a new hand
  if (activePlayersWithChips.length < 2) {
    return {
      ...prevState,
      players: refreshedPlayers,
      street: 'showdown',
      stateVersion: (prevState.stateVersion ?? 0) + 1,
    };
  }

  const seatedCount = getSeatedPlayersCount(refreshedPlayers);

  let deck = shuffleDeck(createStandardDeck());

  if (useOpeningSeed) {
    // Optional deterministic seed for unit tests only
    const pinnedIds = [
      '9-spades',
      '9-hearts',
      '14-diamonds',
      '13-spades',
      '7-clubs',
      '2-diamonds',
      '10-clubs',
      '4-spades',
      '8-diamonds',
      '5-clubs',
      '12-clubs',
      '6-spades',
      '11-hearts',
      '13-hearts',
      '6-hearts',
      '7-diamonds',
    ];
    const cardMap = new Map(deck.map((c) => [c.id, c]));
    const pinnedCards = pinnedIds.map((id) => cardMap.get(id)!).filter(Boolean);
    const rest = deck.filter((c) => !pinnedIds.includes(c.id));
    deck = [...pinnedCards, ...rest];
  }

  let deckCursor = 0;
  const playersWithCards = refreshedPlayers.map((p) => {
    if (isVacantSeat(p) || p.status === 'out') {
      return {
        ...p,
        holeCards: [] as Card[],
      };
    }
    const holeCards = [deck[deckCursor], deck[deckCursor + 1]];
    deckCursor += 2;
    return {
      ...p,
      holeCards,
    };
  });

  // If fewer than 2 players are seated (e.g., real room waiting for friends to join), wait without posting blinds
  if (seatedCount < 2) {
    const loneIdx = Math.max(
      0,
      playersWithCards.findIndex((p) => !isVacantSeat(p))
    );
    return {
      ...prevState,
      stateVersion: (prevState.stateVersion ?? 0) + 1,
      updatedBy: prevState.updatedBy ?? prevState.players[loneIdx]?.id ?? 'dealer',
      players: playersWithCards,
      deck: deck.slice(deckCursor),
      communityCards: [],
      collectedPot: 0,
      sidePots: [],
      dealerIndex: loneIdx,
      currentTurnIndex: loneIdx,
      street: 'preflop',
      currentHighestBet: 0,
      minRaiseTo: prevState.bigBlind,
      lastRaiseIncrement: prevState.bigBlind,
      actedPlayerIds: [],
      winnerIds: [],
      winningHandName: null,
      handNumber: prevState.handNumber + 1,
    };
  }

  const dealerIndex = findNextNonOutIndex(playersWithCards, prevState.dealerIndex);
  const sbIndex =
    seatedCount === 2
      ? dealerIndex
      : findNextNonOutIndex(playersWithCards, dealerIndex);
  const bbIndex = findNextNonOutIndex(playersWithCards, sbIndex);
  const utgIndex = findNextNonOutIndex(playersWithCards, bbIndex);

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
    stateVersion: (prevState.stateVersion ?? 0) + 1,
    updatedBy: prevState.updatedBy ?? playersWithCards[dealerIndex]?.id ?? 'dealer',
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
  const contributors = players.filter((p) => p.totalHandBet > 0 && !isVacantSeat(p));
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
      .filter((p) => p.status !== 'folded' && p.status !== 'out')
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

  const contenders = playersClearedBets.filter(
    (p) => !isVacantSeat(p) && p.status !== 'folded' && p.status !== 'out'
  );

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

  const nonFolded = resetPlayers.filter(
    (p) => !isVacantSeat(p) && p.status !== 'folded' && p.status !== 'out'
  );
  if (nonFolded.length <= 1) {
    return resolveShowdown({
      ...state,
      players: resetPlayers,
      collectedPot: newCollectedPot,
    });
  }

  const activeCanAct = resetPlayers.filter(
    (p) => !isVacantSeat(p) && p.status === 'active'
  );

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
  if (getSeatedPlayersCount(state.players) < 2) return state;

  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1 || playerIdx !== state.currentTurnIndex) {
    return state;
  }

  const player = state.players[playerIdx];
  if (player.status !== 'active' || isVacantSeat(player)) return state;

  const nextVersion = (state.stateVersion ?? 1) + 1;
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

  // Check if all other seated players folded
  const remainingNonFolded = updatedPlayers.filter(
    (p) => !isVacantSeat(p) && p.status !== 'folded' && p.status !== 'out'
  );
  if (remainingNonFolded.length <= 1) {
    return advanceStreetOrShowdown({
      ...state,
      stateVersion: nextVersion,
      updatedBy: playerId,
      players: updatedPlayers,
      currentHighestBet,
      lastRaiseIncrement,
      minRaiseTo,
      actedPlayerIds,
    });
  }

  // Check if the betting round is complete:
  // Every active seated player has acted AND matches currentHighestBet
  const activePlayers = updatedPlayers.filter(
    (p) => !isVacantSeat(p) && p.status === 'active'
  );
  const allActiveActedAndMatched = activePlayers.every(
    (p) => actedPlayerIds.includes(p.id) && p.currentBet === currentHighestBet
  );

  if (allActiveActedAndMatched || activePlayers.length === 0) {
    return advanceStreetOrShowdown({
      ...state,
      stateVersion: nextVersion,
      updatedBy: playerId,
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
    stateVersion: nextVersion,
    updatedBy: playerId,
    players: updatedPlayers,
    currentTurnIndex: nextTurnIndex,
    currentHighestBet,
    lastRaiseIncrement,
    minRaiseTo,
    actedPlayerIds,
  };
}

/**
 * Cleanly folds a player who chooses "Hacer Fold y salir" mid-hand, even if it wasn't currently their turn,
 * so the table never freezes for the remaining friends.
 */
export function forceFoldPlayerForLeave(
  state: PokerTableState,
  playerId: string
): PokerTableState {
  if (state.street === 'showdown') return state;
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return state;

  const player = state.players[playerIdx];
  if (player.status !== 'active' || isVacantSeat(player)) return state;

  if (state.currentTurnIndex === playerIdx) {
    return applyPlayerAction(state, playerId, { type: 'fold' });
  }

  const nextVersion = (state.stateVersion ?? 1) + 1;
  const updatedPlayers = [...state.players];
  updatedPlayers[playerIdx] = {
    ...player,
    status: 'folded',
    lastAction: 'Fold',
  };
  const actedPlayerIds = state.actedPlayerIds.includes(playerId)
    ? [...state.actedPlayerIds]
    : [...state.actedPlayerIds, playerId];

  const remainingNonFolded = updatedPlayers.filter(
    (p) => !isVacantSeat(p) && p.status !== 'folded' && p.status !== 'out'
  );
  if (remainingNonFolded.length <= 1) {
    return advanceStreetOrShowdown({
      ...state,
      stateVersion: nextVersion,
      updatedBy: playerId,
      players: updatedPlayers,
      actedPlayerIds,
    });
  }

  return {
    ...state,
    stateVersion: nextVersion,
    updatedBy: playerId,
    players: updatedPlayers,
    actedPlayerIds,
  };
}

/**
 * Natural AI bot decision maker for solo / practice mode against bots.
 */
export function getBotDecision(state: PokerTableState, botId: string): PlayerActionInput {
  const bot = state.players.find((p) => p.id === botId);
  if (!bot) return { type: 'fold' };

  const toCall = Math.max(0, state.currentHighestBet - bot.currentBet);
  const evalHand = evaluateHoldemHand([...bot.holeCards, ...state.communityCards]);

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
