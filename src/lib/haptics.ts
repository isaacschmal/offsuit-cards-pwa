/**
 * Cross-platform micro-haptic feedback engine for iOS (Taptic Engine) & Android.
 *
 * - iOS 17.4+ / iOS 18+ Safari & Home Screen PWA: Uses a dedicated switch control
 *   activated synchronously inside native user gesture events (pointerdown/touchstart).
 * - Android / Chrome: Uses `navigator.vibrate` with ultra-short crisp 6–15ms pulses.
 * - Universal Tactile Acoustic Feedback: Synthesizes an authentic iOS keyboard mechanical tick
 *   (1.3kHz - 1.8kHz transient, 9-12ms sharp exponential decay) via Web Audio API.
 */

export type HapticStyle = 'selection' | 'light' | 'medium' | 'heavy';

let iosSwitchLabel: HTMLLabelElement | null = null;
let iosSwitchInput: HTMLInputElement | null = null;
let sharedAudioCtx: AudioContext | null = null;
let lastHapticTimestamp = 0;
let lastPointerDownTimestamp = 0;
let globalHapticsInitialized = false;

function ensureIosHapticSwitch(): HTMLLabelElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  if (iosSwitchLabel && document.body.contains(iosSwitchLabel)) {
    return iosSwitchLabel;
  }

  try {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'haptic-switch-trigger';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    input.style.cssText =
      'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.001;pointer-events:auto;z-index:-1;overflow:hidden;';

    const label = document.createElement('label');
    label.htmlFor = 'haptic-switch-trigger';
    label.setAttribute('aria-hidden', 'true');
    label.setAttribute('data-haptic-switch', 'true');
    label.style.cssText =
      'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.001;pointer-events:auto;z-index:-1;overflow:hidden;';

    document.body.appendChild(input);
    document.body.appendChild(label);

    iosSwitchLabel = label;
    iosSwitchInput = input;
    return label;
  } catch {
    return null;
  }
}

function playKeyboardTickSound(style: HapticStyle): void {
  if (typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume().catch(() => {});
    }
    if (sharedAudioCtx.state !== 'running') return;

    const now = sharedAudioCtx.currentTime;

    // Authentic iOS keyboard mechanical tick transient
    const osc = sharedAudioCtx.createOscillator();
    const gain = sharedAudioCtx.createGain();
    const filter = sharedAudioCtx.createBiquadFilter();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(style === 'selection' ? 1800 : 1350, now);
    filter.Q.setValueAtTime(2.2, now);

    const baseFreq = style === 'selection' ? 1850 : style === 'heavy' ? 1150 : 1420;
    const durationSec = style === 'selection' ? 0.007 : style === 'heavy' ? 0.016 : 0.011;
    const peakGain = style === 'selection' ? 0.12 : style === 'heavy' ? 0.22 : 0.16;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + durationSec);

    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(sharedAudioCtx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.002);
  } catch {
    // Ignore audio restrictions
  }
}

export function triggerHaptic(style: HapticStyle = 'light'): void {
  const now = Date.now();
  const minInterval = style === 'selection' ? 14 : 20;
  if (now - lastHapticTimestamp < minInterval) return;
  lastHapticTimestamp = now;

  // 1. Android / Web Vibration API (crisp micro-pulse)
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      const durationMs =
        style === 'selection' ? 6 : style === 'light' ? 10 : style === 'medium' ? 14 : 22;
      navigator.vibrate(durationMs);
    } catch {
      // Ignore vibrate errors
    }
  }

  // 2. iOS 17.4+ / iOS 18+ Safari & PWA native Taptic Engine switch toggle
  const switchLabel = ensureIosHapticSwitch();
  if (switchLabel) {
    try {
      switchLabel.click();
    } catch {
      // Ignore if synthetic click is restricted
    }
  }

  // 3. Crisp iOS keyboard-like tactile acoustic tick
  playKeyboardTickSound(style);
}

export function initGlobalHaptics(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (globalHapticsInitialized) return;
  globalHapticsInitialized = true;

  // Ensure iOS switch element is ready in DOM
  ensureIosHapticSwitch();

  // Unlock AudioContext on the very first touch gesture
  const unlockAudio = () => {
    if (!sharedAudioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener('pointerdown', unlockAudio, { passive: true, once: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true, once: true });

  // Listen on pointerdown (capture phase) for immediate synchronous haptic on touch
  document.addEventListener(
    'pointerdown',
    (ev) => {
      const target = ev.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;
      if (target === iosSwitchLabel || target === iosSwitchInput) return;
      if (target.closest('[data-haptic-switch="true"]')) return;

      const interactive = target.closest(
        'button, [role="button"], a[href], input[type="submit"], input[type="button"], [data-haptic]'
      ) as HTMLElement | null;

      if (interactive && !(interactive as HTMLButtonElement).disabled) {
        lastPointerDownTimestamp = Date.now();
        triggerHaptic('light');
      }
    },
    { capture: true, passive: true }
  );

  // Fallback on click strictly for keyboard / non-pointer activations
  document.addEventListener(
    'click',
    (ev) => {
      if (Date.now() - lastPointerDownTimestamp < 600) return;
      const target = ev.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;
      if (target === iosSwitchLabel || target === iosSwitchInput) return;
      if (target.closest('[data-haptic-switch="true"]')) return;

      const interactive = target.closest(
        'button, [role="button"], a[href], input[type="submit"], input[type="button"]'
      ) as HTMLElement | null;

      if (interactive && !(interactive as HTMLButtonElement).disabled) {
        triggerHaptic('light');
      }
    },
    { passive: true }
  );

  // Trigger ultra-crisp selection tick when sliding any range slider
  document.addEventListener(
    'input',
    (ev) => {
      const target = ev.target as HTMLInputElement | null;
      if (target && target.tagName === 'INPUT' && target.type === 'range') {
        triggerHaptic('selection');
      }
    },
    { passive: true }
  );
}
