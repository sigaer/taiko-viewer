import { parseTJA, getEffectiveBpm } from '../../vendor/tja/TJARenderer/src/tja-parser';
import * as primitives from '../../vendor/tja/TJARenderer/src/primitives';
export const Private = { parseTJA, getEffectiveBpm, ...primitives };
