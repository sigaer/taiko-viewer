/** Consume a small private gateway reply with a byte budget and its own body
 * deadline, including test transports that do not implement fetch cancellation.
 */
export async function readBoundedGatewayJson(response: Response, maxBytes = 16 * 1024, timeoutMs = 15_000): Promise<unknown> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (!Number.isFinite(declared) || declared > maxBytes || declared < 0 || !response.body) throw new Error("Invalid gateway reply");
  const reader = response.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  const chunks: Uint8Array[] = [];
  let size = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { expired = true; void reader.cancel().catch(() => {}); reject(new Error("Gateway body deadline")); }, timeoutMs);
  });
  try {
    const read = async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (expired) throw new Error("Gateway body deadline");
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) throw new Error("Gateway reply limit");
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    };
    return await Promise.race([read(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    void reader.cancel().catch(() => {});
    try { reader.releaseLock(); } catch { /* A cancelled read may still settle. */ }
  }
}
