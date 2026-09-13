/**
 * Geometry for the monthly-favourites vine.
 *
 * The leaf length is the only mark that encodes a month's play volume, so the
 * busiest month must own the strictly longest leaf. A song title therefore never
 * decides the ordering: it only raises *its own* leaf to the width that title
 * needs to stay readable, and never past the busiest month.
 *
 * Everything here is computed analytically: no canvas, no client-only measuring,
 * so the server render and the hydrated client render agree and the leaves never
 * shift after hydration. Estimates use the widest font and the widest text insets
 * the stylesheet can apply, which keeps them valid on every viewport.
 */

export type MonthlyLeafFontSpec = { max: number; css: string };

type LeafMetrics = { minWidth: number; maxWidth: number; insets: number; peakBonus: number };

export const monthlyLeafMetrics = (compact: boolean): LeafMetrics => compact
  ? { minWidth: 88, maxWidth: 224, insets: 39, peakBonus: 12 }
  : { minWidth: 98, maxWidth: 260, insets: 46, peakBonus: 12 };

/** Font tier for one title; measuring and rendering share the same tier. */
export const monthlyLeafFontSpec = (nameLength: number, compact: boolean): MonthlyLeafFontSpec => {
  if (compact) {
    if (nameLength > 16) return { max: 8, css: "clamp(7px, 1.8vw, 8px)" };
    if (nameLength > 11) return { max: 9, css: "clamp(8px, 2vw, 9px)" };
    if (nameLength > 7) return { max: 10.5, css: "clamp(9px, 2.3vw, 10.5px)" };
    return { max: 12, css: "clamp(10px, 2.6vw, 12px)" };
  }
  if (nameLength > 20) return { max: 9, css: "clamp(8px, 1.9vw, 9px)" };
  if (nameLength > 13) return { max: 10.5, css: "clamp(9px, 2.2vw, 10.5px)" };
  if (nameLength > 8) return { max: 12, css: "clamp(10.5px, 2.6vw, 12px)" };
  return { max: 14, css: "clamp(12px, 3vw, 14px)" };
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

/**
 * Leaf widths in input order.
 *
 * 1. each leaf starts at its data width (metric / busiest metric),
 * 2. never below the width its own title needs to stay readable,
 * 3. never past `maxWidth`, so a quiet month with an over-long title cannot grow
 *    beyond the busiest month,
 * 4. and when such a title does saturate the cap, the busiest month is pushed
 *    `peakBonus` past it so it still reads as the longest leaf.
 */
export const monthlyLeafWidths = (items: MonthlyLeafWidthInput[], compact: boolean): number[] => {
  if (!items.length) return [];
  const { minWidth, maxWidth, insets, peakBonus } = monthlyLeafMetrics(compact);
  const metrics = items.map((item) => (Number.isFinite(Number(item.metric)) ? Math.max(0, Number(item.metric)) : 0));
  const peakMetric = Math.max(...metrics);
  if (!(peakMetric > 0)) return items.map(() => minWidth);

  const widths = items.map((item, index) => {
    const dataWidth = Math.round(minWidth + (maxWidth - minWidth) * (metrics[index] / peakMetric));
    const font = monthlyLeafFontSpec([...String(item.name || "")].length, compact);
    const readableWidth = Math.round(estimateMonthlyLeafNameWidth(item.name, font.max) + insets);
    return Math.min(maxWidth, Math.max(dataWidth, readableWidth));
  });

  const peak = metrics.indexOf(peakMetric);
  const longest = Math.max(...widths);
  if (widths.filter((width) => width === longest).length > 1) {
    widths[peak] = Math.min(maxWidth + peakBonus, longest + peakBonus);
  }
  return widths;
};
