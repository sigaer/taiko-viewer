// Stage 1 destinations use current business routes until their replacement is
// integrated. No speculative endpoint or prototype router is used at runtime.
export const desktopDestinations = [
  { key: 'today', to: '/' },
  { key: 'songs', to: '/songs' },
  { key: 'play', to: '/account/songs' },
  { key: 'growth', to: '/my/growth' },
  { key: 'community', to: '/forum' },
  { key: 'tools', to: '/more' }
] as const;
export const mobileDestinations = [
  { key: 'today', to: '/' },
  { key: 'songs', to: '/songs' },
  { key: 'search', action: 'search' },
  { key: 'community', to: '/forum' },
  { key: 'my', to: '/my' }
] as const;
export type DestinationKey = typeof desktopDestinations[number]['key'];
export function withoutLocale(path: string): string {
  const clean = path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  return clean === '/ja' ? '/' : clean.startsWith('/ja/') ? clean.slice(3) : clean;
}
export function activeDestination(path: string): DestinationKey | null {
  const value = withoutLocale(path);
  const under = (root: string) => value === root || value.startsWith(root + '/');
  if (value === '/') return 'today';
  if (under('/songs') || under('/grade') || under('/guide') || under('/titles')) return 'songs';
  if (under('/account/songs') || ['/tools/b30','/tools/trend','/tools/progress','/tools/recommend'].includes(value)) return 'play';
  if (under('/my/growth') || under('/my/weekly')) return 'growth';
  if (under('/forum')) return 'community';
  if (['/more','/settings','/about'].includes(value) || under('/tools')) return 'tools';
  return null;
}

export const alternateLocale = (locale: string): "zh" | "ja" => locale === "ja" ? "zh" : "ja";
