export type AccountAuthUser = {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
  avatarUrl: string;
  createdAt: string;
  annualSummaryAccess: boolean;
};

type AccountAuthPayload = {
  authenticated: boolean;
  user: AccountAuthUser | null;
};

export const useAccountAuthStatus = () => {
  const accountUser = useState<AccountAuthUser | null>("account-user", () => null);
  const accountLoaded = useState<boolean>("account-user-loaded", () => false);
  const accountAuthError = useState<string | null>("account-user-error", () => null);
  const requestHeaders = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

  const fetchAccountAuthPayload = async () =>
    $fetch<AccountAuthPayload>("/api/account/auth/me", {
      headers: requestHeaders
    });

  const resolveAccountUser = async (force = false) => {
    if (accountLoaded.value && !force) {
      return accountUser.value;
    }

    accountAuthError.value = null;
    try {
      const data = await fetchAccountAuthPayload();
      accountUser.value = data.user;
    } catch (error) {
      accountUser.value = null;
      accountAuthError.value = error instanceof Error ? error.message : "登录状态获取失败";
    } finally {
      accountLoaded.value = true;
    }

    return accountUser.value;
  };

  const isAuthenticated = async (force = false) => Boolean(await resolveAccountUser(force));

  const clearResolvedAccountUser = () => {
    accountUser.value = null;
    accountLoaded.value = true;
    accountAuthError.value = null;
  };

  return {
    accountUser,
    accountLoaded,
    accountAuthError,
    resolveAccountUser,
    isAuthenticated,
    clearResolvedAccountUser
  };
};
