import { getQuery, setHeader } from "h3";
import { requireAccountUser } from "~/server/utils/account";
import { getRecommendImageBuffer } from "~/server/services/account/charts";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const query = getQuery(event);
  const buffer = await getRecommendImageBuffer(user.id, {
    n: Number(query.n),
    dim: query.dim ? String(query.dim) : undefined
  });
  setHeader(event, "Content-Type", "image/jpeg");
  setHeader(event, "Cache-Control", "no-store");
  return buffer;
});
