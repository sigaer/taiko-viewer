import { open, readdir, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

export type LogCursor = { dev: number; ino: number; offset: number; anchor: string };
const digest = (value: Buffer) => createHash('sha256').update(value).digest('hex');
export async function readLogBatch(path: string, saved?: LogCursor, maxBytes = 8 * 1024 * 1024) {
  let selected = path;
  const current = await stat(path);
  let gap = false;
  if (saved && (current.ino !== saved.ino || current.dev !== saved.dev)) {
    const names = (await readdir(dirname(path))).filter(name => name.startsWith(basename(path))).slice(0, 100);
    let found = false;
    for (const name of names) {
      const candidate = join(dirname(path), name);
      const info = await stat(candidate).catch(() => null);
      if (info?.ino === saved.ino && info.dev === saved.dev) { selected = candidate; found = true; break; }
    }
    if (!found) { saved = undefined; gap = true; }
  }
  const file = await open(selected, 'r');
  try {
    const info = await file.stat();
    let offset = saved?.offset || 0;
    if (offset > info.size) { offset = 0; gap = true; }
    if (offset && saved?.anchor) {
      const anchor = Buffer.alloc(Math.min(offset, 128));
      await file.read(anchor, 0, anchor.length, offset - anchor.length);
      if (digest(anchor) !== saved.anchor) { offset = 0; gap = true; }
    }
    const buffer = Buffer.alloc(Math.min(maxBytes, Math.max(0, info.size - offset)));
    const { bytesRead } = await file.read(buffer, 0, buffer.length, offset);
    const lastNewline = buffer.subarray(0, bytesRead).lastIndexOf(10);
    // Never checkpoint an incomplete line. A pathological >8MiB line stops
    // ingestion with an explicit error instead of losing its boundary.
    if (bytesRead === maxBytes && lastNewline < 0) throw new Error('traffic_log_line_too_large');
    const consumed = lastNewline + 1;
    const text = buffer.subarray(0, consumed).toString('utf8');
    offset += consumed;
    const anchor = Buffer.alloc(Math.min(offset, 128));
    await file.read(anchor, 0, anchor.length, offset - anchor.length);
    let cursor = { dev: info.dev, ino: info.ino, offset, anchor: digest(anchor) };
    let backlog = Math.max(0, info.size - offset);
    if (selected !== path && offset === info.size) {
      cursor = { dev: current.dev, ino: current.ino, offset: 0, anchor: '' };
      backlog = current.size;
    }
    return { text, cursor, backlog, gap, partialLine: consumed < bytesRead && bytesRead < maxBytes };
  } finally { await file.close(); }
}
