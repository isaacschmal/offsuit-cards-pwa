import { motion, type PanInfo } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { formatRank, isRedSuit } from '../../engine/deck';
import type { Card, Suit } from '../../engine/types';
import { triggerHaptic } from '../../lib/haptics';
import {
  CARD_BACK_THEMES,
  type CardBackColorId,
  loadUserProfile,
} from '../../lib/profile';

interface SuitGraphicProps {
  suit: Suit;
  size?: number;
}

export const SuitGraphic: React.FC<SuitGraphicProps> = ({ suit, size = 22 }) => {
  const color = isRedSuit(suit) ? '#ef4444' : '#18181b';

  if (suit === 'hearts') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }

  if (suit === 'diamonds') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 2L20.5 12L12 22L3.5 12L12 2Z" />
      </svg>
    );
  }

  if (suit === 'spades') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 2C7 8 3 11.5 3 15a5.5 5.5 0 0 0 7.5 5.1L9 22h6l-1.5-1.9A5.5 5.5 0 0 0 21 15c0-3.5-4-7-9-13z" />
      </svg>
    );
  }

  // clubs
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 3a4.5 4.5 0 0 0-4.05 6.45A4.5 4.5 0 1 0 9.5 18.2L8 21h8l-1.5-2.8a4.5 4.5 0 1 0 1.55-8.75A4.5 4.5 0 0 0 12 3z" />
    </svg>
  );
};

export interface CardBackProps {
  className?: string;
  colorId?: CardBackColorId;
}

/**
 * Clean static geometric card back with white outer border and concentric diamond emblem.
 * Supports customizable colors ('slate' #9aa3aa, 'indigo' #6366f1, 'emerald' #10b981, 'crimson' #e11d48).
 */
export const OffsuitCardBack: React.FC<CardBackProps> = ({
  className = '',
  colorId,
}) => {
  const [prefColor, setPrefColor] = useState<CardBackColorId>(
    () => loadUserProfile().cardBackColor
  );

  useEffect(() => {
    const handleProfileUpdate = () => {
      setPrefColor(loadUserProfile().cardBackColor);
    };
    window.addEventListener('cartas-profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('cartas-profile-updated', handleProfileUpdate);
    };
  }, []);

  const activeColorId = colorId ?? prefColor;
  const theme = CARD_BACK_THEMES[activeColorId] ?? CARD_BACK_THEMES.slate;

  return (
    <div
      className={`relative bg-white p-[3px] rounded-[18px] overflow-hidden select-none ${className}`}
    >
      <div
        className="w-full h-full rounded-[15px] relative overflow-hidden flex items-center justify-center transition-colors duration-200"
        style={{ backgroundColor: theme.hex }}
      >
        <svg
          viewBox="0 0 100 142"
          className="absolute inset-0 w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Thin geometric line & interlocking ring pattern */}
          <g stroke="rgba(255,255,255,0.42)" strokeWidth="1">
            <rect x="6" y="6" width="88" height="130" rx="10" stroke="rgba(255,255,255,0.32)" />
            <line x1="50" y1="6" x2="50" y2="136" />
            <line x1="6" y1="71" x2="94" y2="71" />
            <circle cx="50" cy="71" r="44" />
            <circle cx="50" cy="71" r="30" />
            <circle cx="50" cy="20" r="14" />
            <polygon points="50,12 56,20 50,28 44,20" stroke="rgba(255,255,255,0.55)" />
            <circle cx="50" cy="122" r="14" />
            <polygon points="50,114 56,122 50,130 44,122" stroke="rgba(255,255,255,0.55)" />
            <path d="M10 14 Q50 52 90 14" />
            <path d="M10 128 Q50 90 90 128" />
          </g>

          {/* Central solid medallion with crisp double border */}
          <circle
            cx="50"
            cy="71"
            r="24"
            fill={theme.hex}
            stroke="rgba(255,255,255,0.68)"
            strokeWidth="1.3"
          />
          <circle
            cx="50"
            cy="71"
            r="19.5"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="0.9"
          />

          {/* Clean geometric diamond/compass centerpiece (replaces 12-spoke wheel) */}
          <polygon
            points="50,53 64,71 50,89 36,71"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <polygon
            points="50,59.5 58.5,71 50,82.5 41.5,71"
            fill="#ffffff"
            fillOpacity="0.92"
          />
          <polygon
            points="50,65.5 54,71 50,76.5 46,71"
            fill={theme.hex}
          />
        </svg>
      </div>
    </div>
  );
};

export const CardBack = OffsuitCardBack;

interface CommunityCardSlotProps {
  card?: Card;
  index: number;
  handNumber?: number;
  cardBackColor?: CardBackColorId;
  isWinningCard?: boolean;
  isDimmed?: boolean;
}

/**
 * 3D Perspective Community Card Slot.
 * Animates dealing in from the top deck whenever `handNumber` changes,
 * and animates `rotateY` from 0deg to 180deg when revealed on Flop/Turn/River.
 */
export const CommunityCardSlot: React.FC<CommunityCardSlotProps> = ({
  card,
  index,
  handNumber = 1,
  cardBackColor,
  isWinningCard = false,
  isDimmed = false,
}) => {
  const overlapClass = index > 0 ? '-ml-[3px]' : '';
  const [lastRevealedCard, setLastRevealedCard] = useState<Card | undefined>(card);

  useEffect(() => {
    if (card) {
      setLastRevealedCard(card);
    }
  }, [card]);

  const displayCard = card ?? lastRevealedCard;
  const isRevealed = Boolean(card);
  const red = displayCard ? isRedSuit(displayCard.suit) : false;
  const rankText = displayCard ? formatRank(displayCard.rank) : '';

  // Staggered delay on the flop (cards 0, 1, 2), immediate subtle flip on turn/river
  const flipDelay = isRevealed ? (index < 3 ? index * 0.14 : 0.04) : 0;

  return (
    <motion.div
      key={`community-deal-${handNumber}-${index}`}
      initial={{ opacity: 0, y: -45, scale: 0.78 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.38,
        delay: index * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`w-full aspect-[0.71] relative select-none ${overlapClass}`}
      style={{ perspective: '1000px' }}
    >
      <motion.div
        className="w-full h-full relative"
        style={{ transformStyle: 'preserve-3d' }}
        initial={false}
        animate={{ rotateY: isRevealed ? 180 : 0 }}
        transition={{
          duration: 0.48,
          delay: flipDelay,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {/* Back Face (0deg) */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(0deg)',
          }}
        >
          <OffsuitCardBack
            colorId={cardBackColor}
            className="w-full h-full shadow-[-4px_0_12px_rgba(0,0,0,0.22)]"
          />
        </div>

        {/* Front Face (180deg) */}
        <div
          className={`absolute inset-0 w-full h-full bg-white rounded-[18px] p-2.5 flex flex-col justify-between items-start transition-all duration-300 ${
            isWinningCard
              ? 'ring-[2.5px] ring-[#eab308] shadow-[0_0_18px_rgba(234,179,8,0.55)] z-20 scale-[1.04]'
              : isDimmed
              ? 'opacity-30 filter grayscale(50%)'
              : 'shadow-[-6px_0_16px_rgba(0,0,0,0.18)]'
          }`}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {displayCard && (
            <>
              <span
                className={`text-[26px] font-normal leading-none tracking-tight ${
                  red ? 'text-[#ef4444]' : 'text-[#18181b]'
                }`}
              >
                {rankText}
              </span>
              <div className="pl-0.5 pb-0.5">
                <SuitGraphic suit={displayCard.suit} size={19} />
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

interface HoleCardsBlockProps {
  cards: Card[];
  handNumber?: number;
  folded?: boolean;
  canDragToFold?: boolean;
  onFoldTrigger?: () => void;
  winningCardIds?: string[];
  heroBestFiveIds?: string[];
  isShowdown?: boolean;
}

/**
 * Bottom-left 2 overlapping hole cards block matching IMG_8408 - IMG_8413.
 * Animates each hole card flying in from the center deck on each new hand (`handNumber`),
 * and supports Offsuit's signature Throw-to-Fold upward flick/drag gesture.
 */
export const HoleCardsBlock: React.FC<HoleCardsBlockProps> = ({
  cards,
  handNumber = 1,
  folded = false,
  canDragToFold = false,
  onFoldTrigger,
  winningCardIds,
  heroBestFiveIds,
  isShowdown = false,
}) => {
  const [isThrown, setIsThrown] = useState(false);

  // Reset thrown state when a new hand starts or player is no longer folded
  useEffect(() => {
    if (!folded) {
      setIsThrown(false);
    }
  }, [folded, handNumber, cards[0]?.id, cards[1]?.id]);

  const first = cards[0];
  const second = cards[1];

  if (!first || !second) {
    return (
      <div
        className={`relative w-full h-[128px] flex items-center transition-opacity duration-200 ${
          folded ? 'opacity-35' : 'opacity-100'
        }`}
      >
        <OffsuitCardBack className="w-[58%] h-full rounded-[22px]" />
        <OffsuitCardBack className="w-[58%] h-full rounded-[22px] -ml-[16%] shadow-[-10px_0_22px_rgba(0,0,0,0.28)]" />
      </div>
    );
  }

  const firstRed = isRedSuit(first.suit);
  const secondRed = isRedSuit(second.suit);
  const dragEnabled = canDragToFold && !folded && !isThrown;

  const canEvaluateBestFive = Boolean(heroBestFiveIds && heroBestFiveIds.length === 5);
  const firstHelped = canEvaluateBestFive ? heroBestFiveIds!.includes(first.id) : true;
  const secondHelped = canEvaluateBestFive ? heroBestFiveIds!.includes(second.id) : true;
  const firstIsWinner = Boolean(isShowdown && winningCardIds?.includes(first.id));
  const secondIsWinner = Boolean(isShowdown && winningCardIds?.includes(second.id));

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!dragEnabled) return;
    if (info.offset.y < -65 || info.velocity.y < -350) {
      triggerHaptic('medium');
      setIsThrown(true);
      window.setTimeout(() => {
        onFoldTrigger?.();
      }, 220);
    }
  };

  return (
    <motion.div
      drag={dragEnabled}
      dragSnapToOrigin
      dragElastic={0.85}
      onDragEnd={handleDragEnd}
      whileDrag={{
        scale: 1.04,
        rotate: -4,
        zIndex: 30,
      }}
      animate={
        isThrown
          ? { opacity: 0, y: -220, scale: 0.45, rotate: -15 }
          : {
              opacity: folded ? 0.35 : 1,
              y: 0,
              scale: 1,
              rotate: 0,
            }
      }
      transition={
        isThrown
          ? { duration: 0.22, ease: 'easeOut' }
          : { type: 'spring', stiffness: 380, damping: 28 }
      }
      className={`relative w-full h-[128px] flex items-stretch touch-none ${
        dragEnabled ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {/* Left Hole Card flying in from center deck */}
      <motion.div
        key={`hole-card-0-${handNumber}-${first.id}`}
        initial={{ opacity: 0, x: 40, y: -160, rotate: 12, scale: 0.6 }}
        animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
        transition={{
          duration: 0.42,
          delay: 0.12,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={`w-[58%] h-full bg-white rounded-[22px] px-3.5 py-3 flex flex-col justify-between items-start transition-all duration-300 ${
          isShowdown && !firstHelped
            ? 'opacity-30 filter grayscale(50%)'
            : firstIsWinner
            ? 'ring-[2.5px] ring-[#eab308] shadow-[0_0_18px_rgba(234,179,8,0.55)] z-20'
            : ''
        }`}
      >
        <span
          className={`text-[36px] font-normal leading-none tracking-tight ${
            firstRed ? 'text-[#ef4444]' : 'text-[#18181b]'
          }`}
        >
          {formatRank(first.rank)}
        </span>
        <div className="pl-0.5 pb-0.5">
          <SuitGraphic suit={first.suit} size={24} />
        </div>
      </motion.div>

      {/* Right Hole Card overlapping left card with soft drop shadow & staggered deal */}
      <motion.div
        key={`hole-card-1-${handNumber}-${second.id}`}
        initial={{ opacity: 0, x: 40, y: -160, rotate: 12, scale: 0.6 }}
        animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
        transition={{
          duration: 0.42,
          delay: 0.24,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={`w-[58%] h-full bg-white rounded-[22px] px-3.5 py-3 flex flex-col justify-between items-start -ml-[16%] transition-all duration-300 ${
          isShowdown && !secondHelped
            ? 'opacity-30 filter grayscale(50%)'
            : secondIsWinner
            ? 'ring-[2.5px] ring-[#eab308] shadow-[0_0_18px_rgba(234,179,8,0.55)] z-20'
            : 'shadow-[-10px_0_24px_rgba(0,0,0,0.22)]'
        }`}
      >
        <span
          className={`text-[36px] font-normal leading-none tracking-tight ${
            secondRed ? 'text-[#ef4444]' : 'text-[#18181b]'
          }`}
        >
          {formatRank(second.rank)}
        </span>
        <div className="pl-0.5 pb-0.5">
          <SuitGraphic suit={second.suit} size={24} />
        </div>
      </motion.div>
    </motion.div>
  );
};
