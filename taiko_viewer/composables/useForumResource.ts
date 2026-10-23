import { resolveViewerError } from '~/utils/viewerError';

// The plain Nuxt payload remains authoritative, including the unread count
// reconciled by Notifications. Ownership metadata never contains a second DTO.
export const useForumResource = <T>(key: string, load: () => Promise<T>, options: {
  context?: () => string;
  enabled?: () => boolean;
} = {}) => {
  const { accountUser } = useAccountState();
  const { t, locale } = useI18n();
  const guard = useAccountRequestGuard(false);
  const active = ref(true);
  const owner = useState(`${key}:owner`, () => '');
  // Carry an SSR failure through hydration; null payload alone is not empty.
  const failure = useState(`${key}:failure`, () => ({ context: '', message: '' }));
  const context = computed(() => `${accountUser.value?.id || 'guest'}:${options.context?.() || ''}`);
  const enabled = computed(() => options.enabled?.() ?? true);
  const resource = useAsyncData<T | null>(key, async () => {
    const requested = context.value, ticket = guard.capture();
    if (!active.value || !enabled.value) return null;
    failure.value = { context: requested, message: '' };
    try {
      const value = await load();
      if (!active.value || !guard.current(ticket) || context.value !== requested) return null;
      owner.value = requested;
      return value;
    } catch (error) {
      const message = Number((error as { statusCode?: number })?.statusCode) === 404
        ? (locale.value === 'ja' ? '内容が見つからないか、表示できません' : '内容不存在或不可访问')
        : await resolveViewerError(error, t('errors.actionFailed'), t);
      if (active.value && guard.current(ticket) && context.value === requested) failure.value = { context: requested, message };
      return null;
    }
  }, { lazy: true, default: () => null, dedupe: 'cancel' });
  const refresh = () => {
    guard.invalidate();
    owner.value = '';
    resource.clear();
    failure.value = { context: '', message: '' };
    return active.value && enabled.value ? resource.refresh() : Promise.resolve();
  };
  watch([context, enabled], () => { void refresh(); }, { flush: 'sync' });
  onDeactivated(() => {
    active.value = false;
    guard.invalidate();
    if (resource.pending.value) { resource.clear(); owner.value = ''; }
  });
  onActivated(() => {
    if (active.value) return; // Initial activation already owns its initial read.
    active.value = true;
    void refresh();
  });
  onBeforeUnmount(() => { active.value = false; guard.invalidate(); });
  return {
    data: computed(() => active.value && enabled.value && owner.value === context.value ? resource.data.value : null),
    pending: resource.pending,
    error: computed(() => failure.value.context === context.value ? failure.value.message : ''),
    refresh,
    // Used only by a current, guarded mutation response from the same view.
    accept: (value: T) => { owner.value = context.value; resource.data.value = value; },
  };
};
