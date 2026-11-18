// Synthetic data for the slice F self-check (dan courses, guides, titles, tools, about, more, alias log, practice view).
// Everything the pages read from files is written here so the real APIs and the real SSR run over it:
//   song_data.json etc.              detail-data.mjs (song catalogue, rating, V2 snapshot, TJA bundle of song 1), plus
//                                    songs whose Japanese titles are real dan course titles (the dan → song detail links)
//   songs/analyze_result_filtered.json   TAIKO_REPO_ROOT   /api/tools/chart-config
//   songs/tja_note_counts.json           TAIKO_REPO_ROOT   /api/tools/note-count
//   <web>/logs/alias_action_log.json     process.cwd()     /api/alias-log (removed again by cleanup())
// Remote sources are answered by a local upstream on 127.0.0.1 (the page's server code is real; only the upstream is
// synthetic): the official title catalogue (TAIKO_TITLE_API_BASE /api/titles), the local title details (TAIKO_API_BASE
// /taiko/title/page) and the guide source (NUXT_PUBLIC_GUIDE_API_BASE /music/musicDetailList). `setUpstream({ titles,
// guide })` switches each to "ok" / "empty" / "fail" for the failed and empty presentations.
import { createServer } from "node:http";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDetailData, writeDetailFiles } from "./detail-data.mjs";

/** Catalogue songs whose Japanese title is a dan course song (2026 九段, 2026 達人 inner oni, 2023 / 2024). */
export const DAN_SONGS = [
  { id: 901, jp: "闇の魔法少女", zh: "暗之魔法少女" },
  { id: 902, jp: "雲の彼方の大地の風", zh: "云彼方大地之风" },
  { id: 903, jp: "タベルナ2000", zh: "タベルナ2000" },
  { id: 904, jp: "Nivalis*Anima", zh: "Nivalis*Anima" },
  { id: 905, jp: "GO GET'EM!", zh: "GO GET'EM!" },
  { id: 906, jp: "RIDGE RACER STEPS", zh: "RIDGE RACER STEPS" },
  // two catalogue songs with the same title: the dan song stays unlinked (no unique match)
  { id: 907, jp: "よーいドン！", zh: "预备咚！" },
  { id: 908, jp: "よーいドン！", zh: "预备咚！（另一版本）" }
];

export function buildPagesData() {
  const data = buildDetailData();
  for (const song of DAN_SONGS) {
    data.songs.push({ id: song.id, song_name: song.zh, song_name_jp: song.jp, type: "南梦宫原创音乐", bpm: "200", open_day: "1/1/2025", shelf_status: 0, level_1: 3, level_2: 5, level_3: 7, level_4: 9, level_5: 10 });
  }
  return data;
}

/** /api/tools/chart-config input. At most 10 matches per query, so the API's random sample never kicks in. */
export const PATTERN_DATA = {
  by_bpm: { 180: ["SongA||Oni", "SongB||Edit"], 150: ["SongC||Hard"], 200: ["SongD||Normal"] },
  by_level: { 10: ["SongA||Oni", "SongB||Edit"], 8: ["SongC||Hard"], 5: ["SongD||Normal"] },
  by_tag: { "16 oxxo": ["SongA||Oni", "SongC||Hard"], "16 oxxoxxoo": ["SongB||Edit"], "12 oxo": ["SongD||Normal"] },
  song_meta: {
    SongA: { song_name: "合成配置曲 A", song_name_jp: "テスト配置 A" },
    SongB: { song_name: "合成配置曲 B 很长的标题用于检查换行 Extended Long Mix", song_name_jp: "テスト配置 B" },
    SongC: { song_name_jp: "テスト配置 C" },
    SongD: { song_name: "合成配置曲 D" }
  }
};
export const CHART_CONFIG_QUERIES = ["16 oxxo", "180", "180 鬼10", "16 oxxo 180 鬼10", "oxxoxx", "12 oxo", "16 xxxx", "16 oxxo 150 松8", "bad query!"];

/** /api/tools/note-count input: 500 and 300 have a few hits, 777 has 25 (truncated to 20), 999 none. */
export function noteCountData() {
  const out = {
    "合成物量曲 A": { "Oni|8": { total: 500 }, "Hard|6": { total: 300 } },
    "合成物量曲 B": { "Edit|10": { total: 500 }, "Normal|4": { total: 120 } },
    "テスト物量 C": { "Easy|2": { total: 300 } }
  };
  for (let i = 1; i <= 25; i++) out[`合成物量曲 ${String(i).padStart(2, "0")}`] = { "Oni|9": { total: 777 } };
  return out;
}
export const NOTE_COUNT_QUERIES = [500, 300, 777, 999, 0];

/** Alias log rows (newest first after the API's sort): 45 rows → 3 pages of 20. */
export function aliasLog() {
  const rows = [];
  for (let i = 0; i < 45; i++) {
    rows.push({
      time: new Date(Date.UTC(2026, 10, 18, 12, 0, 0) - i * 3600_000).toISOString(),
      action: "add",
      user_id: String(10000 + i),
      ...(i % 3 === 0 ? { user_nickname: `合成用户${i}` } : {}),
      ...(i % 4 === 0 ? {} : { group_id: 900000 + i, ...(i % 2 ? { group_name: `合成群 ${i}` } : {}) }),
      song_id: String((i % 60) + 1),
      song_title: i === 7 ? "很长很长的合成曲目标题用于检查别名日志的换行与截断 Extended Long Mix" : `合成曲目 ${(i % 60) + 1}`,
      alias: i === 7 ? "非常长的合成别名用于检查换行非常长的合成别名用于检查换行" : `别名${i}`
    });
  }
  return rows;
}

/** Official title catalogue (plate numbers in and out of the asset map) and the local details for some of them. */
export function titleCatalog() {
  const plates = [0, 1, 2, 41, 42, 43, 59, 60, 61, 3, 7];
  const titles = [];
  for (let i = 1; i <= 130; i++) {
    titles.push({
      id: i,
      name: i === 5 ? "とても長い合成称号の名前でプレートに収まらない場合の確認用テキスト" : i % 7 === 0 ? `合成称号 ${i}` : `テスト称号${i}`,
      rarity: plates[i % plates.length],
      condition: i % 5 === 0 ? "" : `合成条件 ${i}：魔王难度全连 3 首`,
      songIds: i % 3 === 0 ? [i % 60 || 1, ((i + 7) % 60) || 2] : []
    });
  }
  return { titles, total: titles.length };
}

const guideRows = (difficulty, level, tag) => {
  const n = tag === 3 ? 45 : tag === 7 ? 0 : tag + 1; // 强: 45 rows (shown 30 at a time), 逆诈称-: none
  return Array.from({ length: n }, (_, i) => ({
    id: 1000 + i,
    title: i === 0 && tag === 1 ? "很长的合成攻略曲名用于检查表格在窄屏中自身滚动 Extended Long Mix (Long Version)" : `合成攻略曲 ${difficulty}-${level}-${tag}-${i}`,
    bpm: String(120 + i),
    category: "南梦宫原创音乐",
    tag: ["诈称+", "诈称", "强", "中", "弱", "逆诈称", "逆诈称-"][tag - 1],
    feature: i % 2 ? "长连打\n复合节奏" : "高速 16 分交互",
    note_count: 400 + i
  }));
};

/** The synthetic upstream; returns { base, setUpstream, calls, close }. */
export async function startUpstream() {
  const mode = { titles: "ok", guide: "ok" };
  const calls = [];
  const catalog = titleCatalog();
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    calls.push(url.pathname);
    const json = (body, status = 200) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === "/api/titles") {
      if (mode.titles === "fail") return json({ message: "down" }, 503);
      return json(mode.titles === "empty" ? { titles: [], total: 0 } : catalog);
    }
    if (url.pathname === "/taiko/title/page") {
      if (mode.titles === "fail") return json({ code: 1 }, 503);
      const rows = mode.titles === "empty" ? [] : catalog.titles.filter((t) => t.id % 4 === 0).map((t) => ({ id: 5000 + t.id, name: t.name, rarity: t.rarity, condition: `本地条件 ${t.id}`, song_ids: [t.id % 60 || 3] }));
      return json({ code: 0, data: { pageData: rows, total: rows.length } });
    }
    if (url.pathname === "/music/musicDetailList") {
      if (mode.guide === "fail") return json({ message: "down" }, 503);
      const d = Number(url.searchParams.get("difficultyType"));
      const l = Number(url.searchParams.get("level"));
      const tag = Number(url.searchParams.get("levelTag"));
      return json({ data: guideRows(d, l, tag) });
    }
    json({ message: "not found" }, 404);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    calls,
    setUpstream: (next) => Object.assign(mode, next),
    close: () => new Promise((r) => server.close(() => r()))
  };
}

/** Write every file; start the upstream. `web` is the Nuxt app directory (the alias log is read relative to it). */
export async function writePagesFiles(dir, web) {
  const data = buildPagesData();
  const prepared = await writeDetailFiles(dir, data);
  await mkdir(resolve(dir, "songs"), { recursive: true });
  await writeFile(resolve(dir, "songs", "analyze_result_filtered.json"), JSON.stringify(PATTERN_DATA));
  await writeFile(resolve(dir, "songs", "tja_note_counts.json"), JSON.stringify(noteCountData()));
  const logsDir = resolve(web, "logs");
  let createdLogs = false;
  try {
    await stat(logsDir);
  } catch {
    createdLogs = true;
  }
  await mkdir(logsDir, { recursive: true });
  const aliasFile = resolve(logsDir, "alias_action_log.json");
  const writeAlias = async (rows) => writeFile(aliasFile, JSON.stringify(rows));
  await writeAlias(aliasLog());
  const upstream = await startUpstream();
  return {
    ...prepared,
    data,
    upstream,
    aliasFile,
    writeAlias,
    removeAlias: () => rm(aliasFile, { force: true }),
    env: {
      TAIKO_TITLE_API_BASE: upstream.base,
      TAIKO_API_BASE: upstream.base,
      NUXT_PUBLIC_GUIDE_API_BASE: upstream.base
    },
    async cleanup() {
      await upstream.close().catch(() => {});
      await rm(aliasFile, { force: true });
      if (createdLogs) await rm(logsDir, { recursive: true, force: true });
    }
  };
}
