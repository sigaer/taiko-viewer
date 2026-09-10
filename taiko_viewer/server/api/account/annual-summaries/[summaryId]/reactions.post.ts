import { getRouterParam } from "h3";
import { createAnnualReaction } from "~/server/services/account/annual-summary/reactions";
export default defineEventHandler((event) => createAnnualReaction(event, String(getRouterParam(event, "summaryId") || "")));
