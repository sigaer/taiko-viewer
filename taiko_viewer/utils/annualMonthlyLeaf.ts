/**
 * Geometry for the monthly-favourites vine.
 *
 * The leaf length is the only mark that encodes a month's play volume, so the
 * song title must never decide which leaf looks longest. A title therefore only
 * raises its own *readable minimum*, and the final widths are forced to stay
 * monotone in the metric, with the busiest month kept strictly longest.
 *
 * Everything here is computed analytically: no canvas, no client-only measuring,
 * so the server render and the hydrated client render agree and the leaves never
 * shift after hydration.
 */

export type MonthlyLeafFontSpec = { max: number; css: string };

type LeafMetrics = { minWidth: number; maxWidth: number; padding: number; peakBonus: number };

export const monthlyLeafMetrics = (compact: boolean): LeafMetrics => compact
  ? { minWidth: 88, maxWidth: 224, padding: 34, peakBonus: 16 }
  : { minWidth: 98, maxWidth: 260, padding: 46, peakBonus: 16 };

/** Font tier for one title; the same tier is used for measuring and for rendering. */
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

/** Rendered width of `《title》` at a given font size (full-width CJK, half-width latin). */
export const estimateMonthlyLeafNameWidth = (name: string, fontPx: number) => {
  let width = fontPx * 2;
  for (const character of String(name || "")) {
    width += (character.codePointAt(0) ?? 0) > 0xff ? fontPx : fontPx * 0.58;
  }
  return width;
};

export type MonthlyLeafWidthInput = { name: string; metric: number };

/**
 * Leaf widths in input order.
 *
 * 1. each leaf starts at its data width (metric / busiest metric),
 * 2. never below the width its own title needs to stay readable,
 * 3. then a running maximum keeps the widths monotone in the metric, so a month
 *    with fewer plays can never look longer than a month with more,
 * 4. and the busiest month is pushed past the cap when a long title elsewhere
 *    saturated the widths, so it always reads as the longest leaf.
 */
export const monthlyLeafWidths = (items: MonthlyLeafWidthInput[], compact: boolean): number[] => {
  if (!items.length) return [];
  const { minWidth, maxWidth, padding, peakBonus } = monthlyLeafMetrics(compact);
  const metrics = items.map((item) => (Number.isFinite(Number(item.metric)) ? Math.max(0, Number(item.metric)) : 0));
  const peakMetric = Math.max(...metrics);
  if (!(peakMetric > 0)) return items.map(() => minWidth);

  const raw = items.map((item, index) => {
    const dataWidth = Math.round(minWidth + (maxWidth - minWidth) * (metrics[index] / peakMetric));
    const font = monthlyLeafFontSpec([...String(item.name || "")].length, compact);
    const readableWidth = Math.round(estimateMonthlyLeafNameWidth(item.name, font.max) + padding);
    return Math.min(maxWidth, Math.max(dataWidth, readableWidth));
  });

  const widths = items.map(() => minWidth);
  let running = minWidth;
  for (const index of metrics.map((_, index) => index).sort((a, b) => metrics[a] - metrics[b] || a - b)) {
    running = Math.max(running, raw[index]);
    widths[index] = running;
  }

  const peak = metrics.indexOf(peakMetric);
  const busiestOthers = Math.max(...widths.filter((_, index) => index !== peak), 0);
  if (widths[peak] <= busiestOthers) widths[peak] = Math.min(maxWidth + peakBonus, busiestOthers + peakBonus);
  return widths;
};
