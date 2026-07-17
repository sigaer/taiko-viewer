import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAbsoluteSongCoverUrl } from "~/utils/songCover";
import {
  CONTENT_CANONICAL_BASE_URL,
  buildStaticCoverAssetUrl,
  getContentRuntimePaths
} from "./runtime";

export const getSongCoverUrl = (songId: number) =>
  buildAbsoluteSongCoverUrl(songId, CONTENT_CANONICAL_BASE_URL);

export const resolveSongCoverAsset = async (songId: number) => {
  const { repoRoot } = getContentRuntimePaths();
  const filePath = resolve(repoRoot, "assets", "cover", `${songId}.png`);
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) return null;
  return {
    filePath,
    redirectUrl: `${buildStaticCoverAssetUrl(songId)}?v=${Math.max(1, Math.floor(fileStat.mtimeMs))}`
  };
};
