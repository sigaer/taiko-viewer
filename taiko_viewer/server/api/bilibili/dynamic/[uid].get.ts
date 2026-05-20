import { fetchSpaceDynamics } from "~/server/services/bilibili";

const UID_PATTERN = /^\d+$/;

export default defineEventHandler(async (event) => {
  const uid = String(getRouterParam(event, "uid") || "").trim();
  if (!UID_PATTERN.test(uid)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid bilibili uid" });
  }

  return fetchSpaceDynamics(uid);
});
