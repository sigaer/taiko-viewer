import type { VersionSummarySongCard, VersionSummaryViewModel } from "~/types/account-version-summary";

const preloadedCoverUrls = new Set<string>();
const pendingCoverPreloads = new Map<string, Promise<boolean>>();

const hashText = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const selectAnnualCoverSongs = (
  summary: VersionSummaryViewModel,
  limit: number,
  salt: string
): Array<VersionSummarySongCard & { flowKey: string }> => {
  const featured: Array<VersionSummarySongCard | null | undefined> = [
    summary.favoriteSong,
    summary.obsessionSong,
    summary.favoriteShift?.newFavorite,
    summary.favoriteShift?.oldFavorite,
    ...summary.monthlyFavorites.map((item) => item.song),
    summary.timeOfDay?.favoriteSong,
    summary.lateNight?.song,
    summary.nearDondaful?.song,
    summary.challenge?.song,
    summary.pound?.topSong,
    summary.highScore?.song,
    ...summary.milestones.map((item) => item.song)
  ];
  const seen = new Set<number>();
  return [...summary.coverSongs, ...featured]
    .flatMap((song) => {
      if (!song?.songNo || seen.has(song.songNo)) return [];
      seen.add(song.songNo);
      return [{ ...song, flowKey: `${song.songNo}:${song.level ?? ""}` }];
    })
    .sort((left, right) =>
      hashText(`${summary.summaryId}:${salt}:${left.songNo}`)
      - hashText(`${summary.summaryId}:${salt}:${right.songNo}`)
    )
    .slice(0, limit);
};

export const isAnnualCoverPreloaded = (url: string) => preloadedCoverUrls.has(url);

const preloadCover = (url: string) => {
  if (preloadedCoverUrls.has(url)) return Promise.resolve(true);
  const pending = pendingCoverPreloads.get(url);
  if (pending) return pending;

  const request = new Promise<boolean>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (loaded) preloadedCoverUrls.add(url);
      resolve(loaded);
    };
    const timeout = window.setTimeout(() => finish(false), 6000);
    image.onload = () => finish(image.naturalWidth > 0);
    image.onerror = () => finish(false);
    image.decoding = "async";
    image.src = url;
    if (image.complete) finish(image.naturalWidth > 0);
  }).finally(() => pendingCoverPreloads.delete(url));

  pendingCoverPreloads.set(url, request);
  return request;
};

export const preloadAnnualOpeningCovers = async (summary: VersionSummaryViewModel) => {
  if (!process.client) return;
  const urls = [...new Set(
    selectAnnualCoverSongs(summary, 12, "opening")
      .map((song) => song.coverUrl)
      .filter((url): url is string => Boolean(url))
  )];
  await Promise.all(urls.map(preloadCover));
};
