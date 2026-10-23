const REMEMBER_KEY = "taiko-account-remember";
const IDENTIFIER_KEY = "taiko-account-identifier";
const LEGACY_PASSWORD_KEY = "taiko-account-password";
type AccountStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// Never read the legacy value. Repeat on each application start and storage action.
export const removeLegacyAccountPassword = (storage: AccountStorage) => {
  storage.removeItem(LEGACY_PASSWORD_KEY);
};

export const loadRememberedAccountIdentifier = (storage: AccountStorage) => {
  removeLegacyAccountPassword(storage);
  const enabled = storage.getItem(REMEMBER_KEY) === "1";
  return { enabled, identifier: enabled ? storage.getItem(IDENTIFIER_KEY) || "" : "" };
};

export const saveRememberedAccountIdentifier = (storage: AccountStorage, identifier: string, enabled: boolean) => {
  removeLegacyAccountPassword(storage);
  if (enabled) {
    storage.setItem(IDENTIFIER_KEY, identifier.trim());
    storage.setItem(REMEMBER_KEY, "1");
  } else {
    storage.removeItem(REMEMBER_KEY);
    storage.removeItem(IDENTIFIER_KEY);
  }
};
