import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import ffmpegPath from 'ffmpeg-static';
import { pipeline } from '@xenova/transformers';
import wavefile from 'wavefile';

const { WaveFile } = wavefile;

const execFileAsync = promisify(execFile);

/** Lazy-load Whisper tiny — first call downloads the model (~40MB) once. */
let transcriberPromise = null;

function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en'
    );
  }
  return transcriberPromise;
}

async function convertToWav(inputPath, outputPath) {
  if (!ffmpegPath) {
    throw new Error('ffmpeg is not available for audio conversion.');
  }
  await execFileAsync(ffmpegPath, [
    '-i',
    inputPath,
    '-ar',
    '16000',
    '-ac',
    '1',
    '-f',
    'wav',
    '-y',
    outputPath,
  ]);
}

/** Decode WAV file to Float32Array for transformers.js (no AudioContext in Node). */
function wavToFloat32(wavPath) {
  const buffer = readFileSync(wavPath);
  const wav = new WaveFile(buffer);
  wav.toBitDepth('32f');
  wav.toSampleRate(16000);

  let audioData = wav.getSamples();
  if (Array.isArray(audioData)) {
    if (audioData.length > 1) {
      const SCALING_FACTOR = Math.sqrt(2);
      for (let i = 0; i < audioData[0].length; ++i) {
        audioData[0][i] =
          (SCALING_FACTOR * (audioData[0][i] + audioData[1][i])) / 2;
      }
    }
    audioData = audioData[0];
  }

  return audioData;
}

/**
 * Transcribe audio buffer (m4a/caf from Expo) to text.
 * Runs locally — no OpenAI key. Claude is used only for chat after transcription.
 */
export async function transcribeAudioBuffer(buffer, mimetype = 'audio/m4a') {
  const ext = mimetype.includes('wav') ? 'wav' : mimetype.includes('mp4') ? 'mp4' : 'm4a';
  const id = randomBytes(8).toString('hex');
  const inputPath = join(tmpdir(), `bistro-${id}.${ext}`);
  const wavPath = join(tmpdir(), `bistro-${id}.wav`);

  try {
    writeFileSync(inputPath, buffer);
    await convertToWav(inputPath, wavPath);

    const audioData = wavToFloat32(wavPath);
    const transcriber = await getTranscriber();
    const result = await transcriber(audioData, {
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    return (result?.text ?? '').trim();
  } finally {
    try {
      unlinkSync(inputPath);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(wavPath);
    } catch {
      /* ignore */
    }
  }
}
