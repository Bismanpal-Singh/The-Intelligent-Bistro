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
  ensureMicCaptureMode,
  isMicRoute,
  registerActiveRecording,
  resetVoiceAudioSession,
  runAudioExclusive,
  setAudioRoute,
} from '../lib/voiceAudioSession';
import { captureVoiceChunk } from '../lib/voiceRecording';
import { useCartStore, CartItem } from '../store/cartStore';

const CHUNK_MS = 400;
const MIC_ERROR_BACKOFF_MS = 600;
const THINKING_TIMEOUT_MS = 14_000;
const LISTENING_TIMEOUT_MS = 45_000;

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
  const listeningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistantTurnEndRef = useRef(false);
  const dropAssistantAudioRef = useRef(false);
  /** Hide Bistro caption until audio plays; then reveal in sync with speaker. */
  const holdCaptionForAudioRef = useRef(false);
  const assistantSpeakerRouteRef = useRef(false);
  const captionCharsShownRef = useRef(0);
  const onTranscriptRef = useRef(onTranscript);

  statusRef.current = status;
  onTranscriptRef.current = onTranscript;

  const resetCaption = useCallback(() => {
    captionCharsShownRef.current = 0;
    setLastReply('');
  }, []);

  /** Caption only grows during a turn — prevents flash then restart on multi-chunk audio. */
  const applyCaption = useCallback((visible: string) => {
    if (!visible) {
      resetCaption();
      return;
    }
    if (visible.length < captionCharsShownRef.current) return;
    captionCharsShownRef.current = visible.length;
    setLastReply(visible);
  }, [resetCaption]);

  const clearThinkingTimer = useCallback(() => {
    if (thinkingTimerRef.current) {
      clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
  }, []);

  const clearListeningTimer = useCallback(() => {
    if (listeningTimerRef.current) {
      clearTimeout(listeningTimerRef.current);
      listeningTimerRef.current = null;
    }
  }, []);

  /** Re-open mic after a stuck or empty turn (status alone is not enough). */
  const returnToMicReady = useCallback(async () => {
    clearThinkingTimer();
    clearListeningTimer();
    dropAssistantAudioRef.current = false;
    await setAudioRoute('mic');
    const s = statusRef.current;
    if (s !== 'idle' && s !== 'connecting' && s !== 'linked' && s !== 'error') {
      setStatus('ready');
    }
  }, [clearThinkingTimer, clearListeningTimer]);

  const armThinkingTimeout = useCallback(() => {
    clearThinkingTimer();
    thinkingTimerRef.current = setTimeout(() => {
      if (statusRef.current === 'thinking') void returnToMicReady();
    }, THINKING_TIMEOUT_MS);
  }, [clearThinkingTimer, returnToMicReady]);

  const armListeningTimeout = useCallback(() => {
    clearListeningTimer();
    listeningTimerRef.current = setTimeout(() => {
      if (statusRef.current === 'listening') void returnToMicReady();
    }, LISTENING_TIMEOUT_MS);
  }, [clearListeningTimer, returnToMicReady]);

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
    if (!data?.length) return;
    sendJson({ type: 'audio_chunk', data });
    if (__DEV__) console.log('[voice] sent audio chunk', data.length, 'b64 chars');
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }, [sendJson]);

  const recordLoop = useCallback(async () => {
    recordingLoopRef.current = true;
    let micErrorStreak = 0;
    while (recordingLoopRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      if (!isMicRoute()) {
        await new Promise((r) => setTimeout(r, 100));
        continue;
      }

      try {
        const uri = await runAudioExclusive(async () => {
          if (!isMicRoute() || !recordingLoopRef.current) return null;
          return captureVoiceChunk(CHUNK_MS, registerActiveRecording);
        });
        micErrorStreak = 0;
        if (uri && isMicRoute() && recordingLoopRef.current) {
          await sendAudioFile(uri);
        }
      } catch (err) {
        micErrorStreak += 1;
        if (__DEV__ && micErrorStreak <= 3) {
          console.warn('[voice] mic error', err);
        }
        await new Promise((r) =>
          setTimeout(r, MIC_ERROR_BACKOFF_MS * Math.min(micErrorStreak, 4))
        );
      }
    }
  }, [sendAudioFile]);

  const onAssistantTurnEnd = useCallback(async () => {
    if (assistantTurnEndRef.current) return;
    assistantTurnEndRef.current = true;
    try {
      playbackRef.current.setCaptionOptions({
        getCaption: () => assistantTranscriptBuf.current,
        onCaptionUpdate: applyCaption,
      });

      if (playbackRef.current.hasAudio()) {
        if (statusRef.current === 'thinking') setStatus('speaking');
        await playbackRef.current.finish();
        if (assistantTranscriptBuf.current) {
          applyCaption(assistantTranscriptBuf.current);
        }
        await new Promise((r) => setTimeout(r, 80));
      } else if (assistantTranscriptBuf.current) {
        applyCaption(assistantTranscriptBuf.current);
      }
      holdCaptionForAudioRef.current = false;
      assistantSpeakerRouteRef.current = false;
      clearListeningTimer();
      await setAudioRoute('mic');
      if (statusRef.current !== 'idle' && statusRef.current !== 'error') {
        setStatus('ready');
      }
    } finally {
      assistantTurnEndRef.current = false;
    }
  }, [applyCaption, clearListeningTimer]);

  const disconnect = useCallback(async () => {
    recordingLoopRef.current = false;
    clearThinkingTimer();
    clearListeningTimer();
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
    holdCaptionForAudioRef.current = false;
    assistantSpeakerRouteRef.current = false;
  }, [clearThinkingTimer, clearListeningTimer, resetCaption]);

  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;

  const connect = useCallback(async () => {
    if (statusRef.current !== 'idle' && statusRef.current !== 'error') return;

    setError(null);
    setStatus('connecting');
    resetCaption();
    setLiveTranscript('');

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone permission is required for voice ordering.');
      setStatus('error');
      return;
    }

    await Audio.setIsEnabledAsync(true);
    await ensureMicCaptureMode();

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
          assistantSpeakerRouteRef.current = false;
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
          assistantSpeakerRouteRef.current = false;
          void setAudioRoute('mic').then(() => {
            setStatus('listening');
            userTranscriptBuf.current = '';
            setLiveTranscript('');
            armListeningTimeout();
          });
          break;

        case 'speech_stopped':
          clearListeningTimer();
          assistantTranscriptBuf.current = '';
          holdCaptionForAudioRef.current = true;
          resetCaption();
          setStatus('thinking');
          armThinkingTimeout();
          break;

        case 'discard_playback':
          dropAssistantAudioRef.current = true;
          holdCaptionForAudioRef.current = false;
          assistantSpeakerRouteRef.current = false;
          playbackRef.current.interrupt();
          playbackRef.current.arm();
          break;

        case 'audio_delta': {
          clearThinkingTimer();
          if (dropAssistantAudioRef.current) break;
          const audio = (msg.delta as string) || (msg.audio as string);
          if (audio) {
            if (!assistantSpeakerRouteRef.current) {
              assistantSpeakerRouteRef.current = true;
              void setAudioRoute('assistant');
            }
            playbackRef.current.setCaptionOptions({
              getCaption: () => assistantTranscriptBuf.current,
              onCaptionUpdate: applyCaption,
            });
            playbackRef.current.pushDelta(audio);
          }
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
          break;

        case 'assistant_transcript_done': {
          dropAssistantAudioRef.current = false;
          const t = (msg.transcript as string) ?? assistantTranscriptBuf.current;
          assistantTranscriptBuf.current = t;
          onTranscriptRef.current?.(t);
          break;
        }

        case 'function_call': {
          clearThinkingTimer();
          dropAssistantAudioRef.current = true;
          holdCaptionForAudioRef.current = true;
          assistantSpeakerRouteRef.current = false;
          playbackRef.current.interrupt();
          playbackRef.current.arm();
          assistantTranscriptBuf.current = '';
          resetCaption();
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
          if (
            statusRef.current === 'thinking' &&
            !playbackRef.current.hasAudio() &&
            !assistantTurnEndRef.current
          ) {
            void returnToMicReady();
          }
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
  }, [
    applyCaption,
    armListeningTimeout,
    armThinkingTimeout,
    clearThinkingTimer,
    onAssistantTurnEnd,
    recordLoop,
    resetCaption,
    returnToMicReady,
    sendJson,
    syncCart,
  ]);

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
