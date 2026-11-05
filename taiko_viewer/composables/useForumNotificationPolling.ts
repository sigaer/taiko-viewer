export const useForumNotificationPolling = () => {
  const { accountUser } = useAccountState();
  const { unreadCount, revision, setUnreadCount } = useForumUnreadCount();
  const apiFetch = useViewerApiFetch();
  const route = useRoute();
  let mounted = false;
  let media: MediaQueryList | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let request: AbortController | null = null;
  let generation = 0;

  const enabled = () => mounted && media?.matches && !document.hidden
    && navigator.onLine !== false && Boolean(accountUser.value);
  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const stop = () => {
    generation++;
    clearTimer();
    request?.abort();
    request = null;
  };
  const refresh = async () => {
    if (!enabled() || request) return;
    clearTimer();
    const controller = new AbortController();
    request = controller;
    const ticket = generation, countRevision = revision.value;
    try {
      const result = await apiFetch<{ unreadCount: number }>('/api/forum/notifications/unread', {
        signal: controller.signal, timeout: 10000, retry: 0
      });
      // A mark-read response or account change supersedes an older poll.
      if (enabled() && ticket === generation && countRevision === revision.value) {
        setUnreadCount(result.unreadCount);
      }
    } catch {
      // A transient failure preserves the last confirmed count until retry.
    } finally {
      if (request === controller) {
        request = null;
        if (enabled()) timer = setTimeout(() => { void refresh(); }, 30000);
      }
    }
  };
  const reconcile = () => {
    if (!enabled()) stop();
    else void refresh();
  };

  watch(() => accountUser.value?.id, () => { stop(); reconcile(); }, { flush: 'sync' });
  watch(() => route.fullPath, reconcile);
  onMounted(() => {
    mounted = true;
    media = window.matchMedia('(max-width: 960px)');
    media.addEventListener('change', reconcile);
    document.addEventListener('visibilitychange', reconcile);
    window.addEventListener('focus', reconcile);
    window.addEventListener('online', reconcile);
    window.addEventListener('offline', reconcile);
    reconcile();
  });
  onBeforeUnmount(() => {
    mounted = false;
    stop();
    media?.removeEventListener('change', reconcile);
    document.removeEventListener('visibilitychange', reconcile);
    window.removeEventListener('focus', reconcile);
    window.removeEventListener('online', reconcile);
    window.removeEventListener('offline', reconcile);
  });

  return { unreadCount };
};
