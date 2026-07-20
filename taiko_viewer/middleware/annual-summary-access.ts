export default defineNuxtRouteMiddleware(async () => {
  const { fetchCurrentUser } = useAccountState();
  const localePath = useLocalePath();
  const user = await fetchCurrentUser();
  if (!user?.annualSummaryAccess) {
    return navigateTo(localePath("/account/profile"));
  }
});
