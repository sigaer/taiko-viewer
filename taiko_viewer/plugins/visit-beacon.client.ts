import { createVisitQualifier, decideVisitSend, visitDayKey } from "~/utils/visit-beacon";

// Counts one qualified visit per device per Beijing day for the admin DAU.
// No UI; every step is guarded so it can never throw into the app.
const DEVICE_KEY = "tv_device_id";
const DAY_KEY = "tv_visit_day";
const ENDPOINT = "/api/metrics/visit";

let memoryDeviceId = "";
let memoryDay: string | null = null;

const storages = () => {
  const list: Storage[] = [];
  try { if (window.localStorage) list.push(window.localStorage); } catch { /* blocked */ }
  try { if (window.sessionStorage) list.push(window.sessionStorage); } catch { /* blocked */ }
  return list;
};

const readValue = (key: string) => {
  for (const storage of storages()) {
    try {
      const value = storage.getItem(key);
      if (value !== null) return value;
    } catch { /* try next */ }
  }
  return null;
};

const writeValue = (key: string, value: string) => {
  for (const storage of storages()) {
    try {
      storage.setItem(key, value);
      return true;
    } catch { /* try next */ }
  }
  return false;
};

const newId = () => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch { /* fall through */ }
  return "";
};

const deviceId = () => {
  const stored = readValue(DEVICE_KEY);
  if (stored) return stored;
  if (!memoryDeviceId) memoryDeviceId = newId();
  if (memoryDeviceId) writeValue(DEVICE_KEY, memoryDeviceId);
  return memoryDeviceId;
};

const post = (id: string) => {
  const body = JSON.stringify({ d: id });
  try {
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
  } catch { /* fall back */ }
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      body,
      keepalive: true,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" }
    }).catch(() => undefined);
  } catch { /* give up silently */ }
};

export default defineNuxtPlugin((nuxtApp) => {
  try {
    if (navigator.webdriver === true) return;
    const router = useRouter();
    const isAdmin = () => {
      try { return router.currentRoute.value.path.startsWith("/admin"); } catch { return false; }
    };
    const { accountUser } = useAccountAuthStatus();
    const loggedIn = () => Boolean(accountUser.value?.id);

    const qualifier = createVisitQualifier({ visible: document.visibilityState === "visible", now: performance.now() });
    let qualified = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const trySend = () => {
      try {
        if (!qualified || isAdmin()) return;
        const today = visitDayKey();
        const last = readValue(DAY_KEY) ?? memoryDay;
        const decision = decideVisitSend(last, today, loggedIn());
        if (!decision.send) return;
        const id = deviceId();
        if (!id) return;
        memoryDay = decision.marker;
        writeValue(DAY_KEY, decision.marker);
        post(id);
      } catch { /* never throw */ }
    };

    const qualify = () => {
      if (qualified) return;
      qualified = true;
      cleanup();
      trySend();
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      const remaining = qualifier.remainingMs(performance.now());
      if (remaining === null) return;
      timer = setTimeout(() => {
        if (qualifier.isQualified(performance.now())) qualify();
        else schedule();
      }, remaining + 50);
    };

    const onVisibility = () => {
      qualifier.setVisible(document.visibilityState === "visible", performance.now());
      if (qualifier.isQualified(performance.now())) qualify();
      else schedule();
    };
    const onInteract = () => {
      qualifier.interact();
      qualify();
    };
    const interactionEvents = ["pointerdown", "keydown", "scroll"] as const;
    function cleanup() {
      if (timer) clearTimeout(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisibility);
      for (const name of interactionEvents) window.removeEventListener(name, onInteract, true);
    }

    document.addEventListener("visibilitychange", onVisibility);
    for (const name of interactionEvents) window.addEventListener(name, onInteract, { capture: true, passive: true });
    schedule();

    // Anonymous -> logged in on the same day: re-send once so the device is attributed.
    watch(() => accountUser.value?.id, (id, previous) => {
      if (id && !previous) trySend();
    });
    // Visits that qualified on an admin route are sent after leaving it.
    nuxtApp.hook("page:finish", () => trySend());
  } catch {
    // Never throw into the app.
  }
});
