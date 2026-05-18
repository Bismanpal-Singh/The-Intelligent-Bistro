import { WebSocketServer, WebSocket } from 'ws';
import { m4aBufferToPcm16Base64 } from './audioPcm.js';
import {
  VOICE_INSTRUCTIONS,
  cartContextString,
  toOpenAITools,
  toolCallToActions,
  transcriptionHintForPrompt,
} from './agentShared.js';

const REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL ?? 'gpt-4o-mini-realtime-preview-2024-12-17';
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE ?? 'alloy';
const TRANSCRIPTION_MODEL =
  process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-4o-mini-transcribe';
const SESSION_UPDATE_TIMEOUT_MS = 4000;

function openAIRealtimeUrl() {
  return `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(REALTIME_MODEL)}`;
}

function sendJson(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function buildSessionUpdate(cartItems) {
  const cart = cartContextString(cartItems ?? []);
  return {
    type: 'session.update',
    session: {
      type: 'realtime',
      model: REALTIME_MODEL,
      output_modalities: ['audio'],
      instructions: `${VOICE_INSTRUCTIONS}\n\n${cart}`,
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24000 },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 600,
          },
          transcription: {
            model: TRANSCRIPTION_MODEL,
            language: 'en',
            prompt: transcriptionHintForPrompt(),
          },
          noise_reduction: { type: 'near_field' },
        },
        output: {
          format: { type: 'audio/pcm', rate: 24000 },
          voice: REALTIME_VOICE,
        },
      },
      tools: toOpenAITools(),
    },
  };
}

function forwardUserTranscript(clientWs, event) {
  if (event.delta) {
    sendJson(clientWs, { type: 'user_transcript_delta', delta: event.delta });
  }
  if (event.transcript) {
    sendJson(clientWs, { type: 'user_transcript_done', transcript: event.transcript });
  }
}

function isBenignRealtimeError(message) {
  const m = (message ?? '').toLowerCase();
  return (
    m.includes('cancellation failed') ||
    m.includes('no active response') ||
    m.includes('response_cancel')
  );
}

function forwardAssistantTranscript(clientWs, event) {
  if (event.delta) {
    sendJson(clientWs, { type: 'assistant_transcript_delta', delta: event.delta });
  }
  if (event.transcript) {
    sendJson(clientWs, {
      type: 'assistant_transcript_done',
      transcript: event.transcript,
    });
  }
}

function handleClientConnection(clientWs) {
  console.log('[voice] Client connected');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sendJson(clientWs, {
      type: 'error',
      message: 'OPENAI_API_KEY is not set on the backend.',
    });
    clientWs.close();
    return;
  }

  sendJson(clientWs, { type: 'ack' });

  let openaiWs = null;
  let sessionReady = false;
  let awaitingSessionUpdate = false;
  let pendingCart = [];
  /** @type {Map<string, { resolve: (o: string) => void }>} */
  const pendingToolResults = new Map();
  let sessionUpdatePromise = null;
  let resolveSessionUpdate = null;
  /** True while the model is streaming audio for the current response. */
  let responseHasAudio = false;

  const closeAll = (reason) => {
    if (reason) sendJson(clientWs, { type: 'closed', message: reason });
    try {
      openaiWs?.close();
    } catch {
      /* ignore */
    }
    try {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
    } catch {
      /* ignore */
    }
  };

  const pushSessionUpdate = () => {
    if (openaiWs?.readyState !== WebSocket.OPEN) return;
    awaitingSessionUpdate = true;
    sessionUpdatePromise = new Promise((resolve) => {
      resolveSessionUpdate = resolve;
    });
    openaiWs.send(JSON.stringify(buildSessionUpdate(pendingCart)));
  };

  const waitForSessionUpdate = () =>
    Promise.race([
      sessionUpdatePromise ?? Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, SESSION_UPDATE_TIMEOUT_MS)),
    ]);

  const connectOpenAI = () => {
    if (openaiWs && openaiWs.readyState !== WebSocket.CLOSED) return;

    console.log('[voice] Connecting to OpenAI Realtime…');
    openaiWs = new WebSocket(openAIRealtimeUrl(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    openaiWs.on('open', () => {
      console.log('[voice] OpenAI socket open');
      pushSessionUpdate();
    });

    openaiWs.on('message', async (raw) => {
      let event;
      try {
        event = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (process.env.VOICE_DEBUG === '1' && event.type?.includes('transcript')) {
        console.log('[voice] OpenAI transcript event:', event.type);
      }

      switch (event.type) {
        case 'session.updated':
          if (resolveSessionUpdate) {
            resolveSessionUpdate();
            resolveSessionUpdate = null;
            sessionUpdatePromise = null;
          }
          if (awaitingSessionUpdate || !sessionReady) {
            awaitingSessionUpdate = false;
            if (!sessionReady) {
              sessionReady = true;
              console.log('[voice] Session ready');
              sendJson(clientWs, { type: 'ready' });
            }
          }
          break;

        case 'input_audio_buffer.speech_started':
          sendJson(clientWs, { type: 'speech_started' });
          break;

        case 'input_audio_buffer.speech_stopped':
          sendJson(clientWs, { type: 'speech_stopped' });
          break;

        case 'response.audio.delta':
        case 'response.output_audio.delta': {
          const delta =
            typeof event.delta === 'string'
              ? event.delta
              : typeof event.audio === 'string'
                ? event.audio
                : null;
          if (delta) {
            responseHasAudio = true;
            sendJson(clientWs, { type: 'audio_delta', delta });
          }
          break;
        }

        case 'response.audio.done':
        case 'response.output_audio.done':
          sendJson(clientWs, { type: 'audio_done' });
          break;

        case 'conversation.item.input_audio_transcription.delta':
          forwardUserTranscript(clientWs, event);
          break;

        case 'conversation.item.input_audio_transcription.completed':
          forwardUserTranscript(clientWs, event);
          break;

        case 'conversation.item.input_audio_transcription.failed':
          console.warn('[voice] user transcription failed:', event.error);
          break;

        case 'response.audio_transcript.delta':
        case 'response.output_audio_transcript.delta':
          forwardAssistantTranscript(clientWs, event);
          break;

        case 'response.audio_transcript.done':
        case 'response.output_audio_transcript.done':
          forwardAssistantTranscript(clientWs, event);
          break;

        case 'response.function_call_arguments.done': {
          const callId = event.call_id;
          const name = event.name;
          let args = {};
          try {
            args = JSON.parse(event.arguments || '{}');
          } catch {
            args = {};
          }
          const actions = toolCallToActions(name, args);
          console.log('[voice] tool call', name, JSON.stringify(args));

          if (responseHasAudio) {
            sendJson(clientWs, { type: 'discard_playback' });
          }
          responseHasAudio = false;

          sendJson(clientWs, {
            type: 'function_call',
            callId,
            name,
            arguments: args,
            actions,
          });

          void (async () => {
            const output = await new Promise((resolve) => {
              const timeout = setTimeout(() => {
                pendingToolResults.delete(callId);
                resolve('TOOL_RESULT: Cart update timed out on the app.');
              }, 8000);
              pendingToolResults.set(callId, {
                resolve: (text) => {
                  clearTimeout(timeout);
                  resolve(text);
                },
              });
            });

            if (openaiWs?.readyState !== WebSocket.OPEN) return;

            if (pendingCart.length) {
              pushSessionUpdate();
              await waitForSessionUpdate();
            }

            openaiWs.send(
              JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output,
                },
              })
            );
            openaiWs.send(JSON.stringify({ type: 'response.create' }));
          })();
          break;
        }

        case 'response.created':
          responseHasAudio = false;
          break;

        case 'response.done':
          responseHasAudio = false;
          sendJson(clientWs, { type: 'response_done' });
          break;

        case 'error': {
          const errMsg = event.error?.message ?? 'Realtime API error';
          if (isBenignRealtimeError(errMsg)) {
            console.warn('[voice] ignored:', errMsg);
            break;
          }
          console.error('OpenAI Realtime error:', event.error);
          awaitingSessionUpdate = false;
          sendJson(clientWs, { type: 'error', message: errMsg });
          break;
        }

        default:
          if (event.type?.includes('input_audio_transcription')) {
            forwardUserTranscript(clientWs, event);
          } else if (
            event.type?.includes('output_audio_transcript') ||
            event.type?.includes('audio_transcript')
          ) {
            forwardAssistantTranscript(clientWs, event);
          }
          break;
      }
    });

    openaiWs.on('close', (code, reason) => {
      console.log('[voice] OpenAI WS closed', code, reason?.toString?.() ?? '');
      openaiWs = null;
      sessionReady = false;
    });

    openaiWs.on('error', (err) => {
      console.error('OpenAI WS error:', err.message);
      sendJson(clientWs, { type: 'error', message: err.message });
    });

    openaiWs.on('unexpected-response', (_req, res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        console.error('[voice] OpenAI HTTP', res.statusCode, body.slice(0, 300));
        sendJson(clientWs, {
          type: 'error',
          message: `OpenAI connection failed (${res.statusCode}). Check API key and billing.`,
        });
      });
    });
  };

  const appendM4a = async (buffer) => {
    if (openaiWs?.readyState !== WebSocket.OPEN) return;
    try {
      const pcmBase64 = await m4aBufferToPcm16Base64(buffer, 'audio/m4a');
      if (pcmBase64) {
        openaiWs.send(
          JSON.stringify({ type: 'input_audio_buffer.append', audio: pcmBase64 })
        );
      }
    } catch (err) {
      console.error('Audio convert error:', err.message);
    }
  };

  connectOpenAI();

  clientWs.on('message', async (raw) => {
    let msg;
    try {
      const text =
        typeof raw === 'string'
          ? raw
          : Buffer.isBuffer(raw)
            ? raw.toString('utf8')
            : Array.isArray(raw)
              ? Buffer.concat(raw).toString('utf8')
              : Buffer.from(raw).toString('utf8');

      if (text.trimStart().startsWith('{')) {
        msg = JSON.parse(text);
      } else {
        await appendM4a(Buffer.isBuffer(raw) ? raw : Buffer.from(raw));
        return;
      }
    } catch (err) {
      console.error('[voice] Bad client message:', err.message);
      return;
    }

    if (msg.type === 'audio_chunk' && msg.data) {
      await appendM4a(Buffer.from(msg.data, 'base64'));
      return;
    }

    switch (msg.type) {
      case 'start':
        pendingCart = msg.cartItems ?? [];
        pushSessionUpdate();
        break;

      case 'cart_sync':
        pendingCart = msg.cartItems ?? [];
        pushSessionUpdate();
        break;

      case 'function_result': {
        if (msg.cartItems) pendingCart = msg.cartItems;
        const pending = pendingToolResults.get(msg.callId);
        if (pending) {
          pending.resolve(msg.output ?? 'TOOL_RESULT: Done.');
          pendingToolResults.delete(msg.callId);
        }
        break;
      }

      case 'stop':
        closeAll();
        break;

      default:
        break;
    }
  });

  clientWs.on('close', () => {
    console.log('[voice] Client disconnected');
    try {
      openaiWs?.close();
    } catch {
      /* ignore */
    }
  });
}

export function attachVoiceRealtime(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname !== '/voice/realtime') {
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', handleClientConnection);

  return wss;
}
