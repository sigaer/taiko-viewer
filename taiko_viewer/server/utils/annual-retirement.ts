/** Exact retired product routes; shared account, titles and Forum routes stay live. */
export function isRetiredAnnualPath(path: string): boolean {
  const normalized = path.replace(/^\/(?:ja|zh)(?=\/|$)/, '') || '/';
  return /^(?:\/annual(?:\/|$)|\/account\/(?:version-summary|annual-poster|annual-share-card)(?:\/|$)|\/admin\/taiko\/annual-(?:beta|summaries)(?:\/|$)|\/api\/(?:annual(?:\/|$)|annual-beta(?:\/|$)|account\/annual-(?:summaries|summary-jobs|shares|posters|poster-jobs|share-cards|reactions)(?:\/|$)|admin\/annual-(?:summaries|summary-jobs|beta|reactions)(?:\/|$)|internal\/annual-(?:posters|share-cards)(?:\/|$)|taiko\/internal\/annual-card(?:\/|$)))/.test(normalized);
}
