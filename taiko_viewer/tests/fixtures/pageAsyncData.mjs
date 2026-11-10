import { computed, ref, watch } from 'vue';

// Model Nuxt's synchronous AsyncData handle plus its independently settling
// handler promise. The transport may ignore abort; stale results still lose.
export function pageAsyncData(_key, load, options) {
  const data = ref(options.default()), error = ref(null), status = ref('idle');
  let generation = 0, controller, inFlight;
  const clear = () => {
    generation++; controller?.abort(new DOMException('View left', 'AbortError'));
    inFlight = undefined; data.value = options.default(); error.value = null; status.value = 'idle';
  };
  const refresh = (opts = {}) => {
    if (opts.dedupe === 'defer' && inFlight) return inFlight;
    const token = ++generation;
    controller?.abort(new DOMException('Superseded', 'AbortError'));
    controller = new AbortController();
    const signal = controller.signal;
    status.value = 'pending';
    const aborted = new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    inFlight = Promise.race([Promise.resolve().then(() => load(undefined, { signal })), aborted]).then(value => {
      if (token === generation) { data.value = value; error.value = null; status.value = 'success'; }
    }, failure => {
      if (token === generation && !signal.aborted) { data.value = options.default(); error.value = failure; status.value = 'error'; }
    }).finally(() => { if (token === generation) inFlight = undefined; });
    return inFlight;
  };
  if (options.watch) watch(options.watch, () => void refresh());
  void refresh();
  return { data, error, status, pending: computed(() => status.value === 'pending'), refresh, clear };
}
