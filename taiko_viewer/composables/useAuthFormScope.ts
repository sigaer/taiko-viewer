// Auth/session refresh deliberately changes accountUser. Keep view ownership
// separate, so a later navigation cannot consume another view's completion.
export const useAuthFormScope = (reset: () => void) => {
  const accountGuard = useAccountRequestGuard(false);
  let view = 0;
  let active = true;
  onDeactivated(() => { active = false; view++; accountGuard.invalidate(); reset(); });
  onActivated(() => { active = true; });
  onBeforeUnmount(() => { active = false; view++; accountGuard.invalidate(); });
  return {
    capture: () => ({view, account: accountGuard.capture()}),
    current: (ticket: {view: number; account: number}) => active && ticket.view === view && accountGuard.current(ticket.account),
    currentView: (ticket: {view: number}) => active && ticket.view === view,
  };
};
