import { Audio } from 'expo-av';
import { isMicRoute } from './voiceAudioSession';

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

/** One AAC chunk — session mode must already be mic (see setAudioRoute). */
export async function captureVoiceChunk(
  ms: number,
  onRecording?: RecordingHook
): Promise<string | null> {
  if (!isMicRoute()) return null;

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );
  onRecording?.(recording);

  try {
    await new Promise((r) => setTimeout(r, ms));
    if (!isMicRoute()) {
      await unloadRecording(recording);
      onRecording?.(null);
      return null;
    }
    await recording.stopAndUnloadAsync();
    onRecording?.(null);
    return recording.getURI();
  } catch (err) {
    await unloadRecording(recording);
    onRecording?.(null);
    throw err;
  }
}
