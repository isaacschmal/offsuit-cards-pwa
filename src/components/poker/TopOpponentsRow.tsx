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
    <div className="grid grid-cols-5 gap-1 w-full pt-1">
      {opponents.map((opp) => {
        const isVacant = opp.id.startsWith('empty-');

        if (isVacant) {
          return (
            <div key={opp.id} className="flex flex-col items-center opacity-55">
              <div className="h-3 mb-1" />
              <div className="w-[54px] h-[54px] rounded-full border border-dashed border-[#2b2e38] bg-[#111216] flex items-center justify-center text-[#5e6068] text-[18px] font-light">
                +
              </div>
              <span className="mt-2 text-[10.5px] font-normal leading-tight text-[#6b6d76] truncate max-w-[64px]">
                Esperando...
              </span>
              <span className="mt-0.5 text-[11px] font-normal leading-tight text-[#4b4d55]">
                Libre
              </span>
              <div className="h-[28px] mt-2" />
            </div>
          );
        }

        const isDealer = opp.seatIndex === dealerIndex;
        const isTurn = !isShowdown && opp.seatIndex === currentTurnIndex;
        const isFolded = opp.status === 'folded';
        const showOverlayText =
          opp.lastAction === 'Fold' || opp.lastAction === 'Raise'
            ? opp.lastAction
            : null;

        return (
          <div key={opp.id} className="flex flex-col items-center">
            {/* Subtle top turn indicator triangle (▼) */}
            <div className="h-3 flex items-center justify-center mb-1">
              {isTurn && !isFolded && (
                <span className="text-[8px] leading-none text-white opacity-90 transition-opacity duration-150">
                  ▼
                </span>
              )}
            </div>

            {/* Avatar + Dealer 'D' Badge + Action Overlay */}
            <div className="relative w-[54px] h-[54px] flex items-center justify-center">
              <div
                className={`transition-opacity duration-200 ${
                  isFolded || showOverlayText === 'Raise' ? 'opacity-30' : 'opacity-100'
                }`}
              >
                <Avatar3D avatarId={opp.avatarId} size={54} />
              </div>

              {/* Action text overlay on avatar ('Fold' or 'Raise') */}
              {showOverlayText && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span
                    className={`text-[13px] font-medium tracking-tight ${
                      showOverlayText === 'Fold' ? 'text-white/55' : 'text-white'
                    }`}
                  >
                    {showOverlayText}
                  </span>
                </div>
              )}

              {/* Small white circle with black 'D' at bottom-right of dealer's avatar */}
              {isDealer && (
                <div
                  className={`absolute -bottom-0.5 right-0.5 w-[18px] h-[18px] rounded-full bg-white text-black text-[11px] font-bold flex items-center justify-center shadow-md ${
                    isFolded ? 'opacity-45' : 'opacity-100'
                  }`}
                >
                  D
                </div>
              )}
            </div>

            {/* Player Name in subtle gray (#7c7d85) */}
            <span
              className={`mt-2 text-[11px] font-normal leading-tight text-[#7c7d85] truncate max-w-[66px] ${
                isFolded ? 'opacity-40' : 'opacity-100'
              }`}
            >
              {opp.name}
            </span>

            {/* Stack count directly below in white (smoothly animated) */}
            <span
              className={`mt-0.5 text-[13px] font-medium leading-tight text-white ${
                isFolded ? 'opacity-30' : 'opacity-100'
              }`}
            >
              <AnimatedNumber value={opp.stack} />
            </span>

            {/* Current round bet badge in small dark circle with yellow/gold number */}
            <div className="h-[28px] mt-2 flex items-center justify-center">
              {opp.currentBet > 0 && (
                <div className="min-w-[24px] h-[24px] px-1.5 rounded-full bg-[#1a1b1f] text-[#eab308] text-[12px] font-semibold flex items-center justify-center">
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
