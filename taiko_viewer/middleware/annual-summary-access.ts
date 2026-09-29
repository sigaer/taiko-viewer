export default defineNuxtRouteMiddleware(async () => {
  const { fetchCurrentUser } = useAccountState();
  const localePath = useLocalePath();
  const user = await fetchCurrentUser(true);
  if (!user?.annualSummaryAccess) {
    return navigateTo(localePath("/annual"));
  }
});
