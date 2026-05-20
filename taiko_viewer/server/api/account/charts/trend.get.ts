import { getQuery, setHeader } from "h3";
import { requireAccountUser } from "~/server/utils/account";
import { getTrendImageBuffer } from "~/server/services/account/charts";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const query = getQuery(event);
  const buffer = await getTrendImageBuffer(user.id, {
    n: Number(query.n),
    maxDays: Number(query.maxDays || query.days),
    dim: query.dim ? String(query.dim) : undefined,
    barMode: query.bar === "1" || query.barMode === "1",
    showAll: query.all === "1" || query.showAll === "1"
  });
  setHeader(event, "Content-Type", "image/jpeg");
  setHeader(event, "Cache-Control", "no-store");
  return buffer;
});
