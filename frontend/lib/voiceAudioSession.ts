import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

export type AudioRoute = 'mic' | 'assistant';

type StoppableRecording = {
  stopAndUnloadAsync: () => Promise<unknown>;
};

/** Play + record for the whole voice call — never flip allowsRecordingIOS off (iOS breaks prepare). */
const VOICE_SESSION_MODE = {
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
  interruptionModeIOS: InterruptionModeIOS.DuckOthers,
  interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
} as const;

let route: AudioRoute = 'mic';
let sessionReady = false;
let chain: Promise<void> = Promise.resolve();
let activeRecording: StoppableRecording | null = null;

const MIC_SETTLE_MS = 200;

export function isMicRoute() {
  return route === 'mic';
}

export function registerActiveRecording(recording: StoppableRecording | null) {
  activeRecording = recording;
}

export function runAudioExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn);
  chain = run.then(
    () => {},
    () => {}
  );
  return run;
}

async function stopActiveRecording() {
  const rec = activeRecording;
  activeRecording = null;
  if (!rec) return;
  try {
    await rec.stopAndUnloadAsync();
  } catch {
    /* ignore */
  }
}

export async function ensureVoiceSession(): Promise<void> {
  await Audio.setIsEnabledAsync(true);
  await Audio.setAudioModeAsync(VOICE_SESSION_MODE);
  sessionReady = true;
}

/**
 * Logical route only — native session stays play+record capable.
 * assistant = pause mic chunks while Bistro speaks.
 */
export function setAudioRoute(next: AudioRoute): Promise<void> {
  return runAudioExclusive(async () => {
    if (next === 'assistant') {
      route = 'assistant';
      await stopActiveRecording();
      if (__DEV__) console.log('[voice] capture paused');
      return;
    }
    if (!sessionReady) await ensureVoiceSession();
    await new Promise((r) => setTimeout(r, MIC_SETTLE_MS));
    route = 'mic';
    if (__DEV__) console.log('[voice] capture active');
  });
}

export async function applySpeakerForPlayback() {
  if (!sessionReady) await ensureVoiceSession();
}

export function resetVoiceAudioSession() {
  route = 'mic';
  sessionReady = false;
  activeRecording = null;
  chain = Promise.resolve();
}
