export type AccountSummary = {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
  avatarUrl: string;
  createdAt: string;
};

export const useAccountState = () => {
  const accountUser = useState<AccountSummary | null>("account-user", () => null);
  const accountLoaded = useState<boolean>("account-user-loaded", () => false);
  const apiFetch = useViewerApiFetch();

  const fetchCurrentUser = async (force = false) => {
    if (accountLoaded.value && !force) {
      return accountUser.value;
    }
    try {
      const data = await apiFetch<{ authenticated: boolean; user: AccountSummary | null }>("/api/account/auth/me");
      accountUser.value = data.user;
    } catch {
      accountUser.value = null;
    } finally {
      accountLoaded.value = true;
    }
    return accountUser.value;
  };

  const clearAccountUser = () => {
    accountUser.value = null;
    accountLoaded.value = true;
  };

  return {
    accountUser,
    accountLoaded,
    fetchCurrentUser,
    clearAccountUser
  };
};
