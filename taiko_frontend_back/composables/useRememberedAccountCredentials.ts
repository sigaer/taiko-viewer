const ACCOUNT_REMEMBER_KEY = "taiko-account-remember";
const ACCOUNT_IDENTIFIER_KEY = "taiko-account-identifier";
const ACCOUNT_PASSWORD_KEY = "taiko-account-password";

export const useRememberedAccountCredentials = () => {
  const loadRememberedCredentials = () => {
    if (import.meta.server) {
      return {
        enabled: false,
        identifier: "",
        password: "",
      };
    }
    return {
      enabled: localStorage.getItem(ACCOUNT_REMEMBER_KEY) === "1",
      identifier: localStorage.getItem(ACCOUNT_IDENTIFIER_KEY) || "",
      password: localStorage.getItem(ACCOUNT_PASSWORD_KEY) || "",
    };
  };

  const saveRememberedCredentials = (
    identifier: string,
    password: string,
    enabled = true,
  ) => {
    if (import.meta.server) return;
    if (!enabled) {
      clearRememberedCredentials();
      return;
    }
    localStorage.setItem(ACCOUNT_REMEMBER_KEY, "1");
    localStorage.setItem(ACCOUNT_IDENTIFIER_KEY, identifier);
    localStorage.setItem(ACCOUNT_PASSWORD_KEY, password);
  };

  const clearRememberedCredentials = () => {
    if (import.meta.server) return;
    localStorage.removeItem(ACCOUNT_REMEMBER_KEY);
    localStorage.removeItem(ACCOUNT_IDENTIFIER_KEY);
    localStorage.removeItem(ACCOUNT_PASSWORD_KEY);
  };

  return {
    loadRememberedCredentials,
    saveRememberedCredentials,
    clearRememberedCredentials,
  };
};
