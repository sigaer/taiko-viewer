import { createReadStream } from "node:fs";
import { sendStream, setHeader } from "h3";
import {
  enforceTaikoOpenQuota,
  resolveTaikoDatasetFile,
  resolveTaikoV2ConstantsDataset
} from "~/server/utils/taiko-open";

export default defineEventHandler(async (event) => {
  const datasetName = String(event.context.params?.name || "");
  await enforceTaikoOpenQuota(event, `taiko_data:${datasetName}`);
  if (datasetName === "constants_id_v2") {
    const { body } = await resolveTaikoV2ConstantsDataset();
    setHeader(event, "Content-Type", "text/csv; charset=utf-8");
    setHeader(event, "Cache-Control", "public, max-age=300");
    return body;
  }
  const { filePath } = await resolveTaikoDatasetFile(datasetName);
  setHeader(event, "Content-Type", "application/json; charset=utf-8");
  setHeader(event, "Cache-Control", "public, max-age=300");
  return sendStream(event, createReadStream(filePath));
});
