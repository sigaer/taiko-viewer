import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { defineEventHandler, sendStream, setHeader } from 'h3';

// Fixed generated artifact; never accept paths or uploaded files here.
export default defineEventHandler(event => {
  const runtime = resolve(process.cwd(), process.env.NODE_ENV === 'production'
    ? '.output/server/tja-runtime' : '.tja-runtime');
  setHeader(event, 'Content-Type', 'application/javascript; charset=utf-8');
  setHeader(event, 'Cache-Control', 'no-cache');
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  return sendStream(event, createReadStream(resolve(runtime, 'image-frame.js')));
});
