/**
 * Cross-platform micro-haptic feedback engine for iOS (Taptic Engine) & Android.
 *
 * - iOS 17.4+ / iOS 18 Safari & Home Screen PWA: Uses a hidden `<input type="checkbox" switch>`
 *   associated with a `<label>` to trigger Apple's native UISwitch Taptic Engine tap.
 * - Android / Chrome: Uses `navigator.vibrate` with ultra-short 6–12ms crisp pulses.
 * - Universal Web Audio fallback: Synthesizes a 4ms sub-audible 150Hz tactile transient
 *   through the device speaker/actuator when unlocked.
 */

export type HapticStyle = 'selection' | 'light' | 'medium' | 'heavy';

let iosSwitchLabel: HTMLLabelElement | null = null;
let iosSwitchInput: HTMLInputElement | null = null;
let sharedAudioCtx: AudioContext | null = null;
let lastHapticTimestamp = 0;
let globalHapticsInitialized = false;

function ensureIosHapticSwitch(): HTMLLabelElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  if (iosSwitchLabel && document.body.contains(iosSwitchLabel)) {
    return iosSwitchLabel;
  }

  try {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.setAttribute('data-haptic-switch', 'true');
    label.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0.01;pointer-events:none;overflow:hidden;z-index:-1;';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;

    // Prevent synthetic click on the hidden switch from bubbling to document listeners
    const stopBubble = (ev: Event) => {
      ev.stopPropagation();
    };
    label.addEventListener('click', stopBubble);
    input.addEventListener('click', stopBubble);
    input.addEventListener('change', stopBubble);

    label.appendChild(input);
    document.body.appendChild(label);

    iosSwitchLabel = label;
    iosSwitchInput = input;
    return label;
  } catch {
    return null;
  }
}

function playTactileAudioPulse(style: HapticStyle): void {
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
    const osc = sharedAudioCtx.createOscillator();
    const gain = sharedAudioCtx.createGain();

    const freq =
      style === 'selection'
        ? 165
        : style === 'light'
        ? 150
        : style === 'medium'
        ? 135
        : 115;
    const durationSec = style === 'selection' ? 0.004 : style === 'heavy' ? 0.008 : 0.005;
    const peakGain = style === 'selection' ? 0.035 : style === 'heavy' ? 0.065 : 0.045;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + durationSec);

    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.001);
  } catch {
    // Ignore audio context restrictions
  }
}

export function triggerHaptic(style: HapticStyle = 'light'): void {
  const now = Date.now();
  const minInterval = style === 'selection' ? 16 : 24;
  if (now - lastHapticTimestamp < minInterval) return;
  lastHapticTimestamp = now;

  // 1. Android / Web Vibration API
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      const durationMs =
        style === 'selection' ? 5 : style === 'light' ? 8 : style === 'medium' ? 12 : 18;
      navigator.vibrate(durationMs);
    } catch {
      // Ignore vibrate errors
    }
  }

  // 2. iOS 17.4+ / iOS 18 Safari & PWA native Taptic Engine switch toggle
  const switchLabel = ensureIosHapticSwitch();
  if (switchLabel) {
    try {
      switchLabel.click();
    } catch {
      // Ignore if synthetic click is disallowed
    }
  }

  // 3. Subtle 4-6ms tactile audio transient
  playTactileAudioPulse(style);
}

export function initGlobalHaptics(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (globalHapticsInitialized) return;
  globalHapticsInitialized = true;

  // Trigger keyboard-like haptic tap on any interactive button click
  document.addEventListener(
    'click',
    (ev) => {
      const target = ev.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;
      if (target === iosSwitchLabel || target === iosSwitchInput) return;
      if (target.closest('[data-haptic-switch="true"]')) return;

      const interactive = target.closest(
        'button, [role="button"], a[href], input[type="submit"], input[type="button"]'
      ) as HTMLButtonElement | null;

      if (interactive && !interactive.disabled) {
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
