import type { VersionSummarySongCard, VersionSummaryViewModel } from "~/types/account-version-summary";

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
