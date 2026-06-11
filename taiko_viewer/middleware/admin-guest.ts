export default defineNuxtRouteMiddleware(async () => {
  const { isAuthenticated } = useAdminAuthStatus();
  const authenticated = await isAuthenticated();
  if (authenticated) {
    return navigateTo("/admin/taiko/dashboard");
  }
});
