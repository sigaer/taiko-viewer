import { nextTick, onActivated, onBeforeUnmount, onDeactivated, watch, type WatchSource } from 'vue';
import { suspendPendingRead, type SuspensibleRead } from '../utils/suspendedRead.ts';

// Reuse the account generation identity. Cached pages invalidate immediately,
// but only the visible page reloads; several changes in one tick share a read.
export const useAccountDataRefresh = (identity: WatchSource, invalidate: () => void, refresh: () => Promise<unknown>, reads: readonly SuspensibleRead[] = []) => {
  let active = true, dirty = false, scheduled = false;
  const suspended = new Set<SuspensibleRead>();
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
  const suspend = () => {
    active = false;
    for (const read of reads) if (suspendPendingRead(read)) suspended.add(read);
  };
  onDeactivated(suspend);
  onActivated(() => {
    active = true;
    if (dirty) schedule();
    else for (const read of suspended) void read.refresh({ dedupe: 'defer' });
    suspended.clear();
  });
  onBeforeUnmount(suspend);
  return Object.assign(requestRefresh, { cancelPending: () => { dirty = false; } });
};
