// Response ownership for account pages; accepted server operations are not undone.
export const useAccountPageScope = (reset: () => void, includeBinding = false, resume?: () => void) => {
  const { accountUser } = useAccountState();
  const bindingGeneration = useState("account-binding-generation", () => 0);
  const guard = useAccountRequestGuard(includeBinding);
  let active = true;
  let needsResume = false;
  watch([() => accountUser.value?.id, () => includeBinding ? bindingGeneration.value : null], reset, { flush: "sync" });
  onDeactivated(() => { active = false; needsResume = true; guard.invalidate(); reset(); });
  onActivated(() => { active = true; if (needsResume) { needsResume = false; resume?.(); } });
  onBeforeUnmount(() => { active = false; guard.invalidate(); });
  return { capture: guard.capture, current: (ticket: number) => active && guard.current(ticket), invalidate: guard.invalidate };
};
