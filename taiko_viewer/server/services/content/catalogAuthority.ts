/** Read adapter only. Eligibility is precomputed by the Python Authority. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';

export type CatalogReport = { catalogRevision: string; policyVersion: string; state: string; [key: string]: unknown };
export type AuthoritySnapshot = {
  schemaVersion: number; catalogRevision: string; policyVersion: string;
  songs: any[]; charts: Record<string, any>; aliases: Record<string, number>; searchAliases: any[]; sourceManifest: any[];
};
type Captured = { data: AuthoritySnapshot; body: Buffer; report: CatalogReport; root: string };
type RequestState = { captured?: Promise<Captured>; report?: (report: CatalogReport) => void };
export const catalogRequest = new AsyncLocalStorage<RequestState>();
export function withCatalogRequest<T>(task: () => T, report?: RequestState['report']): T {
  return catalogRequest.run({ report }, task);
}
const cache = new Map<string, { data: AuthoritySnapshot; body: Buffer }>();

export async function readCatalogAuthority(root: string): Promise<Captured> {
  const pointer = JSON.parse(await readFile(resolve(root, 'active.json'), 'utf8'));
  const revision = pointer.catalogRevision;
  if (!/^[0-9a-f]{64}$/.test(revision)) throw new Error('CATALOG_INVALID_REVISION');
  const key = `${root}:${revision}:${pointer.sha256}`;
  let cached = cache.get(key);
  if (!cached) {
    const bytes = await readFile(resolve(root, 'revisions', revision, 'catalog.json'));
    if (createHash('sha256').update(bytes).digest('hex') !== pointer.sha256 || bytes.length !== pointer.bytes) throw new Error('CATALOG_HASH_MISMATCH');
    const data = JSON.parse(bytes.toString('utf8')) as AuthoritySnapshot;
    if (data.schemaVersion !== 1 || data.policyVersion !== 'wahlap-cn-1' || data.catalogRevision !== revision) throw new Error('CATALOG_UNSUPPORTED_OR_MIXED_REVISION');
    cached = { data, body: bytes };
    cache.set(key, cached);
    while (cache.size > 3) cache.delete(cache.keys().next().value!);
  }
  let health: Record<string, unknown>;
  try { health = JSON.parse(await readFile(resolve(root, 'fetch-status.json'), 'utf8')); }
  catch { health = { state: 'stale', reason: 'FETCH_HEALTH_MISSING' }; }
  if (health.catalogRevision && health.catalogRevision !== revision) health = { state: 'stale', reason: 'FETCH_HEALTH_REVISION_MISMATCH' };
  const { data, body } = cached;
  return { root, data, body, report: { ...health, catalogRevision: revision, policyVersion: data.policyVersion, state: String(health.state || 'stale') } };
}

export async function captureCatalogAuthority(root?: string) {
  const runtime = typeof useRuntimeConfig === 'function' ? useRuntimeConfig() : {};
  const catalogRoot = root || process.env.TAIKO_CATALOG_ROOT || resolve(String(runtime.repoRoot || process.env.TAIKO_REPO_ROOT || resolve(process.cwd(), '..')), 'catalog');
  const state = catalogRequest.getStore();
  if (state) return state.captured ||= readCatalogAuthority(catalogRoot).then(value => { state.report?.(value.report); return value; });
  return readCatalogAuthority(catalogRoot);
}

export function catalogRowPolicy(song: any, policy: 'catalog_display' | 'historical_score' | 'cn_current_playable', difficulty?: number): boolean {
  const catalog = song?.catalog;
  if (policy === 'catalog_display') return catalog?.catalogDisplay === true;
  if (policy === 'historical_score') return catalog?.historicalScore !== false;
  return difficulty === undefined ? catalog?.cnRelease === 'LISTED' : catalog?.cnCurrentPlayable?.includes(difficulty) === true;
}

/** Lightweight current pointer recheck; bypass request snapshot caching before a CAS commit. */
export async function readCatalogPointerRevision(root: string): Promise<string> {
  const pointer=JSON.parse(await readFile(resolve(root,'active.json'),'utf8'));
  if(!/^[a-f0-9]{64}$/.test(pointer.catalogRevision)) throw new Error('CATALOG_INVALID_REVISION');
  return pointer.catalogRevision;
}
