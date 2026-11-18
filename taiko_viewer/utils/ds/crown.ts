// The single "score counts → crown state" conversion for new design-system components (12 RK-05, B2.6).
// Order follows the crownLabel of the former components/account/AccountSongScores.vue (removed in slice G, kept as
// tests/fixtures/account-song-scores-crownlabel-original.txt): all-perfect (dondaful) > full combo > clear > played;
// no record → none.

export type DsCrownState = "dondaful" | "full" | "clear" | "played" | "none";

export const DS_CROWN_STATES: readonly DsCrownState[] = Object.freeze(["dondaful", "full", "clear", "played", "none"]);

/** The fields of AccountSongScore the conversion reads. Missing or non-numeric counts count as 0. */
export interface DsCrownCounts {
  clearCnt?: number | string | null;
  fullComboCnt?: number | string | null;
  dondafulComboCnt?: number | string | null;
}

const positive = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
};

/**
 * Crown state from a score record. `record` null/undefined means "no record" (never played).
 * A record whose three counts are all 0 is "played".
 */
export function crownFromCounts(record: DsCrownCounts | null | undefined): DsCrownState {
  if (!record) return "none";
  if (positive(record.dondafulComboCnt)) return "dondaful";
  if (positive(record.fullComboCnt)) return "full";
  if (positive(record.clearCnt)) return "clear";
  return "played";
}

/** Asset file name (without size directory or extension) under public/icons/crown/. played/none have no image. */
export function crownAssetName(state: DsCrownState): "dondaful" | "full" | "clear" | null {
  return state === "dondaful" || state === "full" || state === "clear" ? state : null;
}

/**
 * locale key for the crown state name (accessible name; the "full" visible text of D0-6).
 * Short visible names (D0-6 "short") are not specified yet; the Crown component adds `ds.crown.short.*` keys
 * once their wording is decided, rather than inventing copy here.
 */
export function crownLabelKey(state: DsCrownState): string {
  return `ds.crown.${state}`;
}

export function isDsCrownState(value: unknown): value is DsCrownState {
  return typeof value === "string" && (DS_CROWN_STATES as readonly string[]).includes(value);
}
