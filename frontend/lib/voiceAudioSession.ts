import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

export type AudioRoute = 'mic' | 'assistant';

type StoppableRecording = {
  stopAndUnloadAsync: () => Promise<unknown>;
};

let route: AudioRoute = 'mic';
let chain: Promise<void> = Promise.resolve();
let activeRecording: StoppableRecording | null = null;

const MIC_MODE = {
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
  interruptionModeIOS: InterruptionModeIOS.DuckOthers,
  interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
} as const;

const SPEAKER_MODE = {
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
  interruptionModeIOS: InterruptionModeIOS.DuckOthers,
  interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
} as const;

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

/**
 * mic = user turn (capture). assistant = Bistro reply (bottom speaker, no mic).
 */
export function setAudioRoute(next: AudioRoute): Promise<void> {
  route = next;
  return runAudioExclusive(async () => {
    if (next === 'assistant') {
      await stopActiveRecording();
      await new Promise((r) => setTimeout(r, 120));
      await Audio.setAudioModeAsync(SPEAKER_MODE);
      if (__DEV__) console.log('[voice] route → speaker');
      return;
    }
    await Audio.setAudioModeAsync(MIC_MODE);
    if (__DEV__) console.log('[voice] route → mic');
  });
}

/** Call only from inside runAudioExclusive — sets speaker route without re-queueing. */
export async function applySpeakerForPlayback() {
  await Audio.setIsEnabledAsync(true);
  await Audio.setAudioModeAsync(SPEAKER_MODE);
  await new Promise((r) => setTimeout(r, 80));
}

export function resetVoiceAudioSession() {
  route = 'mic';
  activeRecording = null;
  chain = Promise.resolve();
}
