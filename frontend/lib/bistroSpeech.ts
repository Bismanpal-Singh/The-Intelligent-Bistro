import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

/** Strip characters that sound odd when read aloud. */
export function speechReadyText(text: string): string {
  return text
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stopSpeaking(): void {
  Speech.stop();
}

export async function isSpeaking(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}

export function speakBistro(text: string, onDone?: () => void): void {
  const cleaned = speechReadyText(text);
  if (!cleaned) {
    onDone?.();
    return;
  }

  Speech.stop();
  Speech.speak(cleaned, {
    language: 'en-US',
    pitch: 0.98,
    rate: Platform.select({ ios: 0.9, android: 0.95, default: 1 }),
    onDone: () => onDone?.(),
    onStopped: () => onDone?.(),
  });
}
