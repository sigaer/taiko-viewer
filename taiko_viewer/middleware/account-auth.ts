export default defineNuxtRouteMiddleware(async () => {
  const { isAuthenticated } = useAccountAuthStatus();
  const localePath = useLocalePath();
  const route = useRoute();
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return navigateTo({ path: localePath("/account/login"), query: { redirect: route.fullPath } });
  }
});
