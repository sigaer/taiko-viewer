// Retry individual downloads once; never create two Unity instances to retry a boot.
function combinedSignal(signals) {
  // Keep older WebGL-capable browsers working without AbortSignal.any().
  const controller = new AbortController();
  for (const signal of signals.filter(Boolean)) {
    if (signal.aborted) { controller.abort(signal.reason); break; }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true, signal: controller.signal });
  }
  return controller.signal;
}

export function createPlayerFetch(nativeFetch, origin, lifetimeSignal) {
  return async (input, init = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, origin);
    const playerResource = url.origin === origin && (url.pathname.startsWith('/ourtaikoview-runtime/') || url.pathname === '/practice-player/release.json');
    if (!playerResource || (init.method || input?.method || 'GET').toUpperCase() !== 'GET') return nativeFetch(input, init);
    const callerSignal = init.signal || input?.signal;
    for (let attempt = 0; ; attempt++) {
      const signal = combinedSignal([lifetimeSignal, callerSignal, AbortSignal.timeout(60_000)]);
      try {
        const response = await nativeFetch(input, { ...init, signal });
        if (response.ok) return response;
        if (attempt || (response.status !== 408 && response.status !== 429 && response.status < 500)) return response;
        await response.body?.cancel();
      } catch (error) {
        if (attempt || callerSignal?.aborted || lifetimeSignal?.aborted) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      lifetimeSignal?.throwIfAborted();
      callerSignal?.throwIfAborted();
    }
  };
}

export async function loadPlayerScript(src, document, signal) {
  for (let attempt = 0; ; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        signal.throwIfAborted();
        const script = document.createElement('script');
        const finish = error => {
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
          script.onload = script.onerror = null;
          if (error) { script.remove(); reject(error); } else resolve();
        };
        const abort = () => finish(new Error('Player load cancelled'));
        const timer = setTimeout(() => finish(new Error('Player script timed out')), 20_000);
        signal.addEventListener('abort', abort, { once: true });
        script.src = src;
        script.onload = () => finish();
        script.onerror = () => finish(new Error('Player script unavailable'));
        document.head.appendChild(script);
      });
      return;
    } catch (error) {
      if (attempt || signal.aborted) throw error;
    }
  }
}
