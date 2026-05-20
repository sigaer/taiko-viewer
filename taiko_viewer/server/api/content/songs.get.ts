import { getSongCatalogPayload } from "~/server/services/content";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const shelfStatusRaw = query.shelfStatus;
  const shelfStatus =
    shelfStatusRaw === undefined || shelfStatusRaw === null || shelfStatusRaw === ""
      ? undefined
      : Number(shelfStatusRaw);
  return getSongCatalogPayload(
    shelfStatus !== undefined && Number.isFinite(shelfStatus) ? shelfStatus : undefined
  );
});
