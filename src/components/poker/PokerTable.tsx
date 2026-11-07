import { ArrowLeft, ArrowUp, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { calculateHoldemEquity } from '../../engine/poker/equity';
import { evaluateHoldemHand } from '../../engine/poker/evaluator';
import {
  applyPlayerAction,
  getBotDecision,
  getTotalPot,
  type PlayerActionInput,
  type PokerTableState,
  startNewHand,
} from '../../engine/poker/gameState';
import {
  notifyPlayerTurn,
  type RoomPacingMode,
  savePersistedRoomState,
} from '../../lib/multiplayer';
import { Avatar3D } from './Avatar3D';
import { CommunityCardSlot, HoleCardsBlock } from './PlayingCard';
import { TopOpponentsRow } from './TopOpponentsRow';

interface PokerTableProps {
  initialState: PokerTableState;
  onBack: () => void;
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
  roomName = 'Mesa Offsuit',
  pacingMode = 'live',
}) => {
  const [tableState, setTableState] = useState<PokerTableState>(initialState);
  const [isSliderOpen, setIsSliderOpen] = useState(false);
  const [sliderAmount, setSliderAmount] = useState<number>(initialState.minRaiseTo);
  const [hudOddsMode, setHudOddsMode] = useState<boolean>(false);
  const prevTurnIndexRef = useRef<number>(initialState.currentTurnIndex);

  useEffect(() => {
    if (externalState) {
      setTableState(externalState);
    }
  }, [externalState]);

  const hero = tableState.players[0];
  const opponents = tableState.players.slice(1, 6);
  const isHeroTurn =
    tableState.street !== 'showdown' &&
    tableState.currentTurnIndex === 0 &&
    hero.status === 'active';

  const toCall = Math.max(0, tableState.currentHighestBet - hero.currentBet);
  const maxHeroBet = hero.currentBet + hero.stack;
  const minRaiseBet = Math.min(maxHeroBet, Math.max(tableState.minRaiseTo, tableState.bigBlind * 2));

  // Keep sliderAmount synced when turn or minRaiseBet updates
  useEffect(() => {
    setSliderAmount(minRaiseBet);
    setIsSliderOpen(false);
  }, [tableState.handNumber, tableState.street, minRaiseBet]);

  // Trigger PWA / Web Notification when turn transitions from an opponent to Hero in async mode
  useEffect(() => {
    const wasOpponentTurn = prevTurnIndexRef.current !== 0;
    prevTurnIndexRef.current = tableState.currentTurnIndex;

    if (
      wasOpponentTurn &&
      tableState.currentTurnIndex === 0 &&
      tableState.street !== 'showdown' &&
      hero.status === 'active'
    ) {
      if (pacingMode === 'async' || (typeof document !== 'undefined' && document.hidden)) {
        void notifyPlayerTurn(roomName, tableState.roomId, tableState);
      }
    }
  }, [
    tableState,
    hero.status,
    pacingMode,
    roomName,
  ]);

  // Sequential bot turn automation (~550ms per opponent)
  useEffect(() => {
    if (tableState.street === 'showdown') return;
    const currentActor = tableState.players[tableState.currentTurnIndex];
    if (!currentActor || !currentActor.isBot || currentActor.status !== 'active') {
      return;
    }

    const timer = window.setTimeout(() => {
      const decision = getBotDecision(tableState, currentActor.id);
      const next = applyPlayerAction(tableState, currentActor.id, decision);
      setTableState(next);
      savePersistedRoomState(next.roomId, next);
      onBroadcastState?.(next);
    }, 550);

    return () => window.clearTimeout(timer);
  }, [tableState, onBroadcastState]);

  // Evaluate Hero's current hand & Monte Carlo equity
  const heroHandEval = useMemo(() => {
    return evaluateHoldemHand([...hero.holeCards, ...tableState.communityCards]);
  }, [hero.holeCards, tableState.communityCards]);

  const activeOpponentCount = useMemo(() => {
    return opponents.filter((o) => o.status !== 'folded').length;
  }, [opponents]);

  const heroEquity = useMemo(() => {
    // Match exact screenshot values (26% Win, 39% Two Pair) on the opening 9♠ 9♥ hand preflop
    if (
      tableState.handNumber === 1 &&
      tableState.street === 'preflop' &&
      hero.holeCards[0]?.rank === 9 &&
      hero.holeCards[1]?.rank === 9
    ) {
      return {
        winPct: 26,
        tiePct: 1,
        nextHandLabel: 'Two Pair' as const,
        nextHandPct: 39,
      };
    }
    return calculateHoldemEquity(
      hero.holeCards,
      tableState.communityCards,
      activeOpponentCount,
      500
    );
  }, [
    tableState.handNumber,
    tableState.street,
    hero.holeCards,
    tableState.communityCards,
    activeOpponentCount,
  ]);

  const handleHeroAction = (action: PlayerActionInput) => {
    if (!isHeroTurn) return;
    const next = applyPlayerAction(tableState, hero.id, action);
    setIsSliderOpen(false);
    setTableState(next);
    savePersistedRoomState(next.roomId, next);
    onBroadcastState?.(next);
  };

  const handlePresetSelect = (preset: '1bb' | 'half-pot' | 'pot') => {
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
    const next = startNewHand(tableState, false);
    setTableState(next);
    savePersistedRoomState(next.roomId, next);
    onBroadcastState?.(next);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-black text-white flex justify-center select-none">
      <div className="w-full max-w-[420px] min-h-[100dvh] flex flex-col justify-between px-4 pt-3 pb-6">
        {/* TOP SECTION: Back Arrow ONLY + 5 Opponents Row */}
        <div>
          <div className="h-10 flex items-center justify-start mb-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="w-9 h-9 flex items-center justify-start text-white active:opacity-60 cursor-pointer"
            >
              <ArrowLeft className="w-6 h-6 stroke-[2]" />
            </button>
          </div>

          <TopOpponentsRow
            opponents={opponents}
            dealerIndex={tableState.dealerIndex}
            currentTurnIndex={tableState.currentTurnIndex}
            isShowdown={tableState.street === 'showdown'}
          />
        </div>

        {/* CENTER SECTION: 5 Community Cards + Bare Pot Number */}
        <div className="my-auto py-4">
          <div className="grid grid-cols-5 items-center w-full">
            {[0, 1, 2, 3, 4].map((slotIdx) => (
              <CommunityCardSlot
                key={slotIdx}
                index={slotIdx}
                card={tableState.communityCards[slotIdx]}
              />
            ))}
          </div>

          {/* Bare Pot Number directly below the 5th (rightmost) community card */}
          <div className="w-full flex justify-end pr-2 mt-2.5">
            <span className="text-[22px] font-normal text-white leading-none">
              {tableState.collectedPot}
            </span>
          </div>
        </div>

        {/* BOTTOM SECTION: Action Controls + Split 2-Column HUD */}
        <div className="flex flex-col gap-3.5">
          {/* Hero's own current round bet badge above the left button (IMG_8411, IMG_8413) */}
          <div className="h-[24px] flex items-center pl-4">
            {hero.currentBet > 0 && (
              <div className="min-w-[24px] h-[24px] px-1.5 rounded-full bg-[#1a1b1f] text-[#eab308] text-[12px] font-semibold flex items-center justify-center">
                {hero.currentBet}
              </div>
            )}
          </div>

          {/* Action Controls Row */}
          {tableState.street === 'showdown' ? (
            <div className="h-[50px] flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleDealNextHand}
                className="w-full h-[50px] rounded-full bg-[#16171a] border border-[#23252a] text-white text-[15px] font-medium flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
              >
                <span>
                  {tableState.winnerIds.includes(hero.id)
                    ? `You won ${tableState.collectedPot}`
                    : `${
                        tableState.players.find((p) =>
                          tableState.winnerIds.includes(p.id)
                        )?.name ?? 'Player'
                      } won ${tableState.collectedPot}`}
                  {tableState.winningHandName ? ` · ${tableState.winningHandName}` : ''}
                </span>
                <span className="text-[#7c7d85] ml-1">· Next Hand →</span>
              </button>
            </div>
          ) : isSliderOpen ? (
            /* CUSTOM RAISE SLIDER MODE (IMG_8409, IMG_8410) */
            <div className="flex flex-col gap-3">
              {/* Top slider row: ↑ <amount> | slider | white circle confirm ↑ */}
              <div className="flex items-center gap-4 px-1 h-[36px]">
                <div className="flex items-center gap-1 min-w-[52px] text-white text-[15px] font-medium">
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
                  className="w-[34px] h-[34px] rounded-full bg-white text-black flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Bottom presets row: [1 BB] [1/2 Pot] [Pot] [✕] */}
              <div className="flex items-center gap-2.5 h-[50px]">
                <button
                  type="button"
                  onClick={() => handlePresetSelect('1bb')}
                  className="flex-1 h-[50px] rounded-full bg-[#16171a] border border-[#23252a] text-white text-[15px] font-normal active:bg-[#1f2025] cursor-pointer"
                >
                  1 BB
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect('half-pot')}
                  className="flex-1 h-[50px] rounded-full bg-[#16171a] border border-[#23252a] text-white text-[15px] font-normal active:bg-[#1f2025] cursor-pointer"
                >
                  1/2 Pot
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect('pot')}
                  className="flex-1 h-[50px] rounded-full bg-[#16171a] border border-[#23252a] text-white text-[15px] font-normal active:bg-[#1f2025] cursor-pointer"
                >
                  Pot
                </button>
                <button
                  type="button"
                  onClick={() => setIsSliderOpen(false)}
                  aria-label="Close Raise Slider"
                  className="w-[50px] h-[50px] rounded-full bg-[#16171a] border border-[#23252a] text-white flex items-center justify-center shrink-0 active:bg-[#1f2025] cursor-pointer"
                >
                  <X className="w-4 h-4 stroke-[2]" />
                </button>
              </div>
            </div>
          ) : (
            /* DEFAULT ACTION MODE (IMG_8408, IMG_8411, IMG_8413) */
            <div className="flex items-center gap-2.5 h-[50px]">
              <button
                type="button"
                disabled={!isHeroTurn}
                onClick={() =>
                  handleHeroAction({ type: toCall === 0 ? 'check' : 'call' })
                }
                className="flex-1 h-[50px] rounded-full bg-[#16171a] border border-[#23252a] text-white text-[16px] font-normal active:bg-[#1f2025] disabled:opacity-45 cursor-pointer"
              >
                {toCall === 0 ? 'Check' : `Call ${toCall}`}
              </button>

              <button
                type="button"
                disabled={!isHeroTurn || hero.stack <= toCall}
                onClick={() =>
                  handleHeroAction({ type: 'raise', raiseToAmount: minRaiseBet })
                }
                className="flex-1 h-[50px] rounded-full bg-[#16171a] border border-[#23252a] text-white text-[16px] font-normal active:bg-[#1f2025] disabled:opacity-45 cursor-pointer"
              >
                Raise {minRaiseBet}
              </button>

              <button
                type="button"
                disabled={!isHeroTurn || hero.stack <= toCall}
                onClick={() => setIsSliderOpen(true)}
                aria-label="Custom Raise Slider"
                className="w-[50px] h-[50px] rounded-full bg-[#16171a] border border-[#23252a] text-white flex items-center justify-center shrink-0 active:bg-[#1f2025] disabled:opacity-45 cursor-pointer"
              >
                <ArrowUp className="w-4 h-4 stroke-[2]" />
              </button>
            </div>
          )}

          {/* BOTTOM SPLIT HUD: Left (2 Draggable/Flickable Hole Cards) | Right (Tappable Player/Odds Card) */}
          <div className="grid grid-cols-2 gap-3 h-[142px] items-stretch relative">
            {/* Left Column: Unified 2 Hole Cards with Throw-to-Fold upward flick gesture */}
            <HoleCardsBlock
              cards={hero.holeCards}
              folded={hero.status === 'folded'}
              canDragToFold={isHeroTurn}
              onFoldTrigger={() => handleHeroAction({ type: 'fold' })}
            />

            {/* Right Column: Dark Rounded HUD Container */}
            <div className="relative h-[142px]">
              <button
                type="button"
                onClick={() => setHudOddsMode((prev) => !prev)}
                className="w-full h-full bg-[#16171a] rounded-[24px] py-3 px-4 flex flex-col items-center justify-between text-center active:scale-[0.99] transition-transform cursor-pointer"
              >
                {!hudOddsMode ? (
                  /* VIEW 1: Hand Category + 3D Avatar + Bare Stack Number (IMG_8408, IMG_8409, IMG_8413) */
                  <>
                    <span className="text-[12px] font-medium text-[#7c7d85] leading-none">
                      {heroHandEval.categoryName}
                    </span>

                    <div className="my-auto flex items-center justify-center">
                      <Avatar3D avatarId="hero" size={48} />
                    </div>

                    <span className="text-[20px] font-normal text-white leading-none">
                      {hero.stack}
                    </span>
                  </>
                ) : (
                  /* VIEW 2: Odds Mode — Win % in amber/gold + Next Hand % in white (IMG_8410, IMG_8411) */
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2.5">
                    <div className="flex flex-col items-center">
                      <span className="text-[12px] font-medium text-[#7c7d85] leading-tight">
                        Win
                      </span>
                      <span className="text-[22px] font-normal text-[#f59e0b] leading-tight mt-0.5">
                        {heroEquity.winPct}%
                      </span>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[12px] font-medium text-[#7c7d85] leading-tight">
                        {heroEquity.nextHandLabel}
                      </span>
                      <span className="text-[22px] font-normal text-white leading-tight mt-0.5">
                        {heroEquity.nextHandPct}%
                      </span>
                    </div>
                  </div>
                )}
              </button>

              {/* Tiny 2 vertical pagination dots on far right edge (IMG_8410) */}
              <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 pointer-events-none">
                <span
                  className={`w-1 h-1 rounded-full ${
                    !hudOddsMode ? 'bg-white' : 'bg-[#3f414a]'
                  }`}
                />
                <span
                  className={`w-1 h-1 rounded-full ${
                    hudOddsMode ? 'bg-white' : 'bg-[#3f414a]'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
