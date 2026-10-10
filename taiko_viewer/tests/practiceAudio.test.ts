import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { preparePracticeWav, withPracticeWave } from '../server/utils/practiceAudio.ts';

test('WAVE replacement preserves chart timing and line endings', () => {
  assert.equal(withPracticeWave('TITLE:X\r\nWAVE:音楽.ogg\r\nOFFSET:-1.25\r\n#START\r\n0,'),
    'TITLE:X\r\nWAVE:practice.wav\r\nOFFSET:-1.25\r\n#START\r\n0,');
});

test('real conversion produces PCM WAV, bounds admission and cleans files', async () => {
  const dir = await mkdtemp('/var/tmp/practice-audio-test-');
  let converted;
  try {
    await promisify(execFile)('/usr/bin/ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.2', '-c:a', 'libvorbis', `${dir}/test.ogg`]);
    converted = await preparePracticeWav(`${dir}/test.ogg`, new AbortController().signal);
    const bytes = await readFile(converted.audioPath);
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString(), 'WAVE');
    await assert.rejects(preparePracticeWav(`${dir}/test.ogg`, new AbortController().signal), /busy/);
    await converted.cleanup();
    await assert.rejects(access(converted.audioPath));
    const abort = new AbortController(); abort.abort();
    await assert.rejects(preparePracticeWav(`${dir}/test.ogg`, abort.signal), { name: 'AbortError' });
    converted = await preparePracticeWav(`${dir}/test.ogg`, new AbortController().signal);
  } finally { await converted?.cleanup(); await rm(dir, { recursive: true, force: true }); }
});
