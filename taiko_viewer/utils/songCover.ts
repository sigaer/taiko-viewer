export const SONG_COVER_STATIC_BASE_URL = "https://static.sakura-bot.cn";

export const buildSongCoverPath = (songId: number) => `/api/content/covers/${songId}`;

export const buildSongCoverOriginalUrl = (songId: number) =>
  `${SONG_COVER_STATIC_BASE_URL}/cover/${songId}.png`;

export const buildSongCoverThumbnailUrl = (songId: number, size: 200 | 400 = 400) =>
  `${SONG_COVER_STATIC_BASE_URL}/cover/thumb/${size}/${songId}.webp`;

export const buildSongCoverThumbnailSrcset = (songId: number) =>
  `${buildSongCoverThumbnailUrl(songId, 200)} 200w, ${buildSongCoverThumbnailUrl(songId, 400)} 400w`;

export const buildAbsoluteSongCoverUrl = (songId: number, baseUrl: string) =>
  `${String(baseUrl || "").replace(/\/$/, "")}${buildSongCoverPath(songId)}`;
