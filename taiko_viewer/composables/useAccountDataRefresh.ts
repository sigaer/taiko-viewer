import { nextTick, onActivated, onBeforeUnmount, onDeactivated, watch, type WatchSource } from 'vue';

// Reuse the account generation identity. Cached pages invalidate immediately,
// but only the visible page reloads; several changes in one tick share a read.
export const useAccountDataRefresh = (identity: WatchSource, invalidate: () => void, refresh: () => Promise<unknown>) => {
  let active = true, dirty = false, scheduled = false;
  const schedule = () => {
    if (!active || !dirty || scheduled) return;
    scheduled = true;
    void nextTick(async () => {
      scheduled = false;
      if (!active || !dirty) return;
      dirty = false;
      await refresh();
    });
  };
  const requestRefresh = () => { invalidate(); dirty = true; schedule(); };
  watch(identity, requestRefresh, { flush: 'sync' });
  onDeactivated(() => { active = false; });
  onActivated(() => { active = true; schedule(); });
  onBeforeUnmount(() => { active = false; });
  return requestRefresh;
};
