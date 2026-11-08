import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../types';
import { calculateHoldemEquity } from '../equity';
import { evaluateHoldemHand } from '../evaluator';
import {
  applyPlayerAction,
  createInitialTableState,
  getSeatedPlayersCount,
  seatPlayerInTable,
} from '../gameState';

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
    expect(result.winPct).toBeGreaterThanOrEqual(18);
    expect(result.winPct).toBeLessThanOrEqual(40);
    expect(result.nextHandLabel).toBe('Two Pair');
    expect(result.nextHandPct).toBeGreaterThanOrEqual(28);
    expect(result.nextHandPct).toBeLessThanOrEqual(50);
  });
});

describe('Poker Table State Machine', () => {
  it('names AI bots explicitly with "Bot" prefix and deals random hands by default', () => {
    const state = createInitialTableState('BOTS', 'bots');
    expect(state.players).toHaveLength(6);
    expect(state.players[1].name).toBe('Bot Emma');
    expect(state.players[2].name).toBe('Bot Leo');
    expect(state.players[3].name).toBe('Bot Akash');
    expect(state.players[4].name).toBe('Bot Tori');
    expect(state.players[5].name).toBe('Bot Evelyn');

    expect(state.players[state.dealerIndex].name).toBe('Bot Akash');
    expect(state.players[4].currentBet).toBe(1);
    expect(state.players[5].currentBet).toBe(2);
    expect(state.currentTurnIndex).toBe(0); // Hero UTG
    expect(state.collectedPot).toBe(0);

    // Verify random dealing across multiple tables (not locked to 9s 9h)
    const hands = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const s = createInitialTableState('BOTS', 'bots');
      hands.add(s.players[0].holeCards.map((card) => card.id).join(','));
    }
    expect(hands.size).toBeGreaterThan(1);

    // Hero calls 2 (starting with 100 buyIn in bot mode)
    const nextState = applyPlayerAction(state, 'hero', { type: 'call' });
    expect(nextState.players[0].currentBet).toBe(2);
    expect(nextState.players[0].stack).toBe(98);
    expect(nextState.currentTurnIndex).toBe(1); // Bot Emma's turn
  });

  it('supports Hero Throw-to-Fold action and advances turn sequentially through opponents', () => {
    let state = createInitialTableState('BOTS', 'bots');
    expect(state.currentTurnIndex).toBe(0);

    // Hero throws cards to fold
    state = applyPlayerAction(state, 'hero', { type: 'fold' });
    expect(state.players[0].status).toBe('folded');
    expect(state.players[0].lastAction).toBe('Fold');
    expect(state.currentTurnIndex).toBe(1); // Advances sequentially to Bot Emma (seat 1)

    // Bot Emma raises to 6
    state = applyPlayerAction(state, 'bot-emma', { type: 'raise', raiseToAmount: 6 });
    expect(state.currentTurnIndex).toBe(2); // Advances to Bot Leo (seat 2)

    // Bot Leo folds
    state = applyPlayerAction(state, 'bot-leo', { type: 'fold' });
    expect(state.currentTurnIndex).toBe(3); // Advances to Bot Akash (seat 3)
  });

  it('keeps real rooms free of fake bots and seats real joining friends dynamically', () => {
    let realState = createInitialTableState('MESA1', 'real');
    expect(realState.roomMode).toBe('real');
    expect(getSeatedPlayersCount(realState.players)).toBe(1);
    expect(realState.players.slice(1).every((p) => p.id.startsWith('empty-'))).toBe(true);
    expect(realState.players.slice(1).every((p) => p.name === 'Esperando...')).toBe(true);

    // Host claims seat 0
    realState = seatPlayerInTable(realState, {
      id: 'p_isaac',
      name: 'Isaac',
      avatarId: 'hero',
    }).state;
    expect(realState.players[0].id).toBe('p_isaac');
    expect(realState.players[0].name).toBe('Isaac');
    expect(getSeatedPlayersCount(realState.players)).toBe(1);

    // Friend Leo joins the room on another phone -> takes seat 1 and starts the hand
    const joined = seatPlayerInTable(realState, {
      id: 'p_leo',
      name: 'Leo',
      avatarId: 'leo',
    });
    expect(joined.changed).toBe(true);
    realState = joined.state;
    expect(getSeatedPlayersCount(realState.players)).toBe(2);
    expect(realState.players[1].id).toBe('p_leo');
    expect(realState.players[1].name).toBe('Leo');
    expect(realState.players[0].holeCards).toHaveLength(2);
    expect(realState.players[1].holeCards).toHaveLength(2);
    expect(realState.currentHighestBet).toBe(4);
  });
});

describe('User Profile, Card Back Themes & Playstyle Diamond Radar Metrics', () => {
  it('starts with 0 XP, 0 stats, neutral radar (archetype=null) and computes LAG/TAG/ROCK/FISH after hands played', async () => {
    const {
      CARD_BACK_THEMES,
      DEFAULT_USER_PROFILE,
      computePlaystyleMetrics,
      cycleCardBackColor,
    } = await import('../../../lib/profile');

    expect(DEFAULT_USER_PROFILE.xp).toBe(0);
    expect(DEFAULT_USER_PROFILE.level).toBe(1);
    expect(DEFAULT_USER_PROFILE.hasSetCustomName).toBe(false);
    expect(DEFAULT_USER_PROFILE.friends).toEqual([]);
    expect(DEFAULT_USER_PROFILE.stats.handsPlayed).toBe(0);

    // 0 hands played -> neutral small diamond with null archetype
    const neutralMetrics = computePlaystyleMetrics(DEFAULT_USER_PROFILE.stats);
    expect(neutralMetrics.archetype).toBeNull();
    expect(neutralMetrics.aggressive).toBe(0.18);
    expect(neutralMetrics.loose).toBe(0.18);
    expect(neutralMetrics.passive).toBe(0.18);
    expect(neutralMetrics.tight).toBe(0.18);

    // Loose-Aggressive (LAG)
    const lagMetrics = computePlaystyleMetrics({
      handsPlayed: 28,
      vpipCount: 19,
      aggressiveCount: 24,
      passiveCount: 11,
      foldCount: 9,
      handsWon: 12,
    });
    expect(lagMetrics.archetype).toBe('LAG');
    expect(lagMetrics.aggressive).toBeGreaterThan(lagMetrics.passive);
    expect(lagMetrics.loose).toBeGreaterThan(lagMetrics.tight);

    // Tight-Passive (ROCK)
    const rockMetrics = computePlaystyleMetrics({
      handsPlayed: 30,
      vpipCount: 4,
      aggressiveCount: 2,
      passiveCount: 15,
      foldCount: 25,
      handsWon: 3,
    });
    expect(rockMetrics.archetype).toBe('ROCK');

    // Loose-Passive (FISH)
    const fishMetrics = computePlaystyleMetrics({
      handsPlayed: 30,
      vpipCount: 26,
      aggressiveCount: 3,
      passiveCount: 28,
      foldCount: 2,
      handsWon: 6,
    });
    expect(fishMetrics.archetype).toBe('FISH');

    // Supports all 4 customizable card back colors
    expect(CARD_BACK_THEMES.slate.hex).toBe('#9aa3aa');
    expect(CARD_BACK_THEMES.indigo.hex).toBe('#6366f1');
    expect(CARD_BACK_THEMES.emerald.hex).toBe('#10b981');
    expect(CARD_BACK_THEMES.crimson.hex).toBe('#e11d48');

    const cycled = cycleCardBackColor();
    expect(cycled.cardBackColor).toBe('indigo');
  });

  it('starts with an empty open rooms directory and encodes/decodes MQTT WebSocket packets', async () => {
    const {
      DEFAULT_OPEN_ROOMS,
      buildMqttPublishPacket,
      createNewOpenRoom,
      parseMqttPublishPackets,
      shouldAcceptIncomingState,
    } = await import('../../../lib/multiplayer');

    expect(DEFAULT_OPEN_ROOMS).toEqual([]);

    const customReal = createNewOpenRoom('Mesa Amigos', 'live', 'AMIGOS', 'real');
    expect(customReal.roomMode).toBe('real');
    expect(customReal.playerCount).toBe(1);

    const pkt = buildMqttPublishPacket(
      'cartas/v5/room/AMIGOS/state',
      JSON.stringify({ type: 'table_state', roomId: 'AMIGOS' }),
      true
    );
    const decoded = parseMqttPublishPackets(pkt);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].topic).toBe('cartas/v5/room/AMIGOS/state');
    expect(JSON.parse(decoded[0].payload)).toEqual({
      type: 'table_state',
      roomId: 'AMIGOS',
    });

    // Verify monotonic stateVersion and authoritative dealer hand start when Player 2 joins
    let hostState = createInitialTableState('AMIGOS', 'real');
    hostState = seatPlayerInTable(hostState, {
      id: 'p_host',
      name: 'Isaac',
      avatarId: 'hero',
      stack: 240,
    }).state;
    expect(hostState.players[0].stack).toBe(240);
    expect(getSeatedPlayersCount(hostState.players)).toBe(1);

    const p2Joined = seatPlayerInTable(hostState, {
      id: 'p_friend',
      name: 'Leo',
      avatarId: 'leo',
      stack: 200,
    }).state;
    expect(getSeatedPlayersCount(p2Joined.players)).toBe(2);
    expect(p2Joined.stateVersion).toBeGreaterThan(hostState.stateVersion ?? 0);

    // Reject stale 1-player state when 2 players are already seated
    expect(shouldAcceptIncomingState(p2Joined, hostState)).toBe(false);
    // Accept newer versioned state after an action
    const afterAction = applyPlayerAction(
      p2Joined,
      p2Joined.players[p2Joined.currentTurnIndex].id,
      { type: 'call' }
    );
    expect(afterAction.stateVersion).toBeGreaterThan(p2Joined.stateVersion ?? 0);
    expect(shouldAcceptIncomingState(p2Joined, afterAction)).toBe(true);
    expect(shouldAcceptIncomingState(afterAction, p2Joined)).toBe(false);
  });

  it('protects player bankroll and cleanly folds mid-hand when leaving via forceFoldPlayerForLeave', async () => {
    const { forceFoldPlayerForLeave, startNewHand } = await import('../gameState');
    const {
      DEFAULT_USER_PROFILE,
      savePlayerBankroll,
      deductTableBuyIn,
      returnTableStack,
      claimBankruptcyBonus,
    } = await import('../../../lib/profile');

    expect(DEFAULT_USER_PROFILE.bankroll).toBe(1000);
    const updatedProfile = savePlayerBankroll(185);
    expect(updatedProfile.bankroll).toBe(185);
    // Allows hitting 0 for true bankruptcy
    expect(savePlayerBankroll(0).bankroll).toBe(0);

    // Test bankruptcy claim
    const recovered = claimBankruptcyBonus();
    expect(recovered.bankroll).toBe(200);

    // Test table buy-in deduction & return
    savePlayerBankroll(1000);
    const { paid, remainingBankroll } = deductTableBuyIn(200);
    expect(paid).toBe(200);
    expect(remainingBankroll).toBe(800);
    const returned = returnTableStack(250);
    expect(returned.bankroll).toBe(1050);

    let state = createInitialTableState('MESA1', 'real');
    state = seatPlayerInTable(state, { id: 'p_1', name: 'Isaac', avatarId: 'hero' }).state;
    state = seatPlayerInTable(state, { id: 'p_2', name: 'Leo', avatarId: 'leo' }).state;

    // If p_1 leaves and folds mid-hand in a 2-player hand, p_2 immediately wins the pot at showdown
    const folded = forceFoldPlayerForLeave(state, 'p_1');
    expect(folded.street).toBe('showdown');
    expect(folded.winnerIds).toContain('p_2');

    // Test bot elimination & non-regeneration
    let botTable = createInitialTableState('BOTS', 'bots');
    // Set bot-emma stack to 0
    botTable.players[1].stack = 0;
    const nextHand = startNewHand(botTable, false);
    expect(nextHand.players[1].status).toBe('out');
    expect(nextHand.players[1].stack).toBe(0);
    expect(nextHand.players[1].lastAction).toBe('Eliminado');

    // Test bot 100-hand cap
    botTable.handNumber = 100;
    const capped = startNewHand(botTable, false);
    expect(capped.street).toBe('showdown');
  });

  it('auto-expires live rooms after 2h, async rooms after 7d, and supports manual deleteOpenRoom', async () => {
    const {
      ASYNC_ROOM_TTL_MS,
      LIVE_ROOM_TTL_MS,
      createNewOpenRoom,
      deleteOpenRoom,
      isRoomExpired,
      loadOpenRooms,
      mergeOpenRoomsList,
    } = await import('../../../lib/multiplayer');

    expect(LIVE_ROOM_TTL_MS).toBe(2 * 60 * 60 * 1000);
    expect(ASYNC_ROOM_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);

    const now = Date.now();
    const liveRoom = createNewOpenRoom('Mesa En Vivo', 'live', 'LIVE1', 'real');
    const asyncRoom = createNewOpenRoom('Mesa Turnos', 'async', 'ASYNC1', 'real');

    expect(isRoomExpired(liveRoom, now + LIVE_ROOM_TTL_MS - 1000)).toBe(false);
    expect(isRoomExpired(liveRoom, now + LIVE_ROOM_TTL_MS + 1000)).toBe(true);

    expect(isRoomExpired(asyncRoom, now + LIVE_ROOM_TTL_MS + 1000)).toBe(false);
    expect(isRoomExpired(asyncRoom, now + ASYNC_ROOM_TTL_MS + 1000)).toBe(true);

    // Manual deletion removes room and prevents stale directory sync from resurrecting it
    const afterDelete = deleteOpenRoom('LIVE1');
    expect(afterDelete.some((r) => r.code === 'LIVE1')).toBe(false);
    expect(loadOpenRooms().some((r) => r.code === 'LIVE1')).toBe(false);

    const mergedWithStale = mergeOpenRoomsList(loadOpenRooms(), [liveRoom]);
    expect(mergedWithStale.some((r) => r.code === 'LIVE1')).toBe(false);
  });

  it('triggers iOS switch haptics and vibration cleanly via triggerHaptic', async () => {
    const { initGlobalHaptics, triggerHaptic } = await import('../../../lib/haptics');
    expect(() => {
      initGlobalHaptics();
      triggerHaptic('light');
      triggerHaptic('selection');
    }).not.toThrow();
  });
});

