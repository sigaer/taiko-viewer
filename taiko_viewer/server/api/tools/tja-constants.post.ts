import { defineEventHandler, getHeader, setHeader } from 'h3';
import { isIP } from 'node:net';
import { calculateTja, calculatorError } from '../../services/tools/tjaCalculator';
import { createMemoryRateLimiter } from '../../utils/rate-limit';

const limit = createMemoryRateLimiter({ windowMs: 60_000, limit: 6, maxBuckets: 4096, message: 'Too many TJA requests' });
const MAX_BYTES = 512 * 1024;
let readers = 0;

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store');
  const peer = event.node.req.socket.remoteAddress || 'unknown';
  const forwarded = getHeader(event, 'x-real-ip') || '';
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer);
  limit(event, local && isIP(forwarded) ? forwarded : peer);
  if (getHeader(event, 'content-type')?.split(';')[0] !== 'application/octet-stream') throw calculatorError('file_type', 415);
  const encoding = getHeader(event, 'x-tja-encoding') || 'auto';
  if (!['auto', 'utf-8-sig', 'cp932', 'gb18030'].includes(encoding)) throw calculatorError('encoding', 400);
  const length = Number(getHeader(event, 'content-length'));
  if (Number.isFinite(length) && length > MAX_BYTES) throw calculatorError('file_size', 413);
  if (readers >= 4) throw calculatorError('busy', 503);
  readers++;
  let bytes: Buffer;
  try {
    bytes = await new Promise<Buffer>((accept, reject) => {
      const req = event.node.req;
      const chunks: Buffer[] = [];
      let size = 0;
      const cleanup = () => {
        clearTimeout(timer);
        req.off('data', onData); req.off('end', onEnd); req.off('error', onError); req.off('aborted', onError);
      };
      const fail = (code: string, status: number) => { cleanup(); req.resume(); reject(calculatorError(code, status)); };
      const onData = (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) return fail('file_size', 413);
        chunks.push(chunk);
      };
      const onEnd = () => { cleanup(); accept(Buffer.concat(chunks, size)); };
      const onError = () => fail('upload_failed', 400);
      const timer = setTimeout(() => fail('upload_timeout', 408), 10_000);
      req.on('data', onData); req.once('end', onEnd); req.once('error', onError); req.once('aborted', onError);
    });
  } finally { readers--; }
  if (!bytes.length) throw calculatorError('file_size', 400);
  return calculateTja(bytes, encoding);
});
