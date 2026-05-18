import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { applySpeakerForPlayback, runAudioExclusive } from './voiceAudioSession';

const SAMPLE_RATE = 24000;
const BYTES_PER_MS = (SAMPLE_RATE * 2) / 1000;
const MIN_START_MS = 280;
const MIN_START_BYTES = Math.floor(BYTES_PER_MS * MIN_START_MS);

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

async function createAndPlaySound(uri: string, primeSpeaker: boolean): Promise<Audio.Sound> {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (primeSpeaker) await applySpeakerForPlayback();
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: 1.0, progressUpdateIntervalMillis: 50 }
      );
      return sound;
    } catch (err) {
      last = err;
      if (!isSessionNotActiveError(err) || attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
    }
  }
  throw last;
}

function captionSlice(full: string, ratio: number): string {
  if (!full) return '';
  if (ratio >= 1) return full;
  return full.slice(0, Math.max(0, Math.ceil(full.length * ratio)));
}

const CAPTION_CHARS_PER_SEC = 18;
const CAPTION_PACE = 1.45;

function estimateSpeechDurationMs(streamedBytes: number, playedMs: number, caption: string): number {
  const audioMs = Math.max(streamedBytes / BYTES_PER_MS, playedMs + 400);
  const textMs =
    caption.length > 0
      ? Math.max(900, (caption.length / CAPTION_CHARS_PER_SEC) * 1000)
      : audioMs;
  return Math.max(audioMs, textMs);
}

function captionProgress(playedMs: number, pos: number, totalEst: number): number {
  if (totalEst <= 0) return 0;
  return Math.min(1, ((playedMs + pos) / totalEst) * CAPTION_PACE);
}

export type PlayBufferedOptions = {
  getCaption?: () => string;
  onCaptionUpdate?: (visible: string) => void;
};

function waitForPlaybackEnd(
  sound: Audio.Sound,
  durationMs: number,
  caption: PlayBufferedOptions | undefined,
  playedMsBefore: number,
  streamedBytes: number
): Promise<boolean> {
  const maxMs = durationMs + 1500;
  return new Promise((resolve) => {
    let heard = false;
    const timeout = setTimeout(() => resolve(heard), maxMs);

    sound.setOnPlaybackStatusUpdate((st: AVPlaybackStatus) => {
      if (!st.isLoaded) return;
      const pos = st.positionMillis ?? 0;
      const full = caption?.getCaption?.() ?? '';
      const totalEst = estimateSpeechDurationMs(streamedBytes, playedMsBefore, full);
      if (full && caption?.onCaptionUpdate) {
        const ratio = captionProgress(playedMsBefore, pos, totalEst);
        caption.onCaptionUpdate(captionSlice(full, ratio));
      }
      if (st.isPlaying && pos > 50) heard = true;
      if (heard && st.didJustFinish) {
        clearTimeout(timeout);
        resolve(true);
      }
    });
  });
}

let activeSound: Audio.Sound | null = null;
let generation = 0;

/** Stream PCM — start playing early, then queue the rest. */
export class RealtimePlayback {
  private parts: Uint8Array[] = [];
  private bytes = 0;
  private halted = false;
  private streamStarted = false;
  private playChain: Promise<boolean> = Promise.resolve(true);
  private captionOpts: PlayBufferedOptions | undefined;
  private playedMs = 0;
  private streamedBytes = 0;
  private primeSpeakerNext = true;

  arm() {
    this.halted = false;
    this.streamStarted = false;
    this.playChain = Promise.resolve(true);
    this.playedMs = 0;
    this.streamedBytes = 0;
    this.primeSpeakerNext = true;
  }

  reset() {
    this.halted = true;
    this.parts = [];
    this.bytes = 0;
    this.streamStarted = false;
    this.streamedBytes = 0;
    this.captionOpts = undefined;
  }

  interrupt() {
    generation += 1;
    this.reset();
    this.arm();
    void stopPlayback();
  }

  setCaptionOptions(opts?: PlayBufferedOptions) {
    this.captionOpts = opts;
  }

  pushDelta(delta: string) {
    if (!delta || this.halted) return;
    const chunk = base64ToBytes(delta);
    this.parts.push(chunk);
    this.bytes += chunk.length;
    this.streamedBytes += chunk.length;

    if (!this.streamStarted && this.bytes >= MIN_START_BYTES) {
      this.streamStarted = true;
      this.playChain = this.playChain.then(() => this.playNextSegment());
    }
  }

  hasAudio() {
    return this.bytes > 0 || this.streamStarted;
  }

  finish(): Promise<boolean> {
    if (this.halted) return Promise.resolve(false);
    return this.playChain.then(async () => {
      let heard = false;
      while (this.bytes > 0 && !this.halted) {
        heard = (await this.playNextSegment()) || heard;
      }
      return heard;
    });
  }

  private drainPcm(): Uint8Array | null {
    if (!this.bytes) return null;
    const pcm = new Uint8Array(this.bytes);
    let offset = 0;
    for (const part of this.parts) {
      pcm.set(part, offset);
      offset += part.length;
    }
    this.parts = [];
    this.bytes = 0;
    return pcm;
  }

  private async playNextSegment(): Promise<boolean> {
    if (this.halted) return false;

    const pcm = this.drainPcm();
    if (!pcm || pcm.length < 400) return false;

    const gen = generation;
    const durationMs = Math.ceil(pcm.length / BYTES_PER_MS);
    const streamedBytes = this.streamedBytes;
    const prime = this.primeSpeakerNext;
    this.primeSpeakerNext = false;

    return runAudioExclusive(async () => {
      if (gen !== generation || this.halted) return false;

      const uri = `${FileSystem.cacheDirectory}bistro-reply-${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(uri, pcmToWavBase64(pcm), {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (gen !== generation) {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        return false;
      }

      const sound = await createAndPlaySound(uri, prime);
      activeSound = sound;

      if (this.playedMs === 0) this.captionOpts?.onCaptionUpdate?.('');

      const heard = await waitForPlaybackEnd(
        sound,
        durationMs,
        this.captionOpts,
        this.playedMs,
        streamedBytes
      );

      this.playedMs += durationMs;

      if (activeSound === sound) {
        await sound.unloadAsync().catch(() => {});
        activeSound = null;
      }
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      return heard;
    }).catch((err) => {
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
