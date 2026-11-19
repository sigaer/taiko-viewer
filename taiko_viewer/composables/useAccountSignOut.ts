// Signing out, shared by the account menu of the shell and the profile page (slice G). The request and the steps are
// the ones of the former sidebar (SidebarNav.vue handleLogout, removed in slice G): POST /api/account/auth/logout,
// clear the account state the app holds, go to the sign-in page. A failure is ignored, as it was there.
export function useAccountSignOut() {
  const apiFetch = useViewerApiFetch();
  const { clearAccountUser } = useAccountState();
  const localePath = useLocalePath();
  const signingOut = useState("account-signing-out", () => false);
  const signOut = async () => {
    if (signingOut.value) return;
    signingOut.value = true;
    try {
      await apiFetch("/api/account/auth/logout", { method: "POST" });
      clearAccountUser();
      await navigateTo(localePath("/account/login"));
    } catch {
      // Ignored, as in the former sidebar shortcut.
    } finally {
      signingOut.value = false;
    }
  };
  return { signingOut, signOut };
}
