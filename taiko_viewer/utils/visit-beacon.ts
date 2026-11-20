// Pure logic for plugins/visit-beacon.client.ts (unit-tested without a browser).

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Beijing calendar day key, same bucketing as the admin dashboard. */
export const visitDayKey = (now: number = Date.now()) => new Date(now + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);

export const VISIT_QUALIFY_VISIBLE_MS = 5000;

/**
 * Tracks cumulative visible time; a visit qualifies after 5 s visible or on the
 * first interaction, whichever comes first.
 */
export const createVisitQualifier = (options: { visibleMs?: number; visible?: boolean; now?: number } = {}) => {
  const threshold = options.visibleMs ?? VISIT_QUALIFY_VISIBLE_MS;
  let accumulated = 0;
  let visibleSince: number | null = options.visible === false ? null : options.now ?? 0;
  let interacted = false;
  const visibleTotal = (now: number) => accumulated + (visibleSince === null ? 0 : Math.max(0, now - visibleSince));
  return {
    setVisible(visible: boolean, now: number) {
      if (visible && visibleSince === null) visibleSince = now;
      if (!visible && visibleSince !== null) {
        accumulated += Math.max(0, now - visibleSince);
        visibleSince = null;
      }
    },
    interact() {
      interacted = true;
    },
    isQualified(now: number) {
      return interacted || visibleTotal(now) >= threshold;
    },
    /** ms of visible time still needed, or null while hidden. */
    remainingMs(now: number) {
      if (visibleSince === null) return null;
      return Math.max(0, threshold - visibleTotal(now));
    }
  };
};

/**
 * Once per device per Beijing day, plus one re-send the same day when the
 * device goes from anonymous to logged in. Stored marker: "YYYY-MM-DD" or
 * "YYYY-MM-DD:u" (sent while logged in).
 */
export const decideVisitSend = (lastSent: string | null | undefined, today: string, loggedIn: boolean) => {
  const [day, flag] = String(lastSent || "").split(":");
  if (day !== today) return { send: true, marker: loggedIn ? `${today}:u` : today };
  if (loggedIn && flag !== "u") return { send: true, marker: `${today}:u` };
  return { send: false, marker: String(lastSent) };
};
