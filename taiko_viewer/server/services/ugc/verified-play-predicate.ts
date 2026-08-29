export type VerifiedPlaySongRecord = {
  song_no: number;
  level: number;
  [key: string]: unknown;
};

export const hasVerifiedPlayRecord = (
  source: string,
  isCurrent: boolean,
  songs: VerifiedPlaySongRecord[],
  songId: number,
  difficultyCode: number,
  hasEffectiveRecord: (song: VerifiedPlaySongRecord) => boolean
) => {
  if (!isCurrent || (source !== "wahlap" && source !== "hiroba")) return false;
  return songs.some(
    (song) => Number(song.song_no) === songId && Number(song.level) === difficultyCode && hasEffectiveRecord(song)
  );
};
