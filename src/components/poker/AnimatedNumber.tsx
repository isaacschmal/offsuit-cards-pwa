import React, { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  flashColorOnChange?: boolean;
  durationMs?: number;
  className?: string;
}

/**
 * Smoothly interpolates numeric values (stacks, pots, bets) over ~400ms.
 * When `flashColorOnChange` is true:
 * - Decreases (spending/betting money) flash red (#ef4444) while counting down, then return to white (#ffffff).
 * - Increases (winning money) flash green (#22c55e) while counting up, then return to white (#ffffff).
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  flashColorOnChange = false,
  durationMs = 420,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const [flashState, setFlashState] = useState<'idle' | 'up' | 'down'>('idle');
  const prevValueRef = useRef<number>(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;

    if (startValue === endValue) {
      return;
    }

    const diff = endValue - startValue;
    prevValueRef.current = endValue;

    if (flashColorOnChange) {
      setFlashState(diff > 0 ? 'up' : 'down');
    }

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame === 'undefined') {
      setDisplayValue(endValue);
      setFlashState('idle');
      return;
    }

    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + diff * eased);
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
        if (flashColorOnChange) {
          setFlashState('idle');
        }
      }
    };

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, durationMs, flashColorOnChange]);

  const dynamicColorStyle: React.CSSProperties | undefined = flashColorOnChange
    ? {
        color:
          flashState === 'down'
            ? '#ef4444'
            : flashState === 'up'
            ? '#22c55e'
            : '#ffffff',
        transition: 'color 180ms ease-out',
      }
    : undefined;

  return (
    <span className={className} style={dynamicColorStyle}>
      {displayValue}
    </span>
  );
};
