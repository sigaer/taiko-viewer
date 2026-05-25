export type AccountAuthUser = {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
  avatarUrl: string;
  createdAt: string;
};

type AccountAuthPayload = {
  authenticated: boolean;
  user: AccountAuthUser | null;
};

export const useAccountAuthStatus = () => {
  const accountUser = useState<AccountAuthUser | null>("account-user", () => null);
  const accountLoaded = useState<boolean>("account-user-loaded", () => false);
  const requestHeaders = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

  const fetchAccountAuthPayload = async () =>
    $fetch<AccountAuthPayload>("/api/account/auth/me", {
      headers: requestHeaders
    });

  const resolveAccountUser = async (force = false) => {
    if (accountLoaded.value && !force) {
      return accountUser.value;
    }

    try {
      const data = await fetchAccountAuthPayload();
      accountUser.value = data.user;
    } catch {
      accountUser.value = null;
    } finally {
      accountLoaded.value = true;
    }

    return accountUser.value;
  };

  const isAuthenticated = async (force = false) => Boolean(await resolveAccountUser(force));

  const clearResolvedAccountUser = () => {
    accountUser.value = null;
    accountLoaded.value = true;
  };

  return {
    accountUser,
    accountLoaded,
    resolveAccountUser,
    isAuthenticated,
    clearResolvedAccountUser
  };
};
