import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

/** Convert m4a/caf buffer from Expo to PCM16 mono 24kHz base64 for OpenAI Realtime. */
export async function m4aBufferToPcm16Base64(buffer, mimetype = 'audio/m4a') {
  const ext = mimetype.includes('wav')
    ? 'wav'
    : mimetype.includes('mp4') || mimetype.includes('m4a')
      ? 'm4a'
      : 'm4a';
  const id = randomBytes(8).toString('hex');
  const inputPath = join(tmpdir(), `bistro-rt-${id}.${ext}`);
  const pcmPath = join(tmpdir(), `bistro-rt-${id}.pcm`);

  try {
    writeFileSync(inputPath, buffer);
    if (!ffmpegPath) throw new Error('ffmpeg unavailable');
    await execFileAsync(ffmpegPath, [
      '-i',
      inputPath,
      '-ar',
      '24000',
      '-ac',
      '1',
      '-f',
      's16le',
      '-y',
      pcmPath,
    ]);
    const pcm = readFileSync(pcmPath);
    return pcm.toString('base64');
  } finally {
    try {
      unlinkSync(inputPath);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(pcmPath);
    } catch {
      /* ignore */
    }
  }
}
