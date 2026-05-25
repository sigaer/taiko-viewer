export default defineNuxtRouteMiddleware(async () => {
  const { fetchCurrentUser } = useAccountState();
  const localePath = useLocalePath();
  const user = await fetchCurrentUser();
  if (!user) {
    return navigateTo(localePath("/account/login"));
  }
});
