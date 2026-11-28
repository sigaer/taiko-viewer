import { withoutLocale } from './navigation.ts';
// Unified song library URL contract (Stage 1). Single source of truth for /songs state, the list API request,
// legacy list addresses and the library return target. Pure functions only: no Nuxt imports, used by pages,
// components, route/server middleware and node tests alike.

export type RouteValue = string | null | undefined | (string | null)[];
export type RouteQuery = Record<string, RouteValue>;
export type CatalogShelf = 'available' | 'removed' | 'other' | 'all';
export type CatalogSort = 'open-day-desc' | 'catalog';
export interface CatalogState { q: string; shelf: CatalogShelf; sort: CatalogSort; page: number }
export interface CatalogLocation { path: string; query: Record<string, string> }
type LocalePath = (location: CatalogLocation | string) => string;

export const CATALOG_PATH = '/songs';
export const CATALOG_PAGE_SIZE = 24;
/** Display order of the shelf control. */
export const CATALOG_SHELVES: readonly CatalogShelf[] = ['available', 'removed', 'other', 'all'];
export const CATALOG_SORTS: readonly CatalogSort[] = ['open-day-desc', 'catalog'];
const shelfStatus: Record<Exclude<CatalogShelf, 'all'>, number> = { available: 0, removed: 1, other: 2 };
const first = (value: RouteValue) => (Array.isArray(value) ? value[0] : value) || '';
const isShelf = (value: unknown): value is CatalogShelf => CATALOG_SHELVES.includes(value as CatalogShelf);
const isSort = (value: unknown): value is CatalogSort => CATALOG_SORTS.includes(value as CatalogSort);
const validPage = (value: unknown) => (Number.isSafeInteger(value) && (value as number) > 0 ? (value as number) : 1);

/** The old /songs/available was newest first; removed, other and bare /songs used the data file order. */
export const defaultSort = (shelf: CatalogShelf): CatalogSort => (shelf === 'available' ? 'open-day-desc' : 'catalog');

/** Effective state from a route query; invalid values fall back to the defaults (sort: that shelf's default). */
export function catalogState(query: RouteQuery): CatalogState {
  const raw = first(query.shelf);
  const shelf: CatalogShelf = isShelf(raw) ? raw : 'available';
  const pageText = first(query.page).trim();
  const sort = first(query.sort);
  return {
    q: first(query.q).trim(),
    shelf,
    sort: isSort(sort) ? sort : defaultSort(shelf),
    page: /^\d+$/.test(pageText) ? validPage(Number(pageText)) : 1
  };
}

/** Canonical query: only q, shelf, sort, page in that order, each omitted when it is the default. */
export function catalogQuery(input: Partial<CatalogState> = {}): Record<string, string> {
  const shelf = isShelf(input.shelf) ? input.shelf : 'available';
  const q = String(input.q ?? '').trim();
  const sort = isSort(input.sort) ? input.sort : defaultSort(shelf);
  const page = validPage(input.page);
  const out: Record<string, string> = {};
  if (q) out.q = q;
  if (shelf !== 'available') out.shelf = shelf;
  if (sort !== defaultSort(shelf)) out.sort = sort;
  if (page !== 1) out.page = String(page);
  return out;
}

export function catalogLocation(input: Partial<CatalogState>): CatalogLocation;
export function catalogLocation(input: Partial<CatalogState>, localePath: LocalePath): string;
export function catalogLocation(input: Partial<CatalogState>, localePath?: LocalePath) {
  const location = { path: CATALOG_PATH, query: catalogQuery(input) };
  return localePath ? localePath(location) : location;
}

/** Shelf change in the UI: keep the sort being looked at and the keyword, back to page 1. */
export const shelfSwitch = (state: CatalogState, shelf: CatalogShelf): CatalogState => ({ q: state.q, shelf, sort: state.sort, page: 1 });
export const sortSwitch = (state: CatalogState, sort: CatalogSort): CatalogState => ({ ...state, sort, page: 1 });
export const keywordSwitch = (state: CatalogState, q: string): CatalogState => ({ ...state, q: q.trim(), page: 1 });
export const pageSwitch = (state: CatalogState, page: number): CatalogState => ({ ...state, page });
export const sameCatalogState = (a: CatalogState, b: CatalogState) =>
  a.q === b.q && a.shelf === b.shelf && a.sort === b.sort && a.page === b.page;

/** Request for GET /api/content/songs (view=list). */
export function catalogRequestFor(state: CatalogState, pageSize = CATALOG_PAGE_SIZE) {
  return {
    view: 'list' as const,
    page: state.page,
    pageSize: Math.max(1, Math.min(60, Math.trunc(pageSize) || CATALOG_PAGE_SIZE)),
    keyword: state.q || undefined,
    sort: state.sort,
    ...(state.shelf === 'all' ? {} : { shelfStatus: shelfStatus[state.shelf] })
  };
}
export const catalogRequest = (query: RouteQuery, pageSize = CATALOG_PAGE_SIZE) => catalogRequestFor(catalogState(query), pageSize);

// Search and the unified catalog share the existing server-paginated contract.
// The list API also matches song aliases (alias-only hits carry `matchedAlias`); artist and chart configuration
// search are not supported.
export function songSearchRequest(keyword: string) {
  return catalogRequest({ q: keyword, shelf: 'all' }, 8);
}
/** "View all results" from the search panel: the same keyword and order in all songs. */
export const searchAllState = (q: string): Partial<CatalogState> => ({ q, shelf: 'all' });

export const isLibraryPath = (path: string) => withoutLocale(path) === CATALOG_PATH;
export const pageCount = (total: number, pageSize: number) =>
  total > 0 && pageSize > 0 ? Math.ceil(total / pageSize) : 0;

/** Windowed pager: first, last, current ± siblings; a gap of one page shows the page instead of an ellipsis. */
export function pagerItems(page: number, count: number, siblings = 1): (number | 'gap')[] {
  if (!Number.isSafeInteger(count) || count < 1) return [];
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), count);
  const pages = new Set([1, count]);
  for (let n = current - siblings; n <= current + siblings; n++) if (n >= 1 && n <= count) pages.add(n);
  const out: (number | 'gap')[] = [];
  let previous = 0;
  for (const n of [...pages].sort((a, b) => a - b)) {
    if (previous && n - previous === 2) out.push(previous + 1);
    else if (previous && n - previous > 2) out.push('gap');
    out.push(n);
    previous = n;
  }
  return out;
}

// ---------- Legacy list addresses ----------
const LEGACY_SHELVES: Record<string, CatalogShelf> = {
  '/songs/available': 'available',
  '/songs/removed': 'removed',
  '/songs/other': 'other'
};
const localePrefix = (pathname: string) => (/^\/ja(?:\/|$)/.test(pathname) ? '/ja' : '');

/** Old list URL → new location (locale kept, every query kept; the path's shelf wins). null when not legacy. */
export function legacyCatalogLocation(path: string, query: RouteQuery) {
  const pathname = path.split(/[?#]/, 1)[0];
  const normalized = withoutLocale(pathname);
  const prefix = localePrefix(pathname);
  const shelf = LEGACY_SHELVES[normalized];
  const { shelf: _ignored, ...rest } = query;
  if (shelf) return { path: prefix + CATALOG_PATH, query: { shelf, ...rest } as RouteQuery };
  if (normalized === '/songs/v2-constants') return { path: prefix + '/songs/constants', query: { ...query } };
  return null;
}

/** Serialise a location; repeated keys stay repeated, a key without value becomes `key=`. */
export function locationHref(location: { path: string; query: RouteQuery }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(location.query)) {
    for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) params.append(key, item ?? '');
  }
  const search = params.toString();
  return location.path + (search ? '?' + search : '');
}
export function legacyCatalogHref(path: string, query: RouteQuery) {
  const location = legacyCatalogLocation(path, query);
  return location ? locationHref(location) : null;
}

// ---------- Song detail link and the way back ----------
export function songDetailLocation(id: number, shelf: CatalogShelf) {
  const query: Record<string, string> = shelf === 'removed' || shelf === 'other' ? { list: shelf } : {};
  return { path: `/songs/${id}`, query };
}
const normalizedStatus = (value: unknown) => {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};
/** Library shelf a detail page falls back to (the old songListPath, in new addresses). */
export function detailFallbackShelf(list: RouteValue, shelfStatusValue: unknown): Exclude<CatalogShelf, 'all'> {
  const value = first(list);
  if (value === 'removed' || value === 'other' || value === 'available') return value;
  const status = normalizedStatus(shelfStatusValue);
  return status === 1 ? 'removed' : status === 2 ? 'other' : 'available';
}

/** Validated, canonical library return target for the current locale (prefixed path + canonical query), or null. */
export function libraryReturnTarget(stored: unknown, locale: string): string | null {
  if (typeof stored !== 'string' || !stored.startsWith('/') || stored.startsWith('//') || stored.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(stored, 'http://viewer.invalid');
  } catch {
    return null;
  }
  if (url.origin !== 'http://viewer.invalid') return null;
  const prefix = locale === 'ja' ? '/ja' : '';
  if (url.pathname.replace(/\/+$/, '') !== prefix + CATALOG_PATH) return null;
  const query: RouteQuery = {};
  for (const key of ['q', 'shelf', 'sort', 'page']) {
    const value = url.searchParams.get(key);
    if (value !== null) query[key] = value;
  }
  return locationHref({ path: prefix + CATALOG_PATH, query: catalogQuery(catalogState(query)) });
}

// ---------- Row presentation (real list API fields only) ----------
/** API genre value → DS genre key (`--genre-*` token and locale label). */
const GENRE_KEYS: Record<string, string> = {
  南梦宫原创音乐: 'namco',
  流行音乐: 'pops',
  儿童音乐: 'kids',
  古典音乐: 'classic',
  综合音乐: 'variety',
  游戏音乐: 'game',
  博歌乐音乐: 'vocaloid',
  动漫音乐: 'anime'
};
export const genreKey = (type: unknown): string | null => GENRE_KEYS[String(type ?? '')] ?? null;

export type SongLevelFields = Partial<Record<'level_1' | 'level_2' | 'level_3' | 'level_4' | 'level_5', unknown>>;
/** Difficulties that exist on a song; missing and "-" values are skipped. */
export function songLevels(song: SongLevelFields): { difficulty: 1 | 2 | 3 | 4 | 5; star: string }[] {
  return ([1, 2, 3, 4, 5] as const).flatMap((difficulty) => {
    const value = song[`level_${difficulty}`];
    const text = value === undefined || value === null ? '' : String(value).trim();
    return text && text !== '-' ? [{ difficulty, star: text }] : [];
  });
}

/** open_day "M/D/YYYY" → "YYYY-MM-DD"; null when missing or malformed. */
export function formatOpenDay(value: unknown): string | null {
  const match = String(value ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}` : null;
}
export const shelfOf = (shelfStatusValue: unknown): Exclude<CatalogShelf, 'all'> => {
  const status = normalizedStatus(shelfStatusValue);
  return status === 1 ? 'removed' : status === 2 ? 'other' : 'available';
};

export function songTitle(song: { song_name: string; song_name_jp?: string }, locale: string) {
  return locale === 'ja' ? song.song_name_jp || song.song_name : song.song_name;
}
/** Title, other-language name and their languages for a row. */
export function songNames(song: { song_name: string; song_name_jp?: string }, locale: string) {
  const ja = locale === 'ja';
  const hasJa = Boolean(song.song_name_jp);
  return {
    title: songTitle(song, locale),
    titleLang: ja && hasJa ? 'ja' : 'zh-CN',
    subtitle: ja ? (hasJa ? song.song_name : '') : song.song_name_jp || '',
    subtitleLang: ja ? 'zh-CN' : 'ja'
  };
}
