/**
 * Geometry for the monthly-favourites vine.
 *
 * The vine reads as data: every leaf starts at the same floor, the floor is the
 * width the *longest* song title needs, and the remaining room is handed out in
 * proportion to the month's play volume, with the busiest month pulled a little
 * further than the rest.
 *
 *   floor   = max over months of (title width at its own font size + text insets)
 *   width_i = floor + (usable - floor) * plays_i / busiest plays
 *   width_busiest = usable + peakBonus
 *
 * Because the floor is derived from the tallest title, no title is ever clipped
 * and the 《》 brackets stay inside the leaf; because the room above the floor is
 * proportional, no month can look longer than a month with more plays.
 *
 * Everything is computed analytically — no canvas, no client-only measuring — so
 * server and client render identically and the leaves never shift after
 * hydration. Font sizes are fitted against the narrowest supported column, so a
 * narrower phone only shrinks the leaves (proportionally) and never clips text.
 */

export type MonthlyLeafLayout = { width: number; fontPx: number };

type LeafMetrics = {
  minWidth: number;
  maxWidth: number;
  insets: number;
  peakBonus: number;
  /** Text room available in the narrowest supported column, used to fit fonts. */
  narrowTextRoom: number;
  fontLadder: number[];
};

/** Font ladder, largest first; the per-length cap decides how far down an item may start. */
const FONT_LADDER = [14, 12.5, 11, 10, 9, 8.5, 8, 7.5, 7, 6.5, 6];

export const monthlyLeafMetrics = (compact: boolean): LeafMetrics => compact
  ? { minWidth: 88, maxWidth: 280, insets: 39, peakBonus: 16, narrowTextRoom: 201, fontLadder: FONT_LADDER }
  : { minWidth: 98, maxWidth: 272, insets: 46, peakBonus: 16, narrowTextRoom: 185, fontLadder: FONT_LADDER };

/** Largest font a title of this length may use before the fit search steps down. */
export const monthlyLeafFontCap = (nameLength: number, compact: boolean) => {
  if (compact) {
    if (nameLength > 16) return 8;
    if (nameLength > 11) return 9;
    if (nameLength > 7) return 10.5;
    return 12;
  }
  if (nameLength > 20) return 9;
  if (nameLength > 13) return 10.5;
  if (nameLength > 8) return 12;
  return 14;
};

/** Rendered width of `《title》` at a given font size (full-width glyphs 1em, latin 0.8em). */
export const estimateMonthlyLeafNameWidth = (name: string, fontPx: number) => {
  let width = fontPx * 2;
  for (const character of String(name || "")) {
    width += (character.codePointAt(0) ?? 0) > 0xff ? fontPx : fontPx * 0.8;
  }
  return width;
};

export type MonthlyLeafWidthInput = { name: string; metric: number };

/** Font size for one title: the largest ladder step that fits, capped by title length. */
export const monthlyLeafFontPx = (name: string, compact: boolean) => {
  const { narrowTextRoom, fontLadder } = monthlyLeafMetrics(compact);
  const cap = monthlyLeafFontCap([...String(name || "")].length, compact);
  const usable = fontLadder.filter((size) => size <= cap);
  for (const size of usable) {
    if (estimateMonthlyLeafNameWidth(name, size) <= narrowTextRoom) return size;
  }
  return usable.length ? usable[usable.length - 1] : fontLadder[fontLadder.length - 1];
};

/**
 * Leaf width and font size per item, in input order. The busiest month — the one
 * the page footer names — always owns the strictly longest leaf.
 */
export const monthlyLeafLayout = (items: MonthlyLeafWidthInput[], compact: boolean): MonthlyLeafLayout[] => {
  if (!items.length) return [];
  const { minWidth, maxWidth, insets, peakBonus } = monthlyLeafMetrics(compact);
  const metrics = items.map((item) => (Number.isFinite(Number(item.metric)) ? Math.max(0, Number(item.metric)) : 0));
  const peakMetric = Math.max(...metrics);

  const fonts = items.map((item) => monthlyLeafFontPx(item.name, compact));
  const titleWidths = items.map((item, index) => Math.round(estimateMonthlyLeafNameWidth(item.name, fonts[index]) + insets));
  const floor = Math.min(maxWidth - peakBonus, Math.max(minWidth, ...titleWidths));

  if (!(peakMetric > 0)) return items.map((item, index) => ({ width: floor, fontPx: fonts[index] }));

  const usable = maxWidth - peakBonus;
  const room = Math.max(0, usable - floor);
  const peak = metrics.indexOf(peakMetric);
  return items.map((item, index) => ({
    width: index === peak ? maxWidth : Math.round(floor + room * (metrics[index] / peakMetric)),
    fontPx: fonts[index]
  }));
};
