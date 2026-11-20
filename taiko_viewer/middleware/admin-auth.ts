export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated } = useAdminAuthStatus();
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return navigateTo("/admin/taiko/login");
  }
  if (/^\/admin\/taiko\/(?:annual-beta|annual-summaries)(?:\/|$)/.test(to.path)) {
    return navigateTo('/admin/taiko/dashboard', { replace: true });
  }
});
