import { getV2ConstantsPayload } from "~/server/services/content/v2Constants";

export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=3600");
  return getV2ConstantsPayload(getQuery(event));
});
