import type { PlayerRatingIntelligence, RatingDimensionKey } from '../../types/recommendation-intelligence.ts';
import type { PlayerGrowthState } from '../../types/player-growth.ts';
import { GROWTH_DIMENSION_ORDER } from '../playerGrowth.ts';

export type EvidenceConsistency = 'consistent' | 'inconsistent' | 'unknown';
type Dimension = { key: RatingDimensionKey; value: number };

function dimensionValue(rows: readonly Dimension[], key: RatingDimensionKey): number | null {
  const values = rows.filter(row => row.key === key);
  // Growth State fills missing skills with zero. Zero cannot prove dimension evidence.
  return values.length === 1 && Number.isFinite(values[0].value) && values[0].value > 0 ? values[0].value : null;
}

/** Compare existing evidence only; never synthesize missing skills or a new Rating. */
export function compareGrowthEvidence(rating: PlayerRatingIntelligence | null, growth: PlayerGrowthState | null) {
  const dimensions = Object.fromEntries(GROWTH_DIMENSION_ORDER.map(key => {
    const left = dimensionValue(rating?.dimensions || [], key), right = dimensionValue(growth?.skills || [], key);
    return [key, left === null || right === null ? 'unknown' : left === right ? 'consistent' : 'inconsistent'];
  })) as Record<RatingDimensionKey, EvidenceConsistency>;
  const left = rating?.overallRating, right = growth?.overallRating;
  const overallKnown = typeof left === 'number' && Number.isFinite(left) && left >= 0
    && typeof right === 'number' && Number.isFinite(right) && right >= 0;
  const values = Object.values(dimensions);
  const consistency: EvidenceConsistency = values.includes('inconsistent') || overallKnown && left !== right ? 'inconsistent'
    : overallKnown && rating?.dimensions.length === GROWTH_DIMENSION_ORDER.length
      && growth?.skills.length === GROWTH_DIMENSION_ORDER.length && values.every(value => value === 'consistent') ? 'consistent' : 'unknown';
  return { consistency, dimensions };
}
