import { createReadStream } from "node:fs";
import { sendStream, setHeader } from "h3";
import { enforceTaikoOpenQuota, resolveTaikoResourceFile } from "~/server/utils/taiko-open";

export default defineEventHandler(async (event) => {
  const resourceName = String(event.context.params?.name || "");
  await enforceTaikoOpenQuota(event, `taiko_resource:${resourceName}`);
  const { filePath, filename } = await resolveTaikoResourceFile(resourceName);
  setHeader(event, "Content-Type", "application/zip");
  setHeader(event, "Content-Disposition", `attachment; filename="${filename}"`);
  setHeader(event, "Cache-Control", "public, max-age=300");
  return sendStream(event, createReadStream(filePath));
});
