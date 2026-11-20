// Business value → real game asset path, and draw size → 1× / 2× small-asset choice (P0-14).
// One place for new design-system components; existing components keep their own paths.
// Pure functions: no browser objects, safe in SSR and node --test.

import { normalizeDifficultyType, type DifficultyType } from "../difficulty.ts";
import { SCORE_RANK_DEFINITIONS } from "../scoreRank.ts";
import { crownAssetName, type DsCrownState } from "./crown.ts";
import { TITLE_PLATE_SLICES } from "./titlePlateSlices.ts";

/* ---------------- Difficulty ---------------- */

/**
 * Difficulty 1–5 (easy, normal, hard, oni, ura oni) → /icons/diff/{n}.png.
 * New code never uses the legacy /icons/difficulty/ copies (12 B12.7). Accepts numeric strings ("4").
 */
export function diffIconSrc(value: unknown): string | null {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) return null;
  const difficulty = normalizeDifficultyType(value);
  return difficulty ? `/icons/diff/${difficulty}.png` : null;
}

/** Ura oni shares the oni icon shape; components add the 里 / 裏 mark after it (04 §7.4). */
export const isUraDifficulty = (value: unknown): boolean => normalizeDifficultyType(value) === 5;

export type { DifficultyType };

/* ---------------- Score rank ---------------- */

export type DsRankValue = (typeof SCORE_RANK_DEFINITIONS)[number]["value"];

const integerIn = (value: unknown, min: number, max: number): number | null => {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Rank value 0–8 from API data (numbers or numeric strings); anything else → null. */
export function normalizeRankValue(value: unknown): DsRankValue | null {
  return integerIn(value, 0, 8) as DsRankValue | null;
}

/**
 * Rank 2–8 → asset name ("2"…"8") under /icons/rank/. 0 (not set) and 1 (not obtained) have no image:
 * rank/1.png is fully transparent and is never loaded (04 §7.6).
 */
export function rankAssetName(value: unknown): string | null {
  const rank = normalizeRankValue(value);
  return rank !== null && rank >= 2 ? String(rank) : null;
}

/** Rank name from utils/scoreRank.ts (the production source; never a second copy). */
export function rankName(value: unknown, locale: string): string | null {
  const rank = normalizeRankValue(value);
  if (rank === null) return null;
  const def = SCORE_RANK_DEFINITIONS.find((item) => item.value === rank)!;
  return locale.startsWith("ja") ? def.jaName : def.zhName;
}

/* ---------------- Crown ---------------- */

/** Crown state → original asset /icons/crown/{name}.png; played / none have no image. */
export function crownIconSrc(state: DsCrownState): string | null {
  const name = crownAssetName(state);
  return name ? `/icons/crown/${name}.png` : null;
}

/* ---------------- Small assets (04 §7.2, D0-5) ---------------- */

/** Generated sizes (px, square) per directory; produced by scripts/ds/generate_small_game_icons.mjs. */
export const DS_SMALL_SIZES = Object.freeze({ rank: [56, 80], crown: [36, 60, 96] } as const);
export type DsSmallDir = keyof typeof DS_SMALL_SIZES;

export interface DsSmallSrc {
  /** srcset for <source type="image/webp"> */
  webp: string;
  /** srcset for the PNG fallback <source> / <img srcset> */
  png: string;
  /** <img src>: the 1× PNG */
  src: string;
}

/**
 * Small asset candidates for a draw size (CSS px). The 1× file is the smallest generated size ≥ draw,
 * the 2× file the smallest ≥ 2 × draw; the largest size is used when none is big enough.
 */
export function smallSrc(dir: DsSmallDir, name: string, draw: number): DsSmallSrc {
  const sizes = DS_SMALL_SIZES[dir] as readonly number[];
  const pick = (px: number) => sizes.find((s) => s >= px) ?? sizes[sizes.length - 1];
  const one = pick(draw);
  const two = pick(draw * 2);
  const path = (size: number, ext: "webp" | "png") => `/icons/${dir}/${size}/${name}.${ext}`;
  return {
    webp: `${path(one, "webp")} 1x, ${path(two, "webp")} 2x`,
    png: `${path(one, "png")} 1x, ${path(two, "png")} 2x`,
    src: path(one, "png")
  };
}

/* ---------------- Title plates (04 §7.7, 22 D8 / D13) ---------------- */

export type DsPlateRequirement = "clear" | "full_combo" | "all_perfect";
export type DsPlateScope = "unspecified" | "oni" | "inner_oni";
export type DsCustomPlate = "custom_sliver" | "custom_gold" | "custom_rainbow";

export interface DsPlateAsset {
  key: number | DsCustomPlate;
  src: string;
  width: number;
  height: number;
  textBand?: { top: number; bottom: number; art: number | null };
}

/**
 * Achievement-based lookup keeps its explicit nine usage mappings. The full
 * numbered catalog comes from the generated slice metadata.
 */
const SLICE_PLATES: ReadonlyArray<{ id: number; requirement: DsPlateRequirement; scope: DsPlateScope; height: number }> = [
  { id: 0, requirement: "clear", scope: "unspecified", height: 45 },
  { id: 1, requirement: "all_perfect", scope: "unspecified", height: 45 },
  { id: 2, requirement: "full_combo", scope: "unspecified", height: 45 },
  { id: 41, requirement: "clear", scope: "oni", height: 71 },
  { id: 42, requirement: "full_combo", scope: "oni", height: 71 },
  { id: 43, requirement: "all_perfect", scope: "oni", height: 71 },
  { id: 59, requirement: "clear", scope: "inner_oni", height: 71 },
  { id: 60, requirement: "full_combo", scope: "inner_oni", height: 71 },
  { id: 61, requirement: "all_perfect", scope: "inner_oni", height: 71 }
];
const PLATE_WIDTH = 556;
const CUSTOM_PLATES: Readonly<Record<DsCustomPlate, DsPlateRequirement>> = {
  custom_sliver: "clear",
  custom_gold: "full_combo",
  custom_rainbow: "all_perfect"
};
const CUSTOM_HEIGHT = 90;

export const DS_PLATE_IDS: readonly number[] = Object.freeze(TITLE_PLATE_SLICES.map((p) => p.id));
export const DS_CUSTOM_PLATES: readonly DsCustomPlate[] = Object.freeze(Object.keys(CUSTOM_PLATES) as DsCustomPlate[]);

/** Plate id (number or numeric string) or custom plate key → asset; anything without an exact match → null (D13). */
export function titlePlateAsset(plate: unknown): DsPlateAsset | null {
  if (typeof plate === "string" && plate in CUSTOM_PLATES) {
    const key = plate as DsCustomPlate;
    return { key, src: `/assets/my-don/custom-title/name_plate_${key}.png`, width: PLATE_WIDTH, height: CUSTOM_HEIGHT };
  }
  const id = integerIn(plate, 0, Number.MAX_SAFE_INTEGER);
  const slice = id === null ? undefined : TITLE_PLATE_SLICES.find((p) => p.id === id);
  if (!slice) return null;
  return { key: slice.id, src: `/assets/my-don/title-plate-slices/name_plate_${slice.id}_slice.png`,
    width: slice.width, height: slice.height, textBand: { top: slice.top, bottom: slice.bottom, art: slice.art } };
}

/** Plate for a title's achievement × difficulty scope; combinations without a plate in the manifest → null (no guessing). */
export function titlePlateForUsage(requirement: unknown, scope: unknown): DsPlateAsset | null {
  const slice = SLICE_PLATES.find((p) => p.requirement === requirement && p.scope === scope);
  return slice ? titlePlateAsset(slice.id) : null;
}

/** Custom-title plate by achievement (clear → silver, full combo → gold, all perfect → rainbow). */
export function customTitlePlate(requirement: unknown): DsPlateAsset | null {
  const key = DS_CUSTOM_PLATES.find((k) => CUSTOM_PLATES[k] === requirement);
  return key ? titlePlateAsset(key) : null;
}

/** Production My-Don plateStyle ("silver" | "gold" | "rainbow") → custom plate asset. */
export function customTitlePlateForStyle(style: unknown): DsPlateAsset | null {
  const map: Record<string, DsCustomPlate> = { silver: "custom_sliver", gold: "custom_gold", rainbow: "custom_rainbow" };
  return typeof style === "string" && map[style] ? titlePlateAsset(map[style]) : null;
}
