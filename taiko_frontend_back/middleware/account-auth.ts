export default defineNuxtRouteMiddleware(async () => {
  const { fetchCurrentUser } = useAccountState();
  const user = await fetchCurrentUser();
  if (!user) {
    return navigateTo("/account/login");
  }
});
