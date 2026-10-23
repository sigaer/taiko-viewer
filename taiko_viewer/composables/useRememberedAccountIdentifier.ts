import { loadRememberedAccountIdentifier, saveRememberedAccountIdentifier } from "~/utils/rememberedAccountIdentifier";

export const useRememberedAccountIdentifier = () => {
  const load = () => {
    if (import.meta.client) {
      try { return loadRememberedAccountIdentifier(localStorage); } catch { /* Storage may be unavailable. */ }
    }
    return { enabled: false, identifier: "" };
  };
  const save = (identifier: string, enabled: boolean) => {
    if (import.meta.client) {
      try { saveRememberedAccountIdentifier(localStorage, identifier, enabled); } catch { /* Remembering is optional. */ }
    }
  };
  return { loadRememberedIdentifier: load, saveRememberedIdentifier: save };
};
