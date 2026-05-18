import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { getVoiceWsUrl } from '../lib/wsBase';
import {
  applyCartActions,
  cartToolResultForVoice,
  CartAction,
} from '../lib/applyCartActions';
import { RealtimePlayback, stopPlayback } from '../lib/realtimePlayback';
import {
  isMicRoute,
  registerActiveRecording,
  resetVoiceAudioSession,
  runAudioExclusive,
  setAudioRoute,
} from '../lib/voiceAudioSession';
import { useCartStore, CartItem } from '../store/cartStore';

const CHUNK_MS = 280;
const THINKING_TIMEOUT_MS = 14_000;

export type VoiceStatus =
  | 'idle'
  | 'connecting'
  | 'linked'
  | 'ready'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

type Options = {
  onTranscript?: (text: string) => void;
};

export function useRealtimeVoice({ onTranscript }: Options = {}) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [lastReply, setLastReply] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const recordingLoopRef = useRef(false);
  const playbackRef = useRef(new RealtimePlayback());
  const userTranscriptBuf = useRef('');
  const assistantTranscriptBuf = useRef('');
  const statusRef = useRef(status);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistantTurnEndRef = useRef(false);
  const dropAssistantAudioRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);

  statusRef.current = status;
  onTranscriptRef.current = onTranscript;

  const clearThinkingTimer = useCallback(() => {
    if (thinkingTimerRef.current) {
      clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
  }, []);

  const armThinkingTimeout = useCallback(() => {
    clearThinkingTimer();
    thinkingTimerRef.current = setTimeout(() => {
      if (statusRef.current === 'thinking') setStatus('ready');
    }, THINKING_TIMEOUT_MS);
  }, [clearThinkingTimer]);

  const sendJson = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const syncCart = useCallback(() => {
    sendJson({ type: 'cart_sync', cartItems: useCartStore.getState().items });
  }, [sendJson]);

  const sendAudioFile = useCallback(async (uri: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN || !isMicRoute()) return;
    const data = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    sendJson({ type: 'audio_chunk', data });
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }, [sendJson]);

  const recordLoop = useCallback(async () => {
    recordingLoopRef.current = true;
    while (recordingLoopRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      if (!isMicRoute()) {
        await new Promise((r) => setTimeout(r, 100));
        continue;
      }

      try {
        await runAudioExclusive(async () => {
          if (!isMicRoute() || !recordingLoopRef.current) return;

          const recording = new Audio.Recording();
          registerActiveRecording(recording);
          try {
            await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
            if (!isMicRoute()) return;

            await recording.startAsync();
            const t0 = Date.now();
            while (Date.now() - t0 < CHUNK_MS) {
              if (!isMicRoute() || !recordingLoopRef.current) {
                await recording.stopAndUnloadAsync().catch(() => {});
                return;
              }
              await new Promise((r) => setTimeout(r, 50));
            }

            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            if (uri && isMicRoute()) await sendAudioFile(uri);
          } finally {
            registerActiveRecording(null);
          }
        });
      } catch (err) {
        if (__DEV__) console.warn('[voice] mic error', err);
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }, [sendAudioFile]);

  const onAssistantTurnEnd = useCallback(async () => {
    if (assistantTurnEndRef.current) return;
    assistantTurnEndRef.current = true;
    try {
      if (playbackRef.current.hasAudio()) {
        setStatus('speaking');
        await playbackRef.current.playBuffered();
        await new Promise((r) => setTimeout(r, 150));
      }
      await setAudioRoute('mic');
      if (statusRef.current !== 'listening') setStatus('ready');
    } finally {
      assistantTurnEndRef.current = false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    recordingLoopRef.current = false;
    clearThinkingTimer();
    playbackRef.current.reset();
    resetVoiceAudioSession();
    await stopPlayback().catch(() => {});

    const ws = wsRef.current;
    wsRef.current = null;
    if (ws?.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'stop' }));
      } catch {
        /* ignore */
      }
      ws.close();
    }

    setStatus('idle');
    setLiveTranscript('');
    userTranscriptBuf.current = '';
    assistantTranscriptBuf.current = '';
  }, [clearThinkingTimer]);

  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;

  const connect = useCallback(async () => {
    if (statusRef.current !== 'idle' && statusRef.current !== 'error') return;

    setError(null);
    setStatus('connecting');
    setLastReply('');
    setLiveTranscript('');

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone permission is required for voice ordering.');
      setStatus('error');
      return;
    }

    await Audio.setIsEnabledAsync(true);

    const ws = new WebSocket(getVoiceWsUrl());
    wsRef.current = ws;

    const connectTimeout = setTimeout(() => {
      if (statusRef.current === 'connecting' || statusRef.current === 'linked') {
        setError('Voice connection timed out. Check Wi‑Fi and backend.');
        setStatus('error');
        ws.close();
      }
    }, 25000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'start', cartItems: useCartStore.getState().items }));
    };

    ws.onmessage = (event) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'ack':
          clearTimeout(connectTimeout);
          setStatus('linked');
          break;

        case 'ready':
          clearTimeout(connectTimeout);
          clearThinkingTimer();
          playbackRef.current.arm();
          void setAudioRoute('mic').then(() => {
            setStatus('ready');
            recordLoop();
          });
          break;

        case 'speech_started':
          if (assistantTurnEndRef.current || statusRef.current === 'speaking') {
            if (__DEV__) console.log('[voice] ignore speech_started during Bistro playback');
            break;
          }
          clearThinkingTimer();
          assistantTurnEndRef.current = false;
          playbackRef.current.interrupt();
          playbackRef.current.arm();
          void setAudioRoute('mic').then(() => {
            setStatus('listening');
            userTranscriptBuf.current = '';
            setLiveTranscript('');
          });
          break;

        case 'speech_stopped':
          void setAudioRoute('assistant').then(() => {
            setStatus('thinking');
            armThinkingTimeout();
          });
          break;

        case 'discard_playback':
          dropAssistantAudioRef.current = true;
          playbackRef.current.interrupt();
          playbackRef.current.arm();
          break;

        case 'audio_delta': {
          clearThinkingTimer();
          if (dropAssistantAudioRef.current) break;
          const audio = (msg.delta as string) || (msg.audio as string);
          if (audio) playbackRef.current.pushDelta(audio);
          if (statusRef.current === 'thinking') setStatus('speaking');
          break;
        }

        case 'audio_done':
          clearThinkingTimer();
          void onAssistantTurnEnd();
          break;

        case 'user_transcript_delta':
          userTranscriptBuf.current += msg.delta as string;
          setLiveTranscript(userTranscriptBuf.current);
          break;

        case 'user_transcript_done': {
          const t = (msg.transcript as string) ?? userTranscriptBuf.current;
          userTranscriptBuf.current = t;
          setLiveTranscript(t);
          break;
        }

        case 'assistant_transcript_delta':
          dropAssistantAudioRef.current = false;
          assistantTranscriptBuf.current += msg.delta as string;
          setLastReply(assistantTranscriptBuf.current);
          break;

        case 'assistant_transcript_done': {
          dropAssistantAudioRef.current = false;
          const t = (msg.transcript as string) ?? assistantTranscriptBuf.current;
          assistantTranscriptBuf.current = t;
          setLastReply(t);
          onTranscriptRef.current?.(t);
          break;
        }

        case 'function_call': {
          clearThinkingTimer();
          dropAssistantAudioRef.current = true;
          playbackRef.current.interrupt();
          playbackRef.current.arm();
          assistantTranscriptBuf.current = '';
          setLastReply('');
          setStatus('thinking');
          try {
            const actions = (msg.actions as CartAction[]) ?? [];
            const name = msg.name as string;
            if (__DEV__) console.log('[voice] tool', name, msg.arguments);
            if (actions.length) applyCartActions(actions);
            else if (__DEV__) console.warn('[voice] tool produced no cart actions', name);
            sendJson({
              type: 'function_result',
              callId: msg.callId,
              output: cartToolResultForVoice(),
              cartItems: useCartStore.getState().items,
            });
          } catch (err) {
            if (__DEV__) console.warn('[voice] function_call error', err);
            sendJson({
              type: 'function_result',
              callId: msg.callId,
              output: 'TOOL_RESULT: Cart update failed on the app.',
              cartItems: useCartStore.getState().items,
            });
          }
          armThinkingTimeout();
          break;
        }

        case 'response_done':
          clearThinkingTimer();
          dropAssistantAudioRef.current = false;
          if (statusRef.current === 'thinking') armThinkingTimeout();
          break;

        case 'error': {
          const errMsg = (msg.message as string) ?? '';
          const benign =
            errMsg.toLowerCase().includes('cancellation failed') ||
            errMsg.toLowerCase().includes('no active response');
          if (benign) {
            if (__DEV__) console.warn('[voice] ignored:', errMsg);
            break;
          }
          clearTimeout(connectTimeout);
          clearThinkingTimer();
          setError(errMsg || 'Voice session error');
          setStatus('error');
          break;
        }

        case 'closed':
          void disconnectRef.current();
          break;

        default:
          break;
      }
    };

    ws.onerror = () => {
      clearTimeout(connectTimeout);
      setError("Can't reach voice server. Is the backend running on the same Wi‑Fi?");
      setStatus('error');
    };

    ws.onclose = () => {
      clearTimeout(connectTimeout);
      recordingLoopRef.current = false;
      if (statusRef.current !== 'error') setStatus('idle');
    };
  }, [armThinkingTimeout, clearThinkingTimer, onAssistantTurnEnd, recordLoop, sendJson, syncCart]);

  useEffect(() => {
    return () => {
      void disconnectRef.current();
    };
  }, []);

  return {
    status,
    error,
    liveTranscript,
    lastReply,
    isActive: status !== 'idle' && status !== 'error' && status !== 'connecting',
    connect,
    disconnect,
  };
}
