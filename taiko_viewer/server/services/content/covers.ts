import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildStaticCoverAssetUrl,
  buildStaticCoverThumbnailUrl,
  getContentRuntimePaths
} from "./runtime";

export const getSongCoverUrl = (songId: number) =>
  buildStaticCoverThumbnailUrl(songId, 400);

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
