// The chime for a new notification. Played by useNotificationStream when a
// `notification` event arrives — so only for live ones, never for the
// backlog refetched after a reconnect.
//
// Synthesised with the Web Audio API (two soft notes) — no audio file.
// Browsers keep audio silent until the person has interacted with the page,
// so the context is resumed on their first click or key press; a chime due
// before then is skipped rather than queued.
//
// Every open dashboard tab receives the same notification, so the first tab
// to play it records its ID and the others stay quiet.
//
// On/off is a per-browser preference in localStorage (the bell's toggle).

const ENABLED_KEY = "petpals:notification-sound";
const LAST_PLAYED_KEY = "petpals:notification-sound:last";

// Two rising notes (E5 → A5), each fading out.
const NOTES = [
  { frequency: 659.25, start: 0, duration: 0.18 },
  { frequency: 880, start: 0.12, duration: 0.3 },
];
const VOLUME = 0.12;

// Storage can throw (blocked site data, some private windows) — the sound
// then just stays on, and every tab may chime.
const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not worth surfacing — see readStorage.
  }
};

export const isNotificationSoundEnabled = () => readStorage(ENABLED_KEY) !== "off";

export const setNotificationSoundEnabled = (enabled: boolean) =>
  writeStorage(ENABLED_KEY, enabled ? "on" : "off");

let context: AudioContext | null = null;

const audioContext = (): AudioContext | null => {
  if (context) return context;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;
  context = new AudioContextClass();
  // Unlock on the first interaction (see the header).
  const unlock = () => {
    void context?.resume();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  return context;
};

// Called when the stream hook mounts, so the context — and its unlock
// listeners — exist before the first notification can arrive.
export const primeNotificationSound = () => {
  audioContext();
};

export const playNotificationSound = (notificationID: number) => {
  if (!isNotificationSoundEnabled()) return;
  if (readStorage(LAST_PLAYED_KEY) === String(notificationID)) return;
  writeStorage(LAST_PLAYED_KEY, String(notificationID));

  const ctx = audioContext();
  if (!ctx || ctx.state !== "running") return;

  const now = ctx.currentTime;
  for (const { frequency, start, duration } of NOTES) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(VOLUME, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now + start);
    oscillator.stop(now + start + duration + 0.02);
  }
};
