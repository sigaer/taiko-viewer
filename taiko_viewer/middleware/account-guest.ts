export default defineNuxtRouteMiddleware(async () => {
  const { isAuthenticated } = useAccountAuthStatus();
  const localePath = useLocalePath();
  const authenticated = await isAuthenticated();
  if (authenticated) {
    return navigateTo(localePath("/account/profile"));
  }
});
