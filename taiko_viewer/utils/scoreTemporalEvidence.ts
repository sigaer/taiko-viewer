import { legacyScoreInstant } from '@sakura-taiko/contract';

export const isManualImportTimestamp = (value: unknown) => /^2765[-/]0?1[-/]0?1(?:[ T]|$)/.test(String(value || '').trim());

/** Preserve score values while leaving imported play-date attribution unknown. */
export function realPlayInstant(value: unknown, profile: 'viewer-daily-v1' | 'viewer-goal-v1' | 'viewer-evidence-v1') {
  return isManualImportTimestamp(value) ? null : legacyScoreInstant(value, profile);
}
