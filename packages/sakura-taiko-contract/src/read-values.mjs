/** Read compatibility profiles, frozen from Viewer 0.81.10. No IO or host clock. */
const missing = value => value === null || value === undefined || value === '';
const readers = new Map([
  ['viewer-display-v1', value => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
  }],
  ['viewer-overview-v1', value => {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }],
  ['viewer-goal-v1', value => {
    if (missing(value) || typeof value === 'boolean') return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }],
  ['viewer-daily-v1', value => {
    if (missing(value)) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }],
  ['viewer-evidence-v1', value => {
    if (missing(value)) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }]
]);

/** Bind once at an adapter boundary, outside million-row replay loops. */
export function legacyScoreReader(profile) {
  const read = readers.get(profile);
  if (!read) throw new Error('Unknown legacy score read profile');
  return read;
}
export const legacyScoreValue = (value, profile) => legacyScoreReader(profile)(value);

/** Cumulative crown requires all three counts; incomplete evidence is unknown. */
export function legacyCrown(record, profile) {
  const read = legacyScoreReader(profile);
  const clear = read(record.clear_cnt);
  const full = read(record.full_combo_cnt);
  const donda = read(record.dondaful_combo_cnt);
  if (clear === null || full === null || donda === null) return null;
  return donda > 0 ? 2 : full > 0 ? 1 : clear > 0 ? 0 : -1;
}

export function legacyJudgmentTotal(record, profile) {
  const read = legacyScoreReader(profile);
  const good = read(record.good_cnt);
  const ok = read(record.ok_cnt);
  const ng = read(record.ng_cnt);
  return good === null || ok === null || ng === null ? null : good + ok + ng;
}

/** Keep the three historical timestamp acceptance policies explicit. */
export function legacyScoreInstant(value, profile) {
  if (!['viewer-daily-v1', 'viewer-goal-v1', 'viewer-evidence-v1'].includes(profile)) throw new Error('Unknown legacy timestamp read profile');
  if (profile === 'viewer-goal-v1' && (typeof value !== 'string' || !value)) return null;
  const text = profile === 'viewer-goal-v1' ? value : String(value || '').trim();
  if (!text) return null;
  const local = profile === 'viewer-evidence-v1'
    ? /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)
    : /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(text);
  const parsed = Date.parse(local ? text.replace(' ', 'T') + '+08:00' : text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

const effectiveFields = ['high_score', 'best_score_rank', 'good_cnt', 'ok_cnt', 'ng_cnt', 'pound_cnt', 'stage_cnt', 'clear_cnt', 'full_combo_cnt', 'dondaful_combo_cnt', 'combo_cnt'];
export const hasLegacyScoreEvidence = record => effectiveFields.some(field => legacyScoreValue(record[field], 'viewer-display-v1') > 0);
