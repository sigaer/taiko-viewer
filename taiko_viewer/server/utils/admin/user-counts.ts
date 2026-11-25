import type { Pool, RowDataPacket } from "mysql2/promise";

export type UserCountSnapshot = {
  viewerUsers: Array<{ id: string }>;
  viewerBindings: Array<{ user_id: string; taiko_id: string; source: string | null }>;
  botBindings: Array<{ qq: string; id: string; source: string | null }>;
};

type Region = "cn" | "overseas" | "manual";
const gameIdentity = (value: string, source: string | null): { id: string; region: Region } | null => {
  const id = value.trim();
  // Preserve leading zeroes and large IDs. Local manual IDs have their own
  // namespace and never contribute to either regional game population.
  if (!/^[0-9]{1,25}$/.test(id)) return null;
  if (/^98[0-9]{16}$/.test(id)) return { id, region: "manual" };
  if (source === "manual") return null;
  if (source === "hiroba") return { id, region: "overseas" };
  if (source === "wahlap") return { id, region: "cn" };
  if (!source) return { id, region: id.length === 12 ? "overseas" : "cn" };
  return null;
};

const botChannel = (principal: string) => {
  const key = principal.trim();
  if (/^qq_official:[A-Za-z0-9_-]+$/.test(key)) return "official";
  if (/^(?:onebot_v11:)?[0-9]+$/.test(key)) return "qq";
  return null;
};

type Population = Record<Region, Set<string>>;
const population = (): Population => ({ cn: new Set(), overseas: new Set(), manual: new Set() });
const regions = ["cn", "overseas", "manual"] as const;
const intersectionSize = (left: Set<string>, right: Set<string>) => [...left].filter(id => right.has(id)).length;
const populationSize = (sets: Population) => regions.reduce((sum, region) => sum + sets[region].size, 0);

/** Population unit: distinct retained ID, plus Viewer accounts without any ID.
 * Current slot selection never changes the population. Manual and historical
 * Viewer overseas IDs are retained, separately identified, and deduplicated.
 * Channel sets overlap; Viewer-only / shared / Bot-only partition the total.
 */
export const countAdminUsers = (snapshot: UserCountSnapshot) => {
  const viewers = new Set(snapshot.viewerUsers.map(row => row.id));
  const boundViewers = new Set<string>();
  const viewer = population();
  for (const row of snapshot.viewerBindings) {
    const game = gameIdentity(row.taiko_id, row.source);
    if (!viewers.has(row.user_id) || !game) continue;
    viewer[game.region].add(game.id);
    boundViewers.add(row.user_id);
  }

  const bot = population();
  const channels = { official: new Set<string>(), qq: new Set<string>() };
  for (const row of snapshot.botBindings) {
    const channel = botChannel(row.qq);
    const game = gameIdentity(row.id, row.source);
    if (!channel || !game) continue;
    bot[game.region].add(game.id);
    channels[channel].add(`${game.region}:${game.id}`);
  }

  const shared = Object.fromEntries(regions.map(region => [region, intersectionSize(viewer[region], bot[region])])) as Record<Region, number>;
  const linkedUsers = regions.reduce((sum, region) => sum + shared[region], 0);
  const viewerOnlyBoundUsers = populationSize(viewer) - linkedUsers;
  const viewerOnlyUnboundUsers = viewers.size - boundViewers.size;
  const cnIds = new Set([...viewer.cn, ...bot.cn]).size;
  const overseasIds = new Set([...viewer.overseas, ...bot.overseas]).size;
  const manualUsers = new Set([...viewer.manual, ...bot.manual]).size;
  const taikoBindings = cnIds + overseasIds + manualUsers;
  return {
    totalUsers: taikoBindings + viewerOnlyUnboundUsers,
    viewerUsers: viewers.size,
    botUsers: populationSize(bot),
    viewerOnlyUsers: viewerOnlyBoundUsers + viewerOnlyUnboundUsers,
    viewerOnlyBoundUsers,
    viewerOnlyUnboundUsers,
    viewerOnlyCnUsers: viewer.cn.size - shared.cn,
    viewerOnlyOverseasUsers: viewer.overseas.size - shared.overseas,
    viewerOnlyManualUsers: viewer.manual.size - shared.manual,
    linkedUsers,
    botOnlyUsers: populationSize(bot) - linkedUsers,
    botOnlyCnUsers: bot.cn.size - shared.cn,
    botOnlyOverseasUsers: bot.overseas.size - shared.overseas,
    botOnlyManualUsers: bot.manual.size - shared.manual,
    cnUsers: cnIds + viewerOnlyUnboundUsers,
    // The primary overseas metric intentionally covers Bot records only.
    overseasUsers: bot.overseas.size,
    viewerOverseasUsers: viewer.overseas.size,
    viewerManualUsers: viewer.manual.size,
    botManualUsers: bot.manual.size,
    manualUsers,
    officialBotUsers: channels.official.size,
    qqBotUsers: channels.qq.size,
    taikoBindings,
    wahlapBindings: cnIds,
    hirobaBindings: overseasIds
  };
};

/** Use one read-only snapshot for all populations; never query credentials or
 * use verified QQ identity links to change this game-ID-based metric.
 */
export const readAdminUserCounts = async (db: Pick<Pool, "getConnection">) => {
  const connection = await db.getConnection();
  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
    const [viewerUsers] = await connection.query<(RowDataPacket & UserCountSnapshot["viewerUsers"][number])[]>(
      "SELECT CAST(id AS CHAR) AS id FROM web_user_accounts"
    );
    const [viewerBindings] = await connection.query<(RowDataPacket & UserCountSnapshot["viewerBindings"][number])[]>(
      "SELECT CAST(user_id AS CHAR) AS user_id, taiko_id, source FROM web_taiko_bindings"
    );
    const [botBindings] = await connection.query<(RowDataPacket & UserCountSnapshot["botBindings"][number])[]>(
      "SELECT qq, id, source FROM bind"
    );
    const result = countAdminUsers({ viewerUsers, viewerBindings, botBindings });
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
