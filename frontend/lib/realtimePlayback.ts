import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { applySpeakerForPlayback, runAudioExclusive } from './voiceAudioSession';

const SAMPLE_RATE = 24000;

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pcmToWavBase64(pcm: Uint8Array): string {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (pos: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(pos + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, pcm.length, true);

  const wav = new Uint8Array(44 + pcm.length);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);

  let binary = '';
  for (let i = 0; i < wav.length; i++) binary += String.fromCharCode(wav[i]);
  return btoa(binary);
}

function isSessionNotActiveError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('session not activated') || msg.includes('561017449');
}

async function createAndPlaySound(uri: string): Promise<Audio.Sound> {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await applySpeakerForPlayback();
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: 1.0, progressUpdateIntervalMillis: 100 }
      );
      return sound;
    } catch (err) {
      last = err;
      if (!isSessionNotActiveError(err) || attempt === 3) throw err;
      if (__DEV__) console.warn('[voice] retry play, attempt', attempt + 1);
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }
  throw last;
}

function waitForAudiblePlayback(sound: Audio.Sound, pcmBytes: number): Promise<boolean> {
  const expectedMs = Math.ceil((pcmBytes / (SAMPLE_RATE * 2)) * 1000);
  const maxMs = expectedMs + 2000;

  return new Promise((resolve) => {
    let heard = false;
    const timeout = setTimeout(() => {
      if (__DEV__) console.warn('[voice] playback timed out, heard=', heard);
      resolve(heard);
    }, maxMs);

    sound.setOnPlaybackStatusUpdate((st: AVPlaybackStatus) => {
      if (!st.isLoaded) return;
      const pos = st.positionMillis ?? 0;
      if (st.isPlaying && pos > 80) heard = true;
      if (heard && st.didJustFinish) {
        clearTimeout(timeout);
        resolve(true);
      }
    });
  });
}

let activeSound: Audio.Sound | null = null;
let generation = 0;

/** Buffer PCM from the server; play once when the reply is done. */
export class RealtimePlayback {
  private parts: Uint8Array[] = [];
  private bytes = 0;
  private halted = false;

  arm() {
    this.halted = false;
  }

  reset() {
    this.halted = true;
    this.parts = [];
    this.bytes = 0;
  }

  interrupt() {
    generation += 1;
    this.reset();
    this.arm();
    void stopPlayback();
  }

  pushDelta(delta: string) {
    if (!delta || this.halted) return;
    const chunk = base64ToBytes(delta);
    this.parts.push(chunk);
    this.bytes += chunk.length;
  }

  hasAudio() {
    return this.bytes > 0;
  }

  playBuffered(): Promise<boolean> {
    if (this.halted || !this.bytes) return Promise.resolve(false);

    const pcm = new Uint8Array(this.bytes);
    let offset = 0;
    for (const part of this.parts) {
      pcm.set(part, offset);
      offset += part.length;
    }
    this.parts = [];
    this.bytes = 0;

    const gen = generation;
    return runAudioExclusive(async () => {
      if (gen !== generation) return false;

      if (gen !== generation) return false;

      const uri = `${FileSystem.cacheDirectory}bistro-reply-${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(uri, pcmToWavBase64(pcm), {
        encoding: FileSystem.EncodingType.Base64,
      });

      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || (info.size ?? 0) < 100) {
        if (__DEV__) console.warn('[voice] wav file missing or tiny', info);
        return false;
      }

      if (gen !== generation) {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        return false;
      }

      if (__DEV__) console.log('[voice] playing reply', pcm.length, 'pcm bytes');

      const sound = await createAndPlaySound(uri);
      activeSound = sound;

      const heard = await waitForAudiblePlayback(sound, pcm.length);

      if (activeSound === sound) {
        await sound.unloadAsync().catch(() => {});
        activeSound = null;
      }
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

      if (__DEV__ && !heard) console.warn('[voice] no audible output detected');
      return heard;
    }).catch((err) => {
      if (__DEV__) console.warn('[voice] playback failed', err);
      return false;
    });
  }
}

export async function stopPlayback() {
  generation += 1;
  await runAudioExclusive(async () => {
    if (!activeSound) return;
    try {
      await activeSound.stopAsync();
      await activeSound.unloadAsync();
    } catch {
      /* ignore */
    }
    activeSound = null;
  }).catch(() => {});
}

export { resetVoiceAudioSession } from './voiceAudioSession';
