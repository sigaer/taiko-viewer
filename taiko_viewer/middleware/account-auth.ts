export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated } = useAccountAuthStatus();
  const localePath = useLocalePath();
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return navigateTo({ path: localePath("/account/login"), query: { redirect: to.fullPath } });
  }
});
