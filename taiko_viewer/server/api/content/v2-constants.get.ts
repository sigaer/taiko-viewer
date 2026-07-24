import { getV2ConstantsPayload } from "~/server/services/content/v2Constants";

export default defineEventHandler(async (event) => {
  return getV2ConstantsPayload(getQuery(event));
});
