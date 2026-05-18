import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

export type AudioRoute = 'mic' | 'assistant';

type StoppableRecording = {
  stopAndUnloadAsync: () => Promise<unknown>;
};

/**
 * iOS tradeoff:
 * - allowsRecordingIOS: true  → mic works, playback often uses earpiece
 * - allowsRecordingIOS: false → loudspeaker, but Recording.prepare fails if flipped mid-chunk
 *
 * We switch modes only inside runAudioExclusive, always stop the recorder first, and
 * wait before re-enabling capture.
 */
const MIC_CAPTURE_MODE = {
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
  interruptionModeIOS: InterruptionModeIOS.DuckOthers,
  interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
} as const;

const SPEAKER_PLAYBACK_MODE = {
  allowsRecordingIOS: false,
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

const MIC_SETTLE_MS = 120;
const SPEAKER_SETTLE_MS = 50;

let speakerPrimed = false;

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

/** Mic capture mode — call before Recording.createAsync. */
export async function ensureMicCaptureMode(): Promise<void> {
  await stopActiveRecording();
  await Audio.setIsEnabledAsync(true);
  await Audio.setAudioModeAsync(MIC_CAPTURE_MODE);
  await new Promise((r) => setTimeout(r, MIC_SETTLE_MS));
  sessionReady = true;
  speakerPrimed = false;
}

/** Loudspeaker for Bistro replies — only while not capturing. */
export async function applySpeakerForPlayback(): Promise<void> {
  if (speakerPrimed) return;
  await stopActiveRecording();
  await Audio.setIsEnabledAsync(true);
  await Audio.setAudioModeAsync(SPEAKER_PLAYBACK_MODE);
  await new Promise((r) => setTimeout(r, SPEAKER_SETTLE_MS));
  speakerPrimed = true;
}

/** @deprecated alias */
export async function ensureVoiceSession(): Promise<void> {
  await ensureMicCaptureMode();
}

export function setAudioRoute(next: AudioRoute): Promise<void> {
  return runAudioExclusive(async () => {
    if (next === 'assistant') {
      route = 'assistant';
      await applySpeakerForPlayback();
      if (__DEV__) console.log('[voice] route → speaker');
      return;
    }
    await ensureMicCaptureMode();
    route = 'mic';
    if (__DEV__) console.log('[voice] route → mic');
  });
}

export function resetVoiceAudioSession() {
  route = 'mic';
  sessionReady = false;
  speakerPrimed = false;
  activeRecording = null;
  chain = Promise.resolve();
}
