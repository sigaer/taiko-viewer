import type { AccountAuthUser } from "~/composables/useAccountAuthStatus";

export type AccountSummary = AccountAuthUser;

export const useAccountState = () => {
  const {
    accountUser,
    accountLoaded,
    resolveAccountUser,
    clearResolvedAccountUser
  } = useAccountAuthStatus();

  const fetchCurrentUser = async (force = false) => {
    return resolveAccountUser(force);
  };

  const clearAccountUser = () => {
    clearResolvedAccountUser();
  };

  return {
    accountUser,
    accountLoaded,
    accountAuthError,
    fetchCurrentUser,
    clearAccountUser
  };
};
