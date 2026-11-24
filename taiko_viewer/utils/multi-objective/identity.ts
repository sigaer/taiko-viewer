/** B4 offline/1 Authority adapter. No filesystem, title lookup, or ID construction. */
import type { AuthorityRow, CatalogAuthoritySnapshot, IdentityRequest, IdentityResolution, MultiObjectiveCandidate } from './contracts.ts';
import { canonicalJSON, hash, isObject, unique } from './common.ts';
export const SOURCE_NAMESPACES = ['wahlap', 'catalog-id', 'ourtaiko', 'taikowiki', 'nijiiro'] as const;
type Alias = CatalogAuthoritySnapshot['sourceAliases'][number];
export type AuthorityIndex = { resolve: (request: IdentityRequest) => IdentityResolution; verify: (candidate: MultiObjectiveCandidate) => string[] };
const fail = (code: string, status: 'UNRESOLVED' | 'AMBIGUOUS' = 'UNRESOLVED'): IdentityResolution => ({ status, reasonCodes: [code] });
export function prepareAuthority(snapshot: CatalogAuthoritySnapshot): AuthorityIndex {
  const aliases = new Map<string, Alias[]>(), rows = new Map<string, AuthorityRow[]>(), songAliases = new Map<string, Alias[]>();
  let valid = snapshot?.schemaVersion === 1 && snapshot.policyVersion === 'wahlap-cn-1' && /^[a-f0-9]{64}$/.test(snapshot.catalogRevision);
  if (!Array.isArray(snapshot?.sourceAliases) || !isObject(snapshot?.charts)) valid = false;
  if (valid) {
    for (const a of snapshot.sourceAliases) {
      if (!isObject(a) || !SOURCE_NAMESPACES.includes(a.namespace as typeof SOURCE_NAMESPACES[number]) || typeof a.key !== 'string' || typeof a.songId !== 'string' || !a.evidence) { valid = false; break; }
      const k = canonicalJSON([a.namespace, a.key]);
      aliases.set(k, [...aliases.get(k) ?? [], structuredClone(a)]);
      const sk = canonicalJSON([a.songId, a.namespace]);
      songAliases.set(sk, [...songAliases.get(sk) ?? [], structuredClone(a)]);
    }
    for (const row of Object.values(snapshot.charts)) {
      if (!isObject(row) || typeof row.chartId !== 'string' || typeof row.songId !== 'string' || !Number.isSafeInteger(row.sourceSongId) || !Number.isInteger(row.difficulty) || row.difficulty < 1 || row.difficulty > 5 || typeof row.exists !== 'boolean' || !isObject(row.policies)) { valid = false; break; }
      const k = canonicalJSON([row.songId, row.difficulty]);
      rows.set(k, [...rows.get(k) ?? [], structuredClone(row)]);
    }
  }
  const revision = snapshot?.catalogRevision;
  const index: AuthorityIndex = { resolve(request: IdentityRequest): IdentityResolution {
    if (!valid) return fail('CATALOG_SNAPSHOT_UNSUPPORTED');
    if (request.catalogRevision !== revision) return fail('CATALOG_REVISION_MISMATCH');
    if (!SOURCE_NAMESPACES.includes(request.namespace as typeof SOURCE_NAMESPACES[number])) return fail('SOURCE_NAMESPACE_UNSUPPORTED');
    if (typeof request.sourceId !== 'string' || !request.sourceId || !Number.isInteger(request.difficulty) || request.difficulty < 1 || request.difficulty > 5) return fail('SOURCE_KEY_INVALID');
    const matched = aliases.get(canonicalJSON([request.namespace, request.sourceId])) ?? [];
    const songs = unique(matched.map(a => a.songId));
    if (!songs.length) return fail('CHART_ID_UNRESOLVED');
    if (songs.length !== 1) return fail('CHART_ID_AMBIGUOUS', 'AMBIGUOUS');
    const candidates = rows.get(canonicalJSON([songs[0], request.difficulty])) ?? [];
    if (!candidates.length) return fail('CHART_ID_UNRESOLVED');
    if (new Set(candidates.map(r => canonicalJSON(r))).size !== 1) return fail('CHART_ID_AMBIGUOUS', 'AMBIGUOUS');
    const row = candidates[0]!;
    if (!row.exists) return fail('CHART_DOES_NOT_EXIST');
    // CN Authority cannot establish JP current business eligibility.
    if (request.region !== 'CN' && request.businessPolicy !== 'catalog_display') return fail('REGION_POLICY_UNSUPPORTED');
    let policy = row.policies[request.businessPolicy];
    if (request.businessPolicy === 'recommendation_eligible') policy = isObject(policy) && request.modelProfile ? policy[request.modelProfile] : null;
    if (!isObject(policy) || policy.eligible !== true) return fail('CATALOG_POLICY_INELIGIBLE');
    return { status: 'RESOLVED', value: {
      canonicalSongId: row.songId, chartId: row.chartId, difficultyType: row.difficulty,
      // v1 Authority has no explicit version-family relation. Do not infer one.
      identityGroup: row.songId, sourceSongId: row.sourceSongId, catalogRevision: revision,
      identityMappingRef: hash({ catalogRevision: revision, namespace: request.namespace, sourceId: request.sourceId,
        aliases: unique(matched.map(a => canonicalJSON(a))), chartId: row.chartId, songId: row.songId, difficulty: row.difficulty }),
    } };
  }, verify(c: MultiObjectiveCandidate): string[] {
    const matchedRows = rows.get(canonicalJSON([c.canonicalSongId, c.difficultyType])) ?? [];
    const row = matchedRows.find(r => r.chartId === c.chartId);
    if (!row) return ['CHART_ID_UNRESOLVED'];
    const possible = songAliases.get(canonicalJSON([c.canonicalSongId, c.sourceNamespace])) ?? [];
    for (const a of possible) {
      const resolved = index.resolve({ namespace: a.namespace, sourceId: a.key, difficulty: c.difficultyType, catalogRevision: c.catalogRevision, region: c.region, businessPolicy: 'cn_current_playable', modelProfile: null });
      if (resolved.status === 'RESOLVED' && resolved.value.identityMappingRef === c.identityMappingRef) {
        const v = resolved.value;
        if (v.chartId !== c.chartId || v.sourceSongId !== c.songId || v.identityGroup !== c.identityGroup) return ['CANONICAL_IDENTITY_MISMATCH'];
        if (c.sourceHash !== null && row.sourceHash !== c.sourceHash) return ['SOURCE_HASH_MISMATCH'];
        if (c.intentType === 'score_improvement' || c.intentType === 'dimension_training' || c.subtype === 'level_matched_discovery') {
          const policies = row.policies.recommendation_eligible;
          const policy = isObject(policies) ? policies[c.source.kind === 'legacy_target' ? 'target' : 'ordinary'] : null;
          if (!isObject(policy) || policy.eligible !== true) return ['CATALOG_MODEL_POLICY_INELIGIBLE'];
        }
        return [];
      }
    }
    return ['IDENTITY_MAPPING_UNVERIFIED'];
  } };
  return Object.freeze(index);
}
export function resolveCanonicalChartIdentity(snapshot: CatalogAuthoritySnapshot | AuthorityIndex, request: IdentityRequest): IdentityResolution {
  return 'resolve' in snapshot && typeof snapshot.resolve === 'function' ? snapshot.resolve(request) : prepareAuthority(snapshot as CatalogAuthoritySnapshot).resolve(request);
}
