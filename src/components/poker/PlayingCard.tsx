import { motion, type PanInfo } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { formatRank, isRedSuit } from '../../engine/deck';
import type { Card, Suit } from '../../engine/types';
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
 * Clean static geometric card back with white outer border and static 12-spoke central rosette.
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
  const spokes = Array.from({ length: 12 }, (_, i) => i * 30);

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
          {/* Thin geometric line & circle background pattern */}
          <g stroke="rgba(255,255,255,0.42)" strokeWidth="1">
            <line x1="50" y1="0" x2="50" y2="142" />
            <line x1="0" y1="71" x2="100" y2="71" />
            <circle cx="50" cy="71" r="46" />
            <circle cx="50" cy="71" r="29" />
            <circle cx="50" cy="18" r="19" />
            <circle cx="50" cy="18" r="7" />
            <circle cx="50" cy="124" r="19" />
            <circle cx="50" cy="124" r="7" />
            <circle cx="3" cy="71" r="16" />
            <circle cx="3" cy="71" r="6" />
            <circle cx="97" cy="71" r="16" />
            <circle cx="97" cy="71" r="6" />
            <path d="M5 10 Q50 55 95 10" />
            <path d="M5 132 Q50 87 95 132" />
          </g>

          {/* Central solid medallion with white border */}
          <circle
            cx="50"
            cy="71"
            r="25"
            fill={theme.hex}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1.2"
          />

          {/* Static 12-spoke printed white geometric rosette (no spinning animation) */}
          <g transform="translate(50, 71)">
            {spokes.map((angle) => (
              <rect
                key={angle}
                x="-1.6"
                y="-15.5"
                width="3.2"
                height="7.5"
                rx="1.6"
                fill="#ffffff"
                transform={`rotate(${angle})`}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
};

export const CardBack = OffsuitCardBack;

interface CommunityCardSlotProps {
  card?: Card;
  index: number;
  cardBackColor?: CardBackColorId;
}

/**
 * 3D Perspective Community Card Slot.
 * Keeps both the Back Face (OffsuitCardBack) and Front Face (revealed rank & suit)
 * mounted with `backfaceVisibility: 'hidden'` and animates `rotateY` from 0deg to 180deg
 * with a staggered flop delay (`index * 0.14s`).
 */
export const CommunityCardSlot: React.FC<CommunityCardSlotProps> = ({
  card,
  index,
  cardBackColor,
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
    <div
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
          className="absolute inset-0 w-full h-full bg-white rounded-[18px] p-2.5 flex flex-col justify-between items-start shadow-[-6px_0_16px_rgba(0,0,0,0.18)]"
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
    </div>
  );
};

interface HoleCardsBlockProps {
  cards: Card[];
  folded?: boolean;
  canDragToFold?: boolean;
  onFoldTrigger?: () => void;
}

/**
 * Bottom-left 2 overlapping hole cards block matching IMG_8408 - IMG_8413.
 * Supports Offsuit's signature Throw-to-Fold upward flick/drag gesture:
 * dragging/flicking past `offset.y < -65` or `velocity.y < -350` animates the cards
 * flying into the center table (`opacity: 0, y: -220, scale: 0.45, rotate: -15`)
 * and triggers the `fold` action.
 */
export const HoleCardsBlock: React.FC<HoleCardsBlockProps> = ({
  cards,
  folded = false,
  canDragToFold = false,
  onFoldTrigger,
}) => {
  const [isThrown, setIsThrown] = useState(false);

  // Reset thrown state when a new hand starts or player is no longer folded
  useEffect(() => {
    if (!folded) {
      setIsThrown(false);
    }
  }, [folded, cards[0]?.id, cards[1]?.id]);

  const first = cards[0];
  const second = cards[1];

  if (!first || !second) {
    return (
      <div className="relative w-full h-[142px] flex items-center">
        <OffsuitCardBack className="w-[58%] h-full rounded-[24px]" />
        <OffsuitCardBack className="w-[58%] h-full rounded-[24px] -ml-[16%] shadow-[-10px_0_22px_rgba(0,0,0,0.28)]" />
      </div>
    );
  }

  const firstRed = isRedSuit(first.suit);
  const secondRed = isRedSuit(second.suit);
  const dragEnabled = canDragToFold && !folded && !isThrown;

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!dragEnabled) return;
    if (info.offset.y < -65 || info.velocity.y < -350) {
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
      className={`relative w-full h-[142px] flex items-stretch touch-none ${
        dragEnabled ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {/* Left Hole Card */}
      <div className="w-[58%] h-full bg-white rounded-[24px] px-4 py-3.5 flex flex-col justify-between items-start">
        <span
          className={`text-[40px] font-normal leading-none tracking-tight ${
            firstRed ? 'text-[#ef4444]' : 'text-[#18181b]'
          }`}
        >
          {formatRank(first.rank)}
        </span>
        <div className="pl-0.5 pb-0.5">
          <SuitGraphic suit={first.suit} size={26} />
        </div>
      </div>

      {/* Right Hole Card overlapping left card with soft drop shadow */}
      <div className="w-[58%] h-full bg-white rounded-[24px] px-4 py-3.5 flex flex-col justify-between items-start -ml-[16%] shadow-[-10px_0_24px_rgba(0,0,0,0.22)]">
        <span
          className={`text-[40px] font-normal leading-none tracking-tight ${
            secondRed ? 'text-[#ef4444]' : 'text-[#18181b]'
          }`}
        >
          {formatRank(second.rank)}
        </span>
        <div className="pl-0.5 pb-0.5">
          <SuitGraphic suit={second.suit} size={26} />
        </div>
      </div>
    </motion.div>
  );
};
