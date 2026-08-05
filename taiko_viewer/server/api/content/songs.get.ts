import { getSongCatalogPagePayload, getSongCatalogPayload } from "~/server/services/content";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const shelfStatusRaw = query.shelfStatus;
  const shelfStatus =
    shelfStatusRaw === undefined || shelfStatusRaw === null || shelfStatusRaw === ""
      ? undefined
      : Number(shelfStatusRaw);

  if (query.page !== undefined || query.pageSize !== undefined || query.view === "list") {
    setHeader(event, "Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return getSongCatalogPagePayload({
      shelfStatus: shelfStatus !== undefined && Number.isFinite(shelfStatus) ? shelfStatus : undefined,
      keyword: String(query.keyword || ""),
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 24),
      sort: query.sort === "open-day-desc" ? "open-day-desc" : "catalog"
    });
  }

  return getSongCatalogPayload(
    shelfStatus !== undefined && Number.isFinite(shelfStatus) ? shelfStatus : undefined
  );
});
