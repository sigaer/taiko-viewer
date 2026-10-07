// Unity accepts an HTTP URL. Only this exact virtual URL is served from memory;
// runtime downloads and every other request use the browser's normal fetch.
export function createBundleFetch(url, blob, fallback) {
  return (input, init) => {
    const requested = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (requested !== url) return fallback(input, init);
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    if (signal?.aborted) return Promise.reject(signal.reason);
    return Promise.resolve(new Response(blob, {
      headers: { "Content-Type": blob.type, "Content-Length": String(blob.size) }
    }));
  };
}
