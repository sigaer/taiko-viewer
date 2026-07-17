export const buildSongCoverPath = (songId: number) => `/api/content/covers/${songId}`;

export const buildAbsoluteSongCoverUrl = (songId: number, baseUrl: string) =>
  `${String(baseUrl || "").replace(/\/$/, "")}${buildSongCoverPath(songId)}`;
