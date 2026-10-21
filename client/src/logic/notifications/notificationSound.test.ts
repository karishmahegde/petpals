// The new-notification chime: on by default, off per browser, played by one
// tab per notification, silent until the browser allows audio, and never a
// crash when storage or Web Audio is missing. Web Audio is faked; each test
// loads a fresh copy of the module (it keeps its audio context in a variable).
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type SoundModule = typeof import("./notificationSound");

const load = async (): Promise<SoundModule> => {
  vi.resetModules();
  return import("./notificationSound");
};

// A minimal AudioContext: counts the notes it was asked to play.
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: "suspended" | "running" = "running";
  currentTime = 0;
  destination = {};
  notes = 0;
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  resume = vi.fn(async () => {
    this.state = "running";
  });
  createGain() {
    const gain = {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    };
    return { gain, connect: () => this.destination };
  }
  createOscillator() {
    return {
      type: "",
      frequency: { value: 0 },
      connect: (node: unknown) => node,
      start: () => {
        this.notes += 1;
      },
      stop: vi.fn(),
    };
  }
}

beforeEach(() => {
  FakeAudioContext.instances = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const notesPlayed = () => FakeAudioContext.instances.reduce((n, ctx) => n + ctx.notes, 0);

describe("on/off", () => {
  test("on by default, and the choice is remembered", async () => {
    const sound = await load();

    expect(sound.isNotificationSoundEnabled()).toBe(true);
    sound.setNotificationSoundEnabled(false);
    expect(sound.isNotificationSoundEnabled()).toBe(false);
    expect((await load()).isNotificationSoundEnabled()).toBe(false);
    sound.setNotificationSoundEnabled(true);
    expect(sound.isNotificationSoundEnabled()).toBe(true);
  });

  test("turned off: nothing plays", async () => {
    const sound = await load();
    sound.setNotificationSoundEnabled(false);

    sound.playNotificationSound(41);

    expect(notesPlayed()).toBe(0);
  });
});

describe("playing", () => {
  test("a new notification plays the two-note chime", async () => {
    const sound = await load();

    sound.playNotificationSound(41);

    expect(notesPlayed()).toBe(2);
  });

  test("the same notification chimes once, even with several tabs open", async () => {
    const tabA = await load();
    tabA.playNotificationSound(41);
    const tabB = await load();
    tabB.playNotificationSound(41);

    expect(notesPlayed()).toBe(2);
  });

  test("each new notification chimes", async () => {
    const sound = await load();

    sound.playNotificationSound(41);
    sound.playNotificationSound(42);

    expect(notesPlayed()).toBe(4);
  });
});

describe("the browser's autoplay rule", () => {
  test("before any click or key press the chime is skipped, not queued", async () => {
    const sound = await load();
    sound.primeNotificationSound();
    FakeAudioContext.instances[0].state = "suspended";

    sound.playNotificationSound(41);

    expect(notesPlayed()).toBe(0);
  });

  test("the first click unlocks audio, and later chimes play", async () => {
    const sound = await load();
    sound.primeNotificationSound();
    const ctx = FakeAudioContext.instances[0];
    ctx.state = "suspended";

    window.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
    sound.playNotificationSound(42);

    expect(ctx.resume).toHaveBeenCalled();
    expect(notesPlayed()).toBe(2);
  });

  test("a key press unlocks it too; only one audio context is ever made", async () => {
    const sound = await load();
    sound.primeNotificationSound();
    sound.primeNotificationSound();
    FakeAudioContext.instances[0].state = "suspended";

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    await Promise.resolve();

    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].resume).toHaveBeenCalled();
  });
});

describe("missing pieces never crash", () => {
  test("no Web Audio API: silent", async () => {
    vi.stubGlobal("AudioContext", undefined);
    const sound = await load();

    expect(() => sound.playNotificationSound(41)).not.toThrow();
  });

  test("storage blocked: the sound stays on and still plays", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const sound = await load();

    expect(sound.isNotificationSoundEnabled()).toBe(true);
    expect(() => sound.setNotificationSoundEnabled(false)).not.toThrow();
    sound.playNotificationSound(41);
    expect(notesPlayed()).toBe(2);
  });
});
