import { Audio } from 'expo-av';
import { ensureVoiceSession } from './voiceAudioSession';

type RecordingHook = (recording: Audio.Recording | null) => void;

async function unloadRecording(recording: Audio.Recording) {
  try {
    const status = await recording.getStatusAsync();
    if (status.isRecording || status.canRecord) {
      await recording.stopAndUnloadAsync();
    }
  } catch {
    /* ignore */
  }
}

/** One AAC chunk — same preset as chat voice input (reliable on iOS). */
export async function captureVoiceChunk(
  ms: number,
  onRecording?: RecordingHook
): Promise<string | null> {
  await ensureVoiceSession();

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );
  onRecording?.(recording);

  try {
    await new Promise((r) => setTimeout(r, ms));
    await recording.stopAndUnloadAsync();
    onRecording?.(null);
    return recording.getURI();
  } catch (err) {
    await unloadRecording(recording);
    onRecording?.(null);
    throw err;
  }
}
