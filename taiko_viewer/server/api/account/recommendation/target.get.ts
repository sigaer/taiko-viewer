import { getQuery, setHeader } from "h3";
import { requireAccountUser } from "~/server/utils/account";
import { getTargetRecommendations } from "~/server/services/account/personal";
import type { TargetRecommendationKey } from "~/types/recommendation-intelligence";

const targets = new Set<TargetRecommendationKey>(["goku", "ziya", "fenya", "jinya", "full_combo", "dondaful"]);

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const query = getQuery(event);
  const target = String(query.target || "goku") as TargetRecommendationKey;
  if (!targets.has(target)) throw createError({ statusCode: 400, statusMessage: "目标类型不受支持" });
  const star = query.star ? String(query.star) : undefined;
  if (star && !/^(?:[1-9]|10)$/.test(star)) throw createError({ statusCode: 400, statusMessage: "星级筛选无效" });
  setHeader(event, "Cache-Control", "private, no-store");
  return getTargetRecommendations(user.id, target, star);
});
