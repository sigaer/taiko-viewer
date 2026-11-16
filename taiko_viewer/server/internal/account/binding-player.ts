import { createError } from "h3";

const playerId = (player: Record<string, unknown>) => {
  const value = player.userid;
  const id = typeof value === "string" ? value.trim()
    : typeof value === "number" && Number.isSafeInteger(value) ? String(value) : "";
  return /^[0-9]{1,25}$/.test(id) ? id : "";
};

/** Nicknames identify a search result only. Grants and challenges always use
 * its exact numeric userid; never accept fuzzy/first-result matches. */
export function selectBindingPlayer(players: unknown, keyword: string, allowNickname = false) {
  const rows = Array.isArray(players) ? players.filter((row): row is Record<string, unknown> =>
    Boolean(row && typeof row === "object" && !Array.isArray(row))) : [];
  const numeric = /^[0-9]{1,25}$/.test(keyword);
  const matches = rows.filter(row => playerId(row) && (numeric ? playerId(row) === keyword
    : allowNickname && typeof row.mydon_name === "string" && row.mydon_name.trim() === keyword));
  const ids = new Set(matches.map(playerId));
  if (ids.size > 1) throw createError({ statusCode: 409, statusMessage: "找到多个同名玩家，请使用数字鼓众 ID 验证" });
  if (!matches[0]) throw createError({ statusCode: 404, statusMessage: "未找到该鼓众 ID 或昵称，请确认输入是否正确" });
  return { ...matches[0], userid: playerId(matches[0]) };
}
