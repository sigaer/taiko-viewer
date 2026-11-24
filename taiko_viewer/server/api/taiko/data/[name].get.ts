import { createReadStream } from "node:fs";
import { sendStream, setHeader } from "h3";
import { captureCatalogAuthority } from '../../../services/content/catalogAuthority';
import {
  enforceTaikoOpenQuota,
  resolveTaikoDatasetFile,
  resolveTaikoV2ConstantsDataset
} from "~/server/utils/taiko-open";

export default defineEventHandler(async (event) => {
  const datasetName = String(event.context.params?.name || "");
  await enforceTaikoOpenQuota(event, `taiko_data:${datasetName}`);
  if (datasetName === 'song_data' || datasetName === 'song_data_with_roll' || datasetName === 'song_alias') {
    const { data } = await captureCatalogAuthority();
    const revision = getQuery(event).revision;
    if (revision && revision !== data.catalogRevision) throw createError({statusCode:409,statusMessage:'Catalog revision changed; refresh manifest'});
    setHeader(event, 'Cache-Control', 'public, max-age=60');
    return datasetName === 'song_alias' ? data.searchAliases : data.songs;
  }
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
