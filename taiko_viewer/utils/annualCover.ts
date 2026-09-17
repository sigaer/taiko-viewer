import { buildSongCoverOriginalUrl } from '~/utils/songCover';
// Reuse the viewer's existing default song artwork, with the existing inline
// AnnualArtworkFallback as the terminal state if the image host also fails.
export const ANNUAL_DEFAULT_COVER = buildSongCoverOriginalUrl(1384);
export const resolveAnnualCover = (song?: { coverUrl?: string | null } | null) => song?.coverUrl?.trim() || ANNUAL_DEFAULT_COVER;
export const resolvePosterCover = resolveAnnualCover;
