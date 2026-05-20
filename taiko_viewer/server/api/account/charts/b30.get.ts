import { getQuery, setHeader } from "h3";
import { requireAccountUser } from "~/server/utils/account";
import { getB30ImageBuffer } from "~/server/services/account/charts";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const query = getQuery(event);
  const buffer = await getB30ImageBuffer(user.id, {
    n: Number(query.n),
    dim: query.dim ? String(query.dim) : undefined,
    dynamicOrigin: query.r === "1" || query.dynamicOrigin === "1"
  });
  setHeader(event, "Content-Type", "image/jpeg");
  setHeader(event, "Cache-Control", "no-store");
  return buffer;
});
