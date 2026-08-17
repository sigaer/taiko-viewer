export const isUsableMetric = (value: unknown): value is number => {
  if (value === null || value === undefined || value === "") return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
};

export const hasUsableText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const segmentAnnualTitle = (value: string): string[] => {
  if (!value) return [];
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const Segmenter = (Intl as typeof Intl & { Segmenter: new (locale?: string, options?: { granularity: string }) => { segment: (input: string) => Iterable<{ segment: string }> } }).Segmenter;
    return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(value), (part) => part.segment);
  }
  return Array.from(value);
};
