import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createError } from 'h3';

const run = promisify(execFile);
const MAX_WAV = 120 * 1024 * 1024;
let active = false;

// No retained audio cache or unbounded conversion queue. Hold admission until the
// ZIP stream closes, so slow clients cannot accumulate temporary WAV files.
export async function preparePracticeWav(source: string, signal: AbortSignal) {
  if (active) throw createError({ statusCode: 503, statusMessage: 'Audio converter busy' });
  active = true;
  let directory: string | undefined;
  let released = false;
  const cleanup = async () => {
    if (released) return;
    released = true;
    try { if (directory) await rm(directory, { recursive: true, force: true }); }
    finally { active = false; }
  };
  try {
    signal.throwIfAborted();
    if ((await stat(source)).size > 128 * 1024 * 1024) throw new Error('Audio source too large');
    directory = await mkdtemp('/var/tmp/taiko-practice-audio-');
    const audioPath = join(directory, 'practice.wav');
    await run('/usr/bin/ffmpeg', [
      '-nostdin', '-v', 'error', '-threads', '1', '-i', source,
      '-map', '0:a:0', '-vn', '-threads', '1', '-ac', '2', '-ar', '44100',
      '-c:a', 'pcm_s16le', '-fs', String(MAX_WAV), audioPath
    ], { signal, timeout: 60_000, killSignal: 'SIGKILL', maxBuffer: 8192 });
    const size = (await stat(audioPath)).size;
    // ffmpeg reports success when -fs stops output: reject instead of serving a truncated song.
    if (size <= 44 || size >= MAX_WAV) throw new Error('Converted audio outside size limit');
    return { audioPath, audioName: 'practice.wav', cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

export function withPracticeWave(chart: string) {
  if (!/^\s*WAVE\s*:.+$/im.test(chart)) throw new Error('Missing WAVE field');
  return chart.replace(/^([ \t]*WAVE[ \t]*:)[^\r\n]*/gim, '$1practice.wav');
}
