import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { getApiBase } from '../lib/apiBase';

const API_BASE = getApiBase();
const MAX_RECORDING_MS = 30_000;

type Options = {
  onFinalTranscript: (text: string) => void;
  onError?: (message: string) => void;
};

async function transcribeAudio(uri: string): Promise<string> {
  const formData = new FormData();
  formData.append('audio', {
    uri,
    name: 'recording.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);

  const response = await fetch(`${API_BASE}/api/speech/transcribe`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Transcription failed (${response.status})`);
  }

  const text = (data.text as string | undefined)?.trim();
  if (!text) throw new Error('No speech detected. Try again.');
  return text;
}

export function useSpeechInput({ onFinalTranscript, onError }: Options) {
  const [listening, setListening] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const maxDurationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinalRef = useRef(onFinalTranscript);
  const onErrorRef = useRef(onError);

  onFinalRef.current = onFinalTranscript;
  onErrorRef.current = onError;

  const clearMaxTimer = useCallback(() => {
    if (maxDurationTimer.current) {
      clearTimeout(maxDurationTimer.current);
      maxDurationTimer.current = null;
    }
  }, []);

  const stopAndTranscribe = useCallback(async () => {
    clearMaxTimer();
    const recording = recordingRef.current;
    recordingRef.current = null;

    if (!recording) {
      setListening(false);
      setPartialTranscript('');
      return;
    }

    try {
      setPartialTranscript('Transcribing…');
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) throw new Error('Recording failed. Try again.');

      const text = await transcribeAudio(uri);
      setPartialTranscript('');
      setListening(false);
      onFinalRef.current(text);
    } catch (err) {
      setListening(false);
      setPartialTranscript('');
      const message = err instanceof Error ? err.message : 'Voice input failed.';
      onErrorRef.current?.(message);
    }
  }, [clearMaxTimer]);

  const startListening = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        onErrorRef.current?.('Microphone permission is required for voice orders.');
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setListening(true);
      setPartialTranscript('Recording… speak now');

      maxDurationTimer.current = setTimeout(() => {
        stopAndTranscribe();
      }, MAX_RECORDING_MS);

      return true;
    } catch {
      setListening(false);
      setPartialTranscript('');
      onErrorRef.current?.('Could not start recording.');
      return false;
    }
  }, [stopAndTranscribe]);

  const stopListening = useCallback(() => {
    if (recordingRef.current) stopAndTranscribe();
  }, [stopAndTranscribe]);

  const toggleListening = useCallback(async () => {
    if (listening) {
      stopListening();
      return;
    }
    await startListening();
  }, [listening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      clearMaxTimer();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, [clearMaxTimer]);

  return {
    listening,
    partialTranscript,
    toggleListening,
    stopListening,
    startListening,
    speechAvailable: true,
  };
}
