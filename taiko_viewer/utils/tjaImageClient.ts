// An opaque-origin frame confines the upstream canvas hooks and parser to this tool.
// Only bounded metadata and PNG Blobs cross back to the application.
export function createTjaImageClient() {
  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.title = 'TJA renderer';
  frame.setAttribute('sandbox', 'allow-scripts');
  const source = new URL('/tja-tools/renderer.js', location.origin).href;
  frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${source}; img-src data:; font-src data:; connect-src 'none'"><script src="${source}"><\/script>`;
  let pending: { id: string; resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | undefined;
  let disposed = false;
  let readyResolve: () => void;
  const ready = new Promise<void>(resolve => { readyResolve = resolve; });
  function onMessage(event: MessageEvent) {
    if (event.source !== frame.contentWindow || event.origin !== 'null' || disposed) return;
    if (event.data?.type === 'tja-image-ready') { readyResolve(); return; }
    if (!pending || event.data?.id !== pending.id) return;
    const task = pending;
    pending = undefined;
    clearTimeout(task.timer);
    if (event.data.error) task.reject(new Error(event.data.error));
    else task.resolve(event.data.result);
  }
  function dispose(code = 'cancelled') {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('message', onMessage);
    frame.remove();
    if (pending) { clearTimeout(pending.timer); pending.reject(new Error(code)); pending = undefined; }
  }
  window.addEventListener('message', onMessage);
  document.body.appendChild(frame);
  return {
    request<T>(action: string, data: Record<string, unknown>): Promise<T> {
      if (disposed || pending) return Promise.reject(new Error('image_failed'));
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        pending = { id, resolve, reject, timer: setTimeout(() => dispose('image_timeout'), 20_000) };
        void ready.then(() => {
          if (!disposed && pending?.id === id) frame.contentWindow?.postMessage({ ...data, id, action }, '*');
        });
      });
    },
    dispose
  };
}
