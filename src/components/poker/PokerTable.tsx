import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowUp, Check, Share2, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { calculateHoldemEquity } from '../../engine/poker/equity';
import { evaluateHoldemHand } from '../../engine/poker/evaluator';
import {
  applyPlayerAction,
  forceFoldPlayerForLeave,
  getBotDecision,
  getSeatedPlayersCount,
  getTotalPot,
  isVacantSeat,
  type PlayerActionInput,
  type PokerTableState,
  startNewHand,
} from '../../engine/poker/gameState';
import {
  notifyPlayerTurn,
  type RoomPacingMode,
  savePersistedRoomState,
} from '../../lib/multiplayer';
import { triggerHaptic } from '../../lib/haptics';
import {
  deductTableBuyIn,
  loadUserProfile,
  recordHandCompletedStats,
  recordPlayerActionStats,
} from '../../lib/profile';
import { formatHandName, type SupportedLanguage, t } from '../../lib/i18n';
import { AnimatedNumber } from './AnimatedNumber';
import { Avatar3D } from './Avatar3D';
import { CommunityCardSlot, HoleCardsBlock } from './PlayingCard';
import { TopOpponentsRow } from './TopOpponentsRow';

interface PokerTableProps {
  initialState: PokerTableState;
  onBack: (finalStack?: number, shouldCashOut?: boolean) => void;
  onBroadcastState?: (newState: PokerTableState) => void;
  externalState?: PokerTableState | null;
  roomName?: string;
  pacingMode?: RoomPacingMode;
}

export const PokerTable: React.FC<PokerTableProps> = ({
  initialState,
  onBack,
  onBroadcastState,
  externalState,
  roomName = 'Mesa de Cartas',
  pacingMode = 'live',
}) => {
  const [tableState, setTableState] = useState<PokerTableState>(initialState);
  const [isSliderOpen, setIsSliderOpen] = useState(false);
  const [sliderAmount, setSliderAmount] = useState<number>(initialState.minRaiseTo);
  const [hudOddsMode, setHudOddsMode] = useState<boolean>(false);
  const [profileState, setProfileState] = useState(() => loadUserProfile());
  const [copiedRoomInvite, setCopiedRoomInvite] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const prevTurnIndexRef = useRef<number>(initialState.currentTurnIndex);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const currentLang: SupportedLanguage = profileState.language ?? 'es';

  useEffect(() => {
    const syncProfile = () => {
      setProfileState(loadUserProfile());
    };
    window.addEventListener('cartas-profile-updated', syncProfile);
    return () => window.removeEventListener('cartas-profile-updated', syncProfile);
  }, []);

  useEffect(() => {
    if (externalState) {
      // Never let external state overwrite local bot practice games
      if (tableState.roomMode === 'bots') return;
      if (
        externalState.handNumber < tableState.handNumber ||
        (externalState.handNumber === tableState.handNumber &&
          (externalState.stateVersion ?? 0) <= (tableState.stateVersion ?? 0))
      ) {
        return;
      }
      setTableState(externalState);
    }
  }, [externalState, tableState.roomMode, tableState.handNumber, tableState.stateVersion]);

  const resolvedHeroIndex = useMemo(() => {
    const idx = tableState.players.findIndex((p) => p.id === profileState.playerId);
    return idx >= 0 ? idx : 0;
  }, [tableState.players, profileState.playerId]);

  const hero = tableState.players[resolvedHeroIndex] ?? tableState.players[0];

  const opponents = useMemo(() => {
    return [1, 2, 3, 4, 5].map(
      (offset) => tableState.players[(resolvedHeroIndex + offset) % 6]
    );
  }, [tableState.players, resolvedHeroIndex]);

  const currentActor = tableState.players[tableState.currentTurnIndex];
  const isRealFriendsRoom = tableState.roomMode === 'real';
  const seatedCount = useMemo(
    () => getSeatedPlayersCount(tableState.players),
    [tableState.players]
  );

  const isHeroTurn =
    tableState.street !== 'showdown' &&
    seatedCount >= 2 &&
    tableState.currentTurnIndex === resolvedHeroIndex &&
    hero.status === 'active';

  const toCall = Math.max(0, tableState.currentHighestBet - hero.currentBet);
  const maxHeroBet = hero.currentBet + hero.stack;
  const minRaiseBet = Math.min(
    maxHeroBet,
    Math.max(tableState.minRaiseTo, tableState.bigBlind * 2)
  );

  // Keep sliderAmount synced when turn or minRaiseBet updates
  useEffect(() => {
    setSliderAmount(minRaiseBet);
    setIsSliderOpen(false);
  }, [tableState.handNumber, tableState.street, minRaiseBet]);

  // Trigger PWA / Web Notification when turn transitions from an opponent to Hero in async mode
  useEffect(() => {
    const wasOpponentTurn = prevTurnIndexRef.current !== resolvedHeroIndex;
    prevTurnIndexRef.current = tableState.currentTurnIndex;

    if (
      wasOpponentTurn &&
      seatedCount >= 2 &&
      tableState.currentTurnIndex === resolvedHeroIndex &&
      tableState.street !== 'showdown' &&
      hero.status === 'active'
    ) {
      if (pacingMode === 'async' || (typeof document !== 'undefined' && document.hidden)) {
        void notifyPlayerTurn(roomName, tableState.roomId, tableState);
      }
    }
  }, [
    tableState,
    resolvedHeroIndex,
    seatedCount,
    hero.status,
    pacingMode,
    roomName,
  ]);

  // Sequential bot turn automation (~550ms per opponent) ONLY when seat is a bot (Práctica vs Bots mode)
  useEffect(() => {
    if (tableState.street === 'showdown') return;
    if (!currentActor || !currentActor.isBot || currentActor.status !== 'active') {
      return;
    }

    const timer = window.setTimeout(() => {
      const decision = getBotDecision(tableState, currentActor.id);
      const next = applyPlayerAction(tableState, currentActor.id, decision);
      if (next.street === 'showdown') {
        recordHandCompletedStats(next, hero.id);
      }
      setTableState(next);
      savePersistedRoomState(next.roomId, next);
      onBroadcastState?.(next);
    }, 550);

    return () => window.clearTimeout(timer);
  }, [tableState, currentActor, hero.id, onBroadcastState]);

  // Evaluate Hero's current hand & Monte Carlo equity
  const heroHandEval = useMemo(() => {
    return evaluateHoldemHand([...hero.holeCards, ...tableState.communityCards]);
  }, [hero.holeCards, tableState.communityCards]);

  const activeOpponentCount = useMemo(() => {
    return opponents.filter((o) => !isVacantSeat(o) && o.status !== 'folded' && o.status !== 'out')
      .length;
  }, [opponents]);

  const heroEquity = useMemo(() => {
    return calculateHoldemEquity(
      hero.holeCards,
      tableState.communityCards,
      Math.max(1, activeOpponentCount),
      500
    );
  }, [hero.holeCards, tableState.communityCards, activeOpponentCount]);

  const handleShareRoomLink = async () => {
    const shareUrl = `${window.location.origin}/?room=${encodeURIComponent(tableState.roomId)}`;
    const shareText =
      `🃏 Únete a mi mesa de póker #${tableState.roomId}:\n\n` +
      `1️⃣ Si tienes la app instalada en tu pantalla de inicio: Abre 'Cartas' y entra a la sala #${tableState.roomId}\n` +
      `2️⃣ O entra directo desde el navegador:\n${shareUrl}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Mesa #${tableState.roomId} · Cartas`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    navigator.clipboard?.writeText(shareText);
    setCopiedRoomInvite(true);
    setTimeout(() => setCopiedRoomInvite(false), 2000);
  };

  // Bot session completion checks
  const allBotsEliminated = useMemo(() => {
    if (tableState.roomMode !== 'bots') return false;
    return opponents.every(
      (o) => isVacantSeat(o) || o.status === 'out' || o.stack <= 0
    );
  }, [tableState.roomMode, opponents]);

  const reachedMaxHands = useMemo(() => {
    return tableState.roomMode === 'bots' && tableState.handNumber >= 100;
  }, [tableState.roomMode, tableState.handNumber]);

  const isBotSessionFinished = useMemo(() => {
    if (tableState.roomMode !== 'bots') return false;
    return allBotsEliminated || (reachedMaxHands && tableState.street === 'showdown');
  }, [tableState.roomMode, allBotsEliminated, reachedMaxHands, tableState.street]);

  // Safe Back Button handler: Never blocks async / turn-based players from returning to menu!
  const handleBackButtonClick = () => {
    triggerHaptic('light');

    // In turn-based / async mode: players can freely return to the menu anytime
    // without folding or cashing out! Game continues and seat & stack are preserved.
    if (pacingMode === 'async') {
      onBack(hero.stack, false);
      return;
    }

    // In solo bot mode: leaving cashes out remaining table stack to wallet
    if (tableState.roomMode === 'bots') {
      onBack(hero.stack, true);
      return;
    }

    const hasActiveChipsInPot =
      seatedCount >= 2 &&
      tableState.street !== 'showdown' &&
      hero.status === 'active' &&
      hero.totalHandBet > 0;

    if (hasActiveChipsInPot) {
      setIsLeaveConfirmOpen(true);
      return;
    }

    // Live mode with 0 chips currently bet: return to menu keeping seat by default
    onBack(hero.stack, false);
  };

  const handleConfirmFoldAndLeave = () => {
    triggerHaptic('medium');
    recordPlayerActionStats({ type: 'fold' });
    const foldedState = forceFoldPlayerForLeave(tableState, hero.id);
    if (foldedState.street === 'showdown') {
      recordHandCompletedStats(foldedState, hero.id);
    }
    const updatedHero =
      foldedState.players[resolvedHeroIndex] ?? foldedState.players[0] ?? hero;
    setTableState(foldedState);
    savePersistedRoomState(foldedState.roomId, foldedState);
    onBroadcastState?.(foldedState);
    setIsLeaveConfirmOpen(false);
    onBack(updatedHero.stack, true); // true = cash out & leave seat permanently
  };

  const handleHeroAction = (action: PlayerActionInput) => {
    if (!isHeroTurn) return;
    triggerHaptic(action.type === 'raise' ? 'medium' : 'light');
    recordPlayerActionStats(action);
    const next = applyPlayerAction(tableState, hero.id, action);
    if (next.street === 'showdown') {
      recordHandCompletedStats(next, hero.id);
    }
    setIsSliderOpen(false);
    setTableState(next);
    savePersistedRoomState(next.roomId, next);
    onBroadcastState?.(next);
  };

  const handleRebuy = () => {
    const buyInNeeded =
      tableState.tableBuyIn ?? (tableState.roomMode === 'bots' ? 100 : 200);
    const { paid } = deductTableBuyIn(buyInNeeded);
    if (paid <= 0) return;
    triggerHaptic('medium');
    const updatedPlayers = tableState.players.map((p, idx) => {
      if (idx === resolvedHeroIndex) {
        return {
          ...p,
          stack: p.stack + paid,
          status: 'active' as const,
          lastAction: null,
        };
      }
      return p;
    });
    const nextState: PokerTableState = {
      ...tableState,
      players: updatedPlayers,
      stateVersion: (tableState.stateVersion ?? 1) + 1,
    };
    setTableState(nextState);
    savePersistedRoomState(nextState.roomId, nextState);
    onBroadcastState?.(nextState);
    setProfileState(loadUserProfile());
  };

  const handlePresetSelect = (preset: '1bb' | 'half-pot' | 'pot') => {
    triggerHaptic('selection');
    const totalPot = getTotalPot(tableState);
    let target = minRaiseBet;
    if (preset === '1bb') {
      target = Math.max(minRaiseBet, tableState.currentHighestBet + tableState.bigBlind);
    } else if (preset === 'half-pot') {
      target = Math.max(
        minRaiseBet,
        tableState.currentHighestBet + Math.max(tableState.bigBlind, Math.round(totalPot * 0.5))
      );
    } else if (preset === 'pot') {
      target = Math.max(
        minRaiseBet,
        tableState.currentHighestBet + Math.max(tableState.bigBlind, totalPot)
      );
    }
    setSliderAmount(Math.min(maxHeroBet, target));
  };

  const handleDealNextHand = () => {
    triggerHaptic('light');
    const next = startNewHand(tableState, false);
    setTableState(next);
    savePersistedRoomState(next.roomId, next);
    onBroadcastState?.(next);
  };

  // Swipe handlers for the bottom-right personal widget (NO click/tap toggle)
  const handleWidgetPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleWidgetPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeStartRef.current) return;
    const deltaX = e.clientX - swipeStartRef.current.x;
    const deltaY = e.clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;

    if (deltaY < -18 || deltaX < -20) {
      triggerHaptic('selection');
      setHudOddsMode(true);
    } else if (deltaY > 18 || deltaX > 20) {
      triggerHaptic('selection');
      setHudOddsMode(false);
    }
  };

  const handleWidgetTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (touch) {
      swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleWidgetTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!swipeStartRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - swipeStartRef.current.x;
    const deltaY = touch.clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;

    if (deltaY < -18 || deltaX < -20) {
      triggerHaptic('selection');
      setHudOddsMode(true);
    } else if (deltaY > 18 || deltaX > 20) {
      triggerHaptic('selection');
      setHudOddsMode(false);
    }
  };

  const handleWidgetWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY > 10 || e.deltaX > 10) {
      setHudOddsMode(true);
    } else if (e.deltaY < -10 || e.deltaX < -10) {
      setHudOddsMode(false);
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden w-full bg-black text-white flex justify-center select-none">
      <div
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px) + 14px, 20px)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 12px, 14px)',
        }}
        className="w-full sm:max-w-[480px] h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col justify-between px-4 relative"
      >
        {/* TOP SECTION: Back Arrow + Mode/Invite Badge + 5 Opponents Row */}
        <div className="shrink-0">
          <div className="h-12 flex items-center justify-between mb-1">
            <button
              type="button"
              onClick={handleBackButtonClick}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Salir al menú"
              className="z-40 w-12 h-12 -ml-2 flex items-center justify-center rounded-full text-white hover:bg-white/10 active:bg-white/20 active:scale-95 touch-manipulation cursor-pointer"
            >
              <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
            </button>

            {isRealFriendsRoom ? (
              <button
                type="button"
                onClick={handleShareRoomLink}
                className="z-30 text-[11px] px-3 py-1.5 rounded-full font-medium border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
              >
                {copiedRoomInvite ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t(currentLang, 'tableInviteCopied', { id: tableState.roomId })}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {t(currentLang, 'tableRoomInvite', {
                        id: tableState.roomId,
                        count: seatedCount,
                      })}
                    </span>
                    <Share2 className="w-3 h-3 opacity-80" />
                  </>
                )}
              </button>
            ) : (
              <span className="text-[11px] px-2.5 py-1 rounded-full font-medium border bg-indigo-500/10 border-indigo-500/30 text-indigo-300">
                {t(currentLang, 'practiceBotsBadge', {
                  hand: Math.min(100, tableState.handNumber),
                })}
              </span>
            )}
          </div>

          <TopOpponentsRow
            opponents={opponents}
            dealerIndex={tableState.dealerIndex}
            currentTurnIndex={tableState.currentTurnIndex}
            isShowdown={tableState.street === 'showdown'}
            showdownContenders={tableState.showdownContenders}
            winningCardIds={tableState.winningCardIds}
            language={currentLang}
          />
        </div>

        {/* CENTER SECTION: 5 Community Cards + Bare Animated Pot Number */}
        <div className="my-auto py-1.5 shrink-0">
          <div className="grid grid-cols-5 items-center w-full">
            {[0, 1, 2, 3, 4].map((slotIdx) => {
              const card = tableState.communityCards[slotIdx];
              const isShowdown = tableState.street === 'showdown';
              const winningIds = tableState.winningCardIds ?? [];
              const isWinning = Boolean(isShowdown && card && winningIds.includes(card.id));
              const isDimmed = Boolean(
                isShowdown && winningIds.length > 0 && card && !isWinning
              );
              return (
                <CommunityCardSlot
                  key={slotIdx}
                  index={slotIdx}
                  handNumber={tableState.handNumber}
                  card={card}
                  isWinningCard={isWinning}
                  isDimmed={isDimmed}
                />
              );
            })}
          </div>

          {/* Bare Pot Number directly below the 5th (rightmost) community card */}
          <div className="w-full flex justify-end pr-2 mt-1.5">
            <AnimatedNumber
              value={tableState.collectedPot}
              className="text-[20px] font-normal text-white leading-none"
            />
          </div>
        </div>

        {/* BOTTOM SECTION: Action Controls + Split 2-Column HUD */}
        <div className="flex flex-col gap-2 shrink-0">
          {/* Hero's own current round bet badge + status indicator */}
          <div className="min-h-[22px] flex items-center justify-between px-2">
            <div>
              {hero.currentBet > 0 && (
                <div className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#1a1b1f] text-[#eab308] text-[11.5px] font-semibold flex items-center justify-center">
                  <AnimatedNumber value={hero.currentBet} />
                </div>
              )}
            </div>

            {isRealFriendsRoom && seatedCount < 2 && (
              <div className="flex items-center gap-2 text-[11px] text-[#9ca3af]">
                <span>Esperando amigos en #{tableState.roomId}...</span>
                <button
                  type="button"
                  onClick={handleShareRoomLink}
                  className="px-2.5 py-0.5 rounded-full bg-white text-black font-semibold cursor-pointer active:scale-95"
                >
                  {copiedRoomInvite ? '¡Copiado!' : 'Invitar amigo'}
                </button>
              </div>
            )}

            {/* In Real Friends Mode with 2+ players, show read-only status when waiting on another player's turn */}
            {isRealFriendsRoom &&
              seatedCount >= 2 &&
              tableState.street !== 'showdown' &&
              currentActor &&
              currentActor.id !== hero.id &&
              !isVacantSeat(currentActor) && (
                <div className="flex items-center gap-1.5 text-[11.5px] text-[#8e9099]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>{t(currentLang, 'currentTurnWaiting', { name: currentActor.name })}</span>
                </div>
              )}
          </div>

          {/* Action Controls Row */}
          {tableState.street === 'showdown' ? (
            isBotSessionFinished ? (
              <div className="h-[46px] flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onBack(hero.stack)}
                  className="w-full h-[46px] rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
                >
                  <span>
                    {allBotsEliminated
                      ? t(currentLang, 'allBotsEliminated')
                      : t(currentLang, 'maxHandsReached')}
                    {' · '}
                    {t(currentLang, 'cashOutToMenu', { stack: hero.stack })}
                  </span>
                </button>
              </div>
            ) : hero.stack <= 0 ? (
              <div className="h-[46px] flex items-center gap-2">
                {profileState.bankroll > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={handleRebuy}
                      className="flex-1 h-[46px] rounded-full bg-[#16171a] border border-amber-500/50 text-amber-300 text-[12.5px] font-medium flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                    >
                      <span>
                        {t(currentLang, 'rebuyBuyIn', {
                          amount: Math.min(
                            profileState.bankroll,
                            tableState.tableBuyIn ??
                              (tableState.roomMode === 'bots' ? 100 : 200)
                          ),
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onBack(0)}
                      className="h-[46px] px-4 rounded-full bg-[#16171a] border border-[#23252a] text-[#9ca3af] text-[13px] font-medium active:scale-95 cursor-pointer"
                    >
                      {t(currentLang, 'exitTable')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onBack(0)}
                    className="w-full h-[46px] rounded-full bg-red-500/15 border border-red-500/35 text-red-300 text-[13px] font-medium flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                  >
                    <span>
                      {currentLang === 'en'
                        ? 'Bankrupt (0 chips) · Exit to menu'
                        : currentLang === 'it'
                        ? 'Bancarotta (0 chip) · Esci al menu'
                        : 'Bancarrota (0 fichas) · Salir al menú'}
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div className="h-[46px] flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDealNextHand}
                  className="w-full h-[46px] rounded-full bg-[#16171a] border border-[#23252a] text-white text-[14px] font-medium flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
                >
                  {(() => {
                    const isHeroWinner =
                      tableState.winnerIds.includes(hero.id) ||
                      tableState.winnerIds.includes(profileState.playerId) ||
                      (resolvedHeroIndex === 0 &&
                        (tableState.winnerIds.includes('hero') ||
                          tableState.winnerIds.includes(tableState.players[0]?.id)));
                    const winnerName = isHeroWinner
                      ? currentLang === 'en'
                        ? 'You'
                        : currentLang === 'it'
                        ? 'Hai vinto'
                        : 'Ganaste'
                      : tableState.players.find((p) =>
                          tableState.winnerIds.includes(p.id)
                        )?.name ?? t(currentLang, 'playerFallback');
                    const wonText = isHeroWinner
                      ? currentLang === 'en'
                        ? `You won ${tableState.collectedPot} chips`
                        : currentLang === 'it'
                        ? `Hai vinto ${tableState.collectedPot} chip`
                        : `Ganaste ${tableState.collectedPot} fichas`
                      : currentLang === 'en'
                      ? `${winnerName} won ${tableState.collectedPot} chips`
                      : currentLang === 'it'
                      ? `${winnerName} ha vinto ${tableState.collectedPot} chip`
                      : `${winnerName} ganó ${tableState.collectedPot} fichas`;
                    const handLabel = tableState.winningHandName
                      ? ` · ${formatHandName(tableState.winningHandName, currentLang)}`
                      : '';
                    const nextHandText =
                      currentLang === 'en'
                        ? '· Next hand →'
                        : currentLang === 'it'
                        ? '· Prossima mano →'
                        : '· Siguiente mano →';
                    return (
                      <>
                        <span>
                          {wonText}
                          {handLabel}
                        </span>
                        <span className="text-[#7c7d85] ml-1">{nextHandText}</span>
                      </>
                    );
                  })()}
                </button>
              </div>
            )
          ) : isSliderOpen ? (
            /* CUSTOM RAISE SLIDER MODE */
            <div className="flex flex-col gap-2">
              {/* Top slider row: ↑ <amount> | slider | white circle confirm ↑ */}
              <div className="flex items-center gap-3.5 px-1 h-[32px]">
                <div className="flex items-center gap-1 min-w-[48px] text-white text-[14px] font-medium">
                  <ArrowUp className="w-3.5 h-3.5 stroke-[2.4]" />
                  <span>{sliderAmount}</span>
                </div>

                <div className="flex-1 flex items-center">
                  <input
                    type="range"
                    min={minRaiseBet}
                    max={Math.max(minRaiseBet, maxHeroBet)}
                    step={1}
                    value={sliderAmount}
                    onChange={(e) => setSliderAmount(Number(e.target.value))}
                    className="offsuit-slider"
                  />
                </div>

                <button
                  type="button"
                  disabled={!isHeroTurn}
                  onClick={() =>
                    handleHeroAction({ type: 'raise', raiseToAmount: sliderAmount })
                  }
                  aria-label="Confirm Raise"
                  className="w-[32px] h-[32px] rounded-full bg-white text-black flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Bottom presets row: [1 BB] [1/2 Pot] [Pot] [✕] */}
              <div className="flex items-center gap-2 h-[46px]">
                <button
                  type="button"
                  onClick={() => handlePresetSelect('1bb')}
                  className="flex-1 h-[46px] rounded-full bg-[#16171a] border border-[#23252a] text-white text-[14px] font-normal active:bg-[#1f2025] cursor-pointer"
                >
                  1 BB
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect('half-pot')}
                  className="flex-1 h-[46px] rounded-full bg-[#16171a] border border-[#23252a] text-white text-[14px] font-normal active:bg-[#1f2025] cursor-pointer"
                >
                  1/2 Pot
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect('pot')}
                  className="flex-1 h-[46px] rounded-full bg-[#16171a] border border-[#23252a] text-white text-[14px] font-normal active:bg-[#1f2025] cursor-pointer"
                >
                  Pot
                </button>
                <button
                  type="button"
                  onClick={() => setIsSliderOpen(false)}
                  aria-label="Close Raise Slider"
                  className="w-[46px] h-[46px] rounded-full bg-[#16171a] border border-[#23252a] text-white flex items-center justify-center shrink-0 active:bg-[#1f2025] cursor-pointer"
                >
                  <X className="w-4 h-4 stroke-[2]" />
                </button>
              </div>
            </div>
          ) : (
            /* DEFAULT ACTION MODE */
            <div className="flex items-center gap-2 h-[46px]">
              <button
                type="button"
                disabled={!isHeroTurn}
                onClick={() =>
                  handleHeroAction({ type: toCall === 0 ? 'check' : 'call' })
                }
                className="flex-1 h-[46px] rounded-full bg-[#16171a] border border-[#23252a] text-white text-[15px] font-normal active:bg-[#1f2025] disabled:opacity-45 cursor-pointer"
              >
                {toCall === 0 ? t(currentLang, 'check') : `${t(currentLang, 'call')} ${toCall}`}
              </button>

              <button
                type="button"
                disabled={!isHeroTurn || hero.stack <= toCall}
                onClick={() =>
                  handleHeroAction({ type: 'raise', raiseToAmount: minRaiseBet })
                }
                className="flex-1 h-[46px] rounded-full bg-[#16171a] border border-[#23252a] text-white text-[15px] font-normal active:bg-[#1f2025] disabled:opacity-45 cursor-pointer"
              >
                {t(currentLang, 'raise')} {minRaiseBet}
              </button>

              <button
                type="button"
                disabled={!isHeroTurn || hero.stack <= toCall}
                onClick={() => setIsSliderOpen(true)}
                aria-label="Custom Raise Slider"
                className="w-[46px] h-[46px] rounded-full bg-[#16171a] border border-[#23252a] text-white flex items-center justify-center shrink-0 active:bg-[#1f2025] disabled:opacity-45 cursor-pointer"
              >
                <ArrowUp className="w-4 h-4 stroke-[2]" />
              </button>
            </div>
          )}

          {/* BOTTOM SPLIT HUD: Left (2 Draggable/Flickable Hole Cards) | Right (Swipeable Player/Odds Widget) */}
          <div className="grid grid-cols-2 gap-3 h-[128px] items-stretch relative">
            {/* Left Column: Unified 2 Hole Cards with dealing animation + Throw-to-Fold upward flick gesture */}
            {(() => {
              const isShowdown = tableState.street === 'showdown';
              const heroContender = tableState.showdownContenders?.find(
                (c) =>
                  c.playerId === hero.id ||
                  c.playerId === profileState.playerId ||
                  (resolvedHeroIndex === 0 &&
                    (c.playerId === 'hero' ||
                      c.playerId === tableState.players[0]?.id))
              );
              return (
                <HoleCardsBlock
                  cards={hero.holeCards}
                  handNumber={tableState.handNumber}
                  folded={hero.status === 'folded'}
                  canDragToFold={isHeroTurn}
                  onFoldTrigger={() => handleHeroAction({ type: 'fold' })}
                  winningCardIds={tableState.winningCardIds}
                  heroBestFiveIds={heroContender?.bestFiveCardIds}
                  isShowdown={isShowdown}
                />
              );
            })()}

            {/* Right Column: Swipeable Dark Rounded HUD Container (Swipe Up/Down or Left/Right to switch faces) */}
            <div className="relative h-[128px]">
              <div
                role="region"
                aria-label="Desliza para cambiar entre ficha de jugador y probabilidades"
                onPointerDown={handleWidgetPointerDown}
                onPointerUp={handleWidgetPointerUp}
                onTouchStart={handleWidgetTouchStart}
                onTouchEnd={handleWidgetTouchEnd}
                onWheel={handleWidgetWheel}
                className="w-full h-full bg-[#16171a] rounded-[22px] py-2.5 px-3.5 flex flex-col items-center justify-between text-center overflow-hidden touch-none select-none cursor-ns-resize"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {!hudOddsMode ? (
                    /* FACE 1: Hand Category + 3D Avatar + Animated Stack with Red/Green Flash */
                    <motion.div
                      key="hud-face-avatar"
                      initial={{ opacity: 0, y: -22 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -22 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="w-full h-full flex flex-col items-center justify-between"
                    >
                      <span className="text-[11.5px] font-medium text-[#7c7d85] leading-none">
                        {formatHandName(heroHandEval.categoryName, currentLang)}
                      </span>

                      <div className="my-auto relative flex items-center justify-center">
                        <Avatar3D avatarId={profileState.avatarId} size={44} />
                        {tableState.dealerIndex === resolvedHeroIndex && (
                          <div className="absolute -bottom-0.5 -right-1 w-[15px] h-[15px] rounded-full bg-white text-black text-[9.5px] font-bold flex items-center justify-center shadow">
                            D
                          </div>
                        )}
                      </div>

                      <AnimatedNumber
                        value={hero.stack}
                        flashColorOnChange={true}
                        className="text-[19px] font-normal leading-none"
                      />
                    </motion.div>
                  ) : (
                    /* FACE 2: Odds Mode — Win % in amber/gold + Next Hand % in white */
                    <motion.div
                      key="hud-face-odds"
                      initial={{ opacity: 0, y: 22 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 22 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="w-full h-full flex flex-col items-center justify-center gap-2"
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] font-medium text-[#7c7d85] leading-tight">
                          {t(currentLang, 'winOddsTitle')}
                        </span>
                        <span className="text-[20px] font-normal text-[#f59e0b] leading-tight mt-0.5">
                          {heroEquity.winPct}%
                        </span>
                      </div>

                      <div className="flex flex-col items-center">
                        <span className="text-[11px] font-medium text-[#7c7d85] leading-tight">
                          {formatHandName(heroEquity.nextHandLabel, currentLang)}
                        </span>
                        <span className="text-[20px] font-normal text-white leading-tight mt-0.5">
                          {heroEquity.nextHandPct}%
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Tiny 2 vertical pagination dots on far right edge */}
              <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 pointer-events-none">
                <span
                  className={`w-1 h-1 rounded-full transition-colors ${
                    !hudOddsMode ? 'bg-white' : 'bg-[#3f414a]'
                  }`}
                />
                <span
                  className={`w-1 h-1 rounded-full transition-colors ${
                    hudOddsMode ? 'bg-white' : 'bg-[#3f414a]'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* LEAVE MID-HAND CONFIRMATION MODAL (Stack Protection) */}
        {isLeaveConfirmOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-[360px] bg-[#16171b] border border-[#282a33] rounded-[24px] p-5 flex flex-col gap-4 shadow-2xl">
              <div className="flex flex-col gap-1.5 text-center">
                <h3 className="text-[17px] font-semibold text-white">
                  {t(currentLang, 'leaveHandTitle')}
                </h3>
                <p className="text-[13px] text-[#9ca3af] leading-snug">
                  {t(currentLang, 'leaveHandDesc')}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setIsLeaveConfirmOpen(false)}
                  className="w-full h-11 rounded-full bg-white text-black text-[14px] font-semibold active:scale-95 transition-transform cursor-pointer"
                >
                  {t(currentLang, 'stayBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLeaveConfirmOpen(false);
                    onBack(hero.stack, false);
                  }}
                  className="w-full h-11 rounded-full bg-[#1e2028] border border-[#2e313d] text-white text-[13.5px] font-medium active:scale-95 transition-transform cursor-pointer"
                >
                  {currentLang === 'en'
                    ? 'Return to menu (keep seat & chips)'
                    : currentLang === 'it'
                    ? 'Torna al menu (mantieni posto e chip)'
                    : 'Ir al menú (mantener asiento y fichas)'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFoldAndLeave}
                  className="w-full h-11 rounded-full bg-[#23252a] text-[#ef4444] text-[13.5px] font-semibold active:scale-95 transition-transform cursor-pointer"
                >
                  {t(currentLang, 'leaveConfirmBtn')} (Fold)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
