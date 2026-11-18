import { withoutLocale } from './navigation.ts';
export type RouteValue = string | null | undefined | (string | null)[];
export type CatalogShelf = 'all' | 'available' | 'removed' | 'other';
const shelves: Record<Exclude<CatalogShelf,'all'>, number> = { available: 0, removed: 1, other: 2 };
const first = (value: RouteValue) => (Array.isArray(value) ? value[0] : value) || '';
export function catalogState(query: Record<string, RouteValue>) {
  const raw = first(query.shelf);
  const shelf: CatalogShelf = raw === 'all' || raw === 'removed' || raw === 'other' ? raw : 'available';
  const number = Number(first(query.page));
  return { q: first(query.q).trim(), shelf, page: Number.isSafeInteger(number) && number > 0 ? number : 1,
    sort: first(query.sort) === 'open-day-desc' ? 'open-day-desc' as const : 'catalog' as const };
}
export function catalogRequest(query: Record<string, RouteValue>, pageSize = 24) {
  const state = catalogState(query);
  return { view: 'list' as const, page: state.page, pageSize: Math.max(1, Math.min(60, Math.trunc(pageSize) || 24)),
    keyword: state.q || undefined, sort: state.sort,
    ...(state.shelf === 'all' ? {} : { shelfStatus: shelves[state.shelf] }) };
}
export function legacyCatalogLocation(path: string, query: Record<string, RouteValue>) {
  const normalized = withoutLocale(path);
  const shelf = ({ '/songs/available': 'available', '/songs/removed': 'removed', '/songs/other': 'other' } as Record<string, CatalogShelf>)[normalized];
  const prefix = path === '/ja' || path.startsWith('/ja/') ? '/ja' : '';
  if (shelf) return { path: prefix + '/songs', query: { ...query, shelf } };
  if (normalized === '/songs/v2-constants') return { path: prefix + '/songs/constants', query: { ...query } };
  return null;
}
// Search and the unified catalog share the existing server-paginated contract.
// Alias ranking and chart configuration search are separate integration gates.
export function songSearchRequest(keyword: string) {
  return catalogRequest({ q: keyword, shelf: 'all' }, 8);
}
