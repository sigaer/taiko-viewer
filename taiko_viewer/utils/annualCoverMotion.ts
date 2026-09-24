export const COVER_CYCLE_MS = 36_000;
export const COVER_SLOTS_PER_ZONE = 6;
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

// Both sides of the wrap are invisible. The slot can teleport only while hidden.
export const coverMotion = (elapsed: number, slot: number, upper: boolean) => {
  const phase = ((elapsed / COVER_CYCLE_MS + slot / COVER_SLOTS_PER_ZONE) % 1 + 1) % 1;
  const travel = Math.min(1, phase * 2);
  return {
    travel: upper ? travel : 1 - travel,
    opacity: phase >= .5 ? 0 : .94 * smooth(travel / .14) * smooth((1 - travel) / .16)
  };
};
export const coverRotation = (time: number) => {
  const p = Math.max(0, Math.min(1, (time - 80) / 900));
  const eased = p < .5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
  return eased * Math.PI / 4;
};
export type AnnualCoverState = { transitionTime: number; elapsed: number };

// World Y points upward (opposite to CSS Y): both planes face the camera,
// rather than turning edge-on/backwards as they approach the outer edge.
export const coverPitch = (upper: boolean) => (upper ? 1 : -1) * Math.PI * .36;
