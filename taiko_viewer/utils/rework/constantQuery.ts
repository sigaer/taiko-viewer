// Constants range filter: one contract for GET /api/content/v2-constants (dimension, min, max), the /songs/constants
// URL query and the search panel's range queries ("定数 10-10.5", "手速 11+", "爆发>=12", "体力 <8").
// Pure functions only: used by the server service, pages, components and node tests alike.
import type { V2ConstantsDimension, V2ConstantsRange } from "../../types/content";

export const CONSTANTS_PATH = "/songs/constants";
export const CONSTANT_DIMENSIONS: readonly V2ConstantsDimension[] = [
  "mainConstant",
  "subConstant1",
  "subConstant2",
  "stamina",
  "handspeed",
  "burst",
  "complex",
  "rhythm"
];
export const DEFAULT_DIMENSION: V2ConstantsDimension = "mainConstant";
/** Bounds are clamped to this interval (every value column uses a 0–15.5 scale). */
export const RANGE_LIMIT = { min: 0, max: 20 } as const;

type QueryValue = string | null | undefined | (string | null)[];
const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

export const isConstantDimension = (value: unknown): value is V2ConstantsDimension =>
  CONSTANT_DIMENSIONS.includes(value as V2ConstantsDimension);

/** A bound from a query value or an input: finite number, clamped to RANGE_LIMIT; anything else is null. */
export function parseRangeBound(value: unknown): number | null {
  const raw = first(value);
  if (typeof raw === "number") return Number.isFinite(raw) ? clamp(raw) : null;
  if (typeof raw !== "string") return null;
  const text = raw.normalize("NFKC").trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? clamp(parsed) : null;
}
const clamp = (value: number) => Math.min(RANGE_LIMIT.max, Math.max(RANGE_LIMIT.min, value));

/**
 * Effective range: null unless a valid bound is given. An unknown dimension falls back to the default; reversed
 * bounds are swapped. Invalid values are ignored, never an error.
 */
export function normalizeConstantRange(input: { dimension?: unknown; min?: unknown; max?: unknown }): V2ConstantsRange | null {
  let min = parseRangeBound(input.min);
  let max = parseRangeBound(input.max);
  if (min === null && max === null) return null;
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  const dimension = first(input.dimension);
  return { dimension: isConstantDimension(dimension) ? dimension : DEFAULT_DIMENSION, min, max };
}

export const constantRangeFromQuery = (query: Record<string, QueryValue | unknown>) =>
  normalizeConstantRange({ dimension: query.dimension, min: query.min, max: query.max });

export const formatBound = (value: number) => String(Number(value.toFixed(4)));

/** URL / API query for a range: dimension omitted when it is the default, bounds only when set. */
export function constantRangeQuery(range: V2ConstantsRange | null): Record<string, string> {
  if (!range || (range.min === null && range.max === null)) return {};
  const out: Record<string, string> = {};
  if (range.dimension !== DEFAULT_DIMENSION) out.dimension = range.dimension;
  if (range.min !== null) out.min = formatBound(range.min);
  if (range.max !== null) out.max = formatBound(range.max);
  return out;
}

export const sameConstantRange = (a: V2ConstantsRange | null, b: V2ConstantsRange | null) =>
  JSON.stringify(constantRangeQuery(a)) === JSON.stringify(constantRangeQuery(b));

export const constantsLocation = (range: V2ConstantsRange | null) => ({ path: CONSTANTS_PATH, query: constantRangeQuery(range) });

/** Rows whose value for the dimension lies within the inclusive bounds; rows without a finite value are dropped. */
export function filterByConstantRange<T extends Partial<Record<V2ConstantsDimension, unknown>>>(
  rows: readonly T[],
  range: V2ConstantsRange | null
): T[] {
  if (!range) return [...rows];
  return rows.filter((row) => {
    const value = row[range.dimension];
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
    return (range.min === null || value >= range.min) && (range.max === null || value <= range.max);
  });
}

// ---------- Search panel range queries ----------
/**
 * Words the parser understands besides numbers and ASCII operators. The Chinese and Japanese words live in the locale
 * files (`rework.constantRange.words.*`, comma separated; see constantQueryVocabulary) so both languages' column names
 * and operator words come from one place; the defaults here are the English words only.
 */
export type ConstantQueryVocabulary = {
  words: Partial<Record<V2ConstantsDimension, readonly string[]>>;
  /** between two numbers, besides "-" and "~" */
  to: readonly string[];
  /** after a number: at least / at most, besides "+" */
  atLeast: readonly string[];
  atMost: readonly string[];
};
export const DEFAULT_VOCABULARY: ConstantQueryVocabulary = {
  words: {
    mainConstant: ["constant", "const"],
    stamina: ["stamina"],
    handspeed: ["handspeed"],
    burst: ["burst"],
    complex: ["complex"],
    rhythm: ["rhythm"]
  },
  to: [],
  atLeast: [],
  atMost: []
};

const termList = (text: unknown) =>
  String(text ?? "")
    .split(",")
    .map(normalizeQueryText)
    .filter(Boolean);

/** Vocabulary from the locale files (the page's `t`), merged with the English defaults. */
export function constantQueryVocabulary(t: (key: string) => string): ConstantQueryVocabulary {
  const localeWords: Record<V2ConstantsDimension, string> = {
    mainConstant: t("rework.constantRange.words.mainConstant"),
    subConstant1: t("rework.constantRange.words.subConstant1"),
    subConstant2: t("rework.constantRange.words.subConstant2"),
    stamina: t("rework.constantRange.words.stamina"),
    handspeed: t("rework.constantRange.words.handspeed"),
    burst: t("rework.constantRange.words.burst"),
    complex: t("rework.constantRange.words.complex"),
    rhythm: t("rework.constantRange.words.rhythm")
  };
  const words: Partial<Record<V2ConstantsDimension, string[]>> = {};
  for (const dimension of CONSTANT_DIMENSIONS) {
    words[dimension] = [...(DEFAULT_VOCABULARY.words[dimension] ?? []), ...termList(localeWords[dimension])];
  }
  return {
    words,
    to: termList(t("rework.constantRange.words.to")),
    atLeast: termList(t("rework.constantRange.words.atLeast")),
    atMost: termList(t("rework.constantRange.words.atMost"))
  };
}

/** NFKC, lower case, no spaces, one form for wave dashes and comparison signs. */
function normalizeQueryText(text: unknown) {
  return String(text ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, "")
    .replace(/[〜～–—−]/g, "~")
    .replace(/[≥≧⩾]/g, ">=")
    .replace(/[≤≦⩽]/g, "<=");
}

const NUMBER = String.raw`(\d+(?:\.\d+)?|\.\d+)`;
const escapeTerm = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alternatives = (terms: readonly string[]) => terms.map(escapeTerm).join("|");
const inLimit = (value: number) => value >= RANGE_LIMIT.min && value <= RANGE_LIMIT.max;

/**
 * A search query that asks for a range of one value column, or null. It needs a range operator (a-b, a~b, a+,
 * >=a, <a, or a vocabulary word such as "以上"); a dimension word in front is optional and defaults to the main
 * constant. Plain numbers ("2000", "<dimension> 10") are not ranges, so ordinary song searches are never taken over.
 * `>` and `<` are read as inclusive bounds. Numbers outside the value scale make it not a range.
 */
export function parseConstantQuery(text: string, vocabulary: ConstantQueryVocabulary = DEFAULT_VOCABULARY): V2ConstantsRange | null {
  let rest = normalizeQueryText(text);
  if (!rest || rest.length > 40) return null;
  let dimension: V2ConstantsDimension = DEFAULT_DIMENSION;
  const word = CONSTANT_DIMENSIONS.flatMap((key) => (vocabulary.words[key] ?? []).map((term) => [normalizeQueryText(term), key] as const))
    .filter(([term]) => term && rest.startsWith(term))
    .sort((a, b) => b[0].length - a[0].length)[0];
  if (word) {
    dimension = word[1];
    rest = rest.slice(word[0].length).replace(/^:/, "");
  }
  const to = alternatives(["~", "-", ...vocabulary.to.map(normalizeQueryText)]);
  const atLeast = alternatives(["+", ...vocabulary.atLeast.map(normalizeQueryText)]);
  const atMost = vocabulary.atMost.length ? alternatives(vocabulary.atMost.map(normalizeQueryText)) : "";
  let min: number | null = null;
  let max: number | null = null;
  let match: RegExpMatchArray | null;
  if ((match = rest.match(new RegExp(`^${NUMBER}(?:${to})${NUMBER}$`)))) {
    min = Number(match[1]);
    max = Number(match[2]);
    if (min > max) [min, max] = [max, min];
  } else if ((match = rest.match(new RegExp(`^${NUMBER}(?:${atLeast})$`)) || rest.match(new RegExp(`^(?:>=|=>|>)${NUMBER}$`)))) {
    min = Number(match[1]);
  } else if (
    (match = (atMost ? rest.match(new RegExp(`^${NUMBER}(?:${atMost})$`)) : null) || rest.match(new RegExp(`^(?:<=|=<|<)${NUMBER}$`)))
  ) {
    max = Number(match[1]);
  } else {
    return null;
  }
  if ((min !== null && !inLimit(min)) || (max !== null && !inLimit(max))) return null;
  return { dimension, min, max };
}

/** Column names for each dimension (static keys, shared with the constants table's column headers). */
export const CONSTANT_COLUMN_KEYS: Readonly<Record<V2ConstantsDimension, string>> = {
  mainConstant: "page.songs.v2Constants.columns.mainConstant",
  subConstant1: "page.songs.v2Constants.columns.subConstant1",
  subConstant2: "page.songs.v2Constants.columns.subConstant2",
  stamina: "page.songs.v2Constants.columns.stamina",
  handspeed: "page.songs.v2Constants.columns.handspeed",
  burst: "page.songs.v2Constants.columns.burst",
  complex: "page.songs.v2Constants.columns.complex",
  rhythm: "page.songs.v2Constants.columns.rhythm"
};

/** Locale key and parameters for a range's short text ("95% 定数 10–10.5", "手速 ≥ 11", "体力 ≤ 8"). */
export function constantRangeText(range: V2ConstantsRange) {
  const min = range.min === null ? "" : formatBound(range.min);
  const max = range.max === null ? "" : formatBound(range.max);
  const key =
    range.min !== null && range.max !== null
      ? "rework.constantRange.between"
      : range.min !== null
        ? "rework.constantRange.atLeast"
        : "rework.constantRange.atMost";
  return { key, columnKey: CONSTANT_COLUMN_KEYS[range.dimension], min, max };
}
