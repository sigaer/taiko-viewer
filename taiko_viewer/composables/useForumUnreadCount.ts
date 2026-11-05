// One account-owned count lets notification reads update navigation immediately.
export const useForumUnreadCount = () => {
  const { accountUser } = useAccountState();
  const state = useState('forum-unread-count', () => ({
    userId: accountUser.value?.id ?? null,
    count: 0,
    revision: 0
  }));

  watch(() => accountUser.value?.id ?? null, userId => {
    if (state.value.userId !== userId) {
      state.value = { userId, count: 0, revision: state.value.revision + 1 };
    }
  }, { immediate: true, flush: 'sync' });

  const setUnreadCount = (count: number) => {
    if (!accountUser.value || state.value.userId !== accountUser.value.id
      || !Number.isSafeInteger(count) || count < 0) return;
    state.value = { ...state.value, count, revision: state.value.revision + 1 };
  };

  return {
    unreadCount: computed(() => accountUser.value?.id === state.value.userId ? state.value.count : 0),
    revision: computed(() => state.value.revision),
    setUnreadCount
  };
};
