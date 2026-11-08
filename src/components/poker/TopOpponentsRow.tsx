import React from 'react';
import type { Player } from '../../engine/types';
import { AnimatedNumber } from './AnimatedNumber';
import { Avatar3D } from './Avatar3D';

interface TopOpponentsRowProps {
  opponents: Player[]; // 5 opponent seats around the table
  dealerIndex: number;
  currentTurnIndex: number;
  isShowdown?: boolean;
}

export const TopOpponentsRow: React.FC<TopOpponentsRowProps> = ({
  opponents,
  dealerIndex,
  currentTurnIndex,
  isShowdown = false,
}) => {
  return (
    <div className="grid grid-cols-5 gap-1 w-full pt-0.5">
      {opponents.map((opp) => {
        const isVacant = opp.id.startsWith('empty-');

        if (isVacant) {
          return (
            <div key={opp.id} className="flex flex-col items-center opacity-55">
              <div className="h-2.5 mb-0.5" />
              <div className="w-[48px] h-[48px] rounded-full border border-dashed border-[#2b2e38] bg-[#111216] flex items-center justify-center text-[#5e6068] text-[16px] font-light">
                +
              </div>
              <span className="mt-1 text-[10px] font-normal leading-tight text-[#6b6d76] truncate max-w-[62px]">
                Esperando...
              </span>
              <span className="mt-0.5 text-[10.5px] font-normal leading-tight text-[#4b4d55]">
                Libre
              </span>
              <div className="h-[22px] mt-1" />
            </div>
          );
        }

        const isEliminated = opp.status === 'out' || opp.stack <= 0;
        const isDealer = !isEliminated && opp.seatIndex === dealerIndex;
        const isTurn = !isShowdown && !isEliminated && opp.seatIndex === currentTurnIndex;
        const isFolded = opp.status === 'folded';
        const showOverlayText = isEliminated
          ? 'OUT'
          : opp.lastAction === 'Fold' || opp.lastAction === 'Raise'
          ? opp.lastAction
          : null;

        return (
          <div key={opp.id} className="flex flex-col items-center">
            {/* Subtle top turn indicator triangle (▼) */}
            <div className="h-2.5 flex items-center justify-center mb-0.5">
              {isTurn && !isFolded && (
                <span className="text-[8px] leading-none text-white opacity-90 transition-opacity duration-150">
                  ▼
                </span>
              )}
            </div>

            {/* Avatar + Dealer 'D' Badge + Action Overlay */}
            <div className="relative w-[48px] h-[48px] flex items-center justify-center">
              <div
                className={`transition-opacity duration-200 ${
                  isEliminated
                    ? 'opacity-20 grayscale'
                    : isFolded || showOverlayText === 'Raise'
                    ? 'opacity-30'
                    : 'opacity-100'
                }`}
              >
                <Avatar3D avatarId={opp.avatarId} size={48} />
              </div>

              {/* Action text overlay on avatar ('OUT', 'Fold', or 'Raise') */}
              {showOverlayText && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span
                    className={`text-[11px] font-semibold tracking-tight ${
                      isEliminated
                        ? 'text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded-full border border-red-500/30'
                        : showOverlayText === 'Fold'
                        ? 'text-white/55'
                        : 'text-white'
                    }`}
                  >
                    {showOverlayText}
                  </span>
                </div>
              )}

              {/* Small white circle with black 'D' at bottom-right of dealer's avatar */}
              {isDealer && (
                <div
                  className={`absolute -bottom-0.5 right-0 w-[16px] h-[16px] rounded-full bg-white text-black text-[10px] font-bold flex items-center justify-center shadow-md ${
                    isFolded ? 'opacity-45' : 'opacity-100'
                  }`}
                >
                  D
                </div>
              )}
            </div>

            {/* Player Name in subtle gray (#7c7d85) */}
            <span
              className={`mt-1 text-[10.5px] font-normal leading-tight text-[#7c7d85] truncate max-w-[64px] ${
                isEliminated ? 'opacity-30 line-through' : isFolded ? 'opacity-40' : 'opacity-100'
              }`}
            >
              {opp.name}
            </span>

            {/* Stack count directly below in white (smoothly animated) */}
            <span
              className={`mt-0.5 text-[12px] font-medium leading-tight ${
                isEliminated ? 'text-red-400/60' : isFolded ? 'text-white opacity-30' : 'text-white'
              }`}
            >
              <AnimatedNumber value={opp.stack} />
            </span>

            {/* Current round bet badge in small dark circle with yellow/gold number */}
            <div className="h-[22px] mt-1 flex items-center justify-center">
              {opp.currentBet > 0 && (
                <div className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#1a1b1f] text-[#eab308] text-[11px] font-semibold flex items-center justify-center">
                  <AnimatedNumber value={opp.currentBet} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
