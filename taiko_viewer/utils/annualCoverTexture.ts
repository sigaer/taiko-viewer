// Preserve the existing artwork fallback (e.g. a mapped default-cover song ID),
// while making CDN-hosted cover images usable as same-origin WebGL textures.
export const annualCoverTexturePath = (song: { songNo: number; coverUrl?: string | null }) => {
  if (song.coverUrl?.startsWith('/') && !song.coverUrl.startsWith('//')) return song.coverUrl;
  const match = song.coverUrl?.match(/\/cover\/(?:thumb\/(?:200|400)\/)?(\d+)\.(?:png|webp)(?:\?|$)/);
  const id = match ? Number(match[1]) : song.songNo;
  return Number.isSafeInteger(id) && id > 0 ? `/api/content/covers/${id}/texture` : '';
};
