import type { GrowthObservation } from "../growth-history/evidence.ts";

const GROWTH_RECENT_ALGORITHM_VERSION = "recent-observation-v1";
type BoundaryCursor = { token: string; algorithmVersion: string };
const NON_BARRIER_EXCLUSIONS = new Set(["dispatcher-transfer"]);

export type RecentObservationWindow = {
  current: GrowthObservation | null;
  selected: GrowthObservation[];
  recovered: boolean;
  acknowledgeRequired: boolean;
};

export function recentEligibleObservations(observations: GrowthObservation[]) {
  let boundary = -1;
  observations.forEach((item, index) => {
    if (item.evidenceLevel === "L0" && item.excludedReason && !NON_BARRIER_EXCLUSIONS.has(item.excludedReason)) boundary = index;
  });
  return observations.slice(boundary + 1).filter(item => item.evidenceLevel === "L1");
}

export function selectRecentObservationWindow(observations: GrowthObservation[], cursor: BoundaryCursor | null): RecentObservationWindow {
  const eligible = recentEligibleObservations(observations);
  const current = eligible.at(-1) || null;
  if (!current) return { current: null, selected: [], recovered: false, acknowledgeRequired: false };
  const cursorIndex = cursor?.algorithmVersion === GROWTH_RECENT_ALGORITHM_VERSION
    ? eligible.findIndex(item => item.token === cursor.token)
    : -1;
  const recovered = Boolean(cursor && cursorIndex < 0);
  return {
    current,
    selected: !cursor || recovered ? [current] : eligible.slice(cursorIndex + 1),
    recovered,
    acknowledgeRequired: cursor?.token !== current.token
  };
}
