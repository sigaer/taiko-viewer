import { createReadStream } from "node:fs";
import { sendStream, setHeader } from "h3";
import { enforceTaikoOpenQuota, resolveTaikoAssetBundleFile } from "~/server/utils/taiko-open";

export default defineEventHandler(async (event) => {
  await enforceTaikoOpenQuota(event, "taiko_assets_latest");
  const { filePath, filename, info } = await resolveTaikoAssetBundleFile();
  setHeader(event, "Content-Type", "application/zip");
  setHeader(event, "Content-Disposition", `attachment; filename="${filename}"`);
  setHeader(event, "Cache-Control", "public, max-age=300");
  setHeader(event, "Content-Length", String(info.size));
  setHeader(event, "ETag", `"${info.sha256}"`);
  setHeader(event, "Last-Modified", new Date(info.updatedAt).toUTCString());
  setHeader(event, "X-Taiko-Bundle-Sha256", info.sha256);
  setHeader(event, "X-Taiko-Bundle-Updated-At", info.updatedAt);
  return sendStream(event, createReadStream(filePath));
});
