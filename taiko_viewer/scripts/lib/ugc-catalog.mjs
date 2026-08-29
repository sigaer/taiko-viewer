import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const UGC_DIFFICULTIES = Object.freeze([
  { code: 1, key: "EASY", levelField: "level_1", noteCourse: "Easy" },
  { code: 2, key: "NORMAL", levelField: "level_2", noteCourse: "Normal" },
  { code: 3, key: "HARD", levelField: "level_3", noteCourse: "Hard" },
  { code: 4, key: "ONI", levelField: "level_4", noteCourse: "Oni" },
  { code: 5, key: "EDIT", levelField: "level_5", noteCourse: "Edit" }
]);

const DEFAULT_TAIKO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

export const resolveUgcCatalogPaths = (options = {}) => {
  const taikoRoot = resolve(String(options.taikoRoot || process.env.TAIKO_REPO_ROOT || DEFAULT_TAIKO_ROOT));
  return {
    taikoRoot,
    songDataPath: resolve(String(options.songDataPath || process.env.TAIKO_SONG_DATA_PATH || resolve(taikoRoot, "songs/song_data.json"))),
    ratingPath: resolve(String(options.ratingPath || process.env.TAIKO_RATING_STRUCT_PATH || resolve(taikoRoot, "songs/rating_structured_with_ids.json"))),
    noteCountPath: resolve(String(options.noteCountPath || resolve(taikoRoot, "songs/tja_note_counts.json")))
  };
};

export const buildUgcChartSourceKey = (songId, difficultyCode) => {
  const normalizedSongId = Number(songId);
  const normalizedDifficulty = Number(difficultyCode);
  if (!Number.isInteger(normalizedSongId) || normalizedSongId <= 0) {
    throw new TypeError("songId must be a positive integer");
  }
  if (!UGC_DIFFICULTIES.some((item) => item.code === normalizedDifficulty)) {
    throw new TypeError("difficultyCode must be an integer from 1 to 5");
  }
  return `taiko:${normalizedSongId}:${normalizedDifficulty}`;
};

const isChartLevel = (value) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim();
  return normalized !== "" && normalized !== "-";
};

const normalizeTitle = (value) => String(value || "").trim().normalize("NFKC").toLocaleLowerCase();

const ratingRowsFromPayload = (payload) => {
  const rawSongs = payload?.songs;
  return Array.isArray(rawSongs) ? rawSongs : Object.values(rawSongs || {});
};

const issueCollector = () => {
  const issues = new Map();
  const add = (severity, code, sample) => {
    const key = `${severity}:${code}`;
    const issue = issues.get(key) || { severity, code, count: 0, samples: [] };
    issue.count += 1;
    if (sample !== undefined && issue.samples.length < 8) issue.samples.push(sample);
    issues.set(key, issue);
  };
  return { add, list: () => [...issues.values()].sort((a, b) => a.severity.localeCompare(b.severity) || a.code.localeCompare(b.code)) };
};

const hasNoteCount = (noteCounts, song, difficulty) => {
  const titles = [song.song_name_jp, song.song_name].filter(Boolean).map((value) => String(value).trim());
  return titles.some((title) =>
    Object.keys(noteCounts?.[title] || {}).some(
      (courseLevel) => String(courseLevel).split("|")[0].toLocaleLowerCase() === difficulty.noteCourse.toLocaleLowerCase()
    )
  );
};

export const buildUgcCatalogAudit = ({ songs, ratingsPayload, noteCounts }) => {
  const collector = issueCollector();
  if (!Array.isArray(songs)) {
    throw new TypeError("song_data.json must contain an array");
  }

  const ratingRows = ratingRowsFromPayload(ratingsPayload);
  const ratingPairs = new Map();
  for (const row of ratingRows) {
    const songId = Number(row?.id);
    const difficultyCode = Number(row?.level);
    if (!Number.isInteger(songId) || songId <= 0) {
      collector.add("WARNING", "RATING_SONG_ID_INVALID", { id: row?.id, level: row?.level });
      continue;
    }
    if (!UGC_DIFFICULTIES.some((item) => item.code === difficultyCode)) {
      collector.add("WARNING", "RATING_DIFFICULTY_INVALID", { songId, difficulty: row?.level });
      continue;
    }
    const pair = `${songId}:${difficultyCode}`;
    ratingPairs.set(pair, (ratingPairs.get(pair) || 0) + 1);
  }
  for (const [pair, count] of ratingPairs) {
    if (count > 1) collector.add("WARNING", "RATING_PAIR_DUPLICATE", { pair, count });
  }

  const songIdCounts = new Map();
  const titleIds = new Map();
  const pairCounts = new Map();
  const charts = [];
  let removedSongs = 0;
  let emptyLevels = 0;

  for (const song of songs) {
    const songId = Number(song?.id);
    if (!Number.isInteger(songId) || songId <= 0) {
      collector.add("ERROR", "SONG_ID_INVALID", { id: song?.id, title: song?.song_name || song?.song_name_jp || "" });
      continue;
    }
    songIdCounts.set(songId, (songIdCounts.get(songId) || 0) + 1);
    if (!String(song.song_name || song.song_name_jp || "").trim()) {
      collector.add("ERROR", "SONG_METADATA_MISSING", { songId });
    }
    for (const title of [song.song_name, song.song_name_jp]) {
      const normalized = normalizeTitle(title);
      if (!normalized) continue;
      const ids = titleIds.get(normalized) || new Set();
      ids.add(songId);
      titleIds.set(normalized, ids);
    }

    const inactive = Number(song.shelf_status || 0) === 1;
    if (inactive) removedSongs += 1;
    for (const difficulty of UGC_DIFFICULTIES) {
      const level = song[difficulty.levelField];
      if (!isChartLevel(level)) {
        emptyLevels += 1;
        continue;
      }
      const numericLevel = Number(level);
      if (!Number.isFinite(numericLevel) || numericLevel <= 0) {
        collector.add("ERROR", "CHART_LEVEL_INVALID", { songId, difficultyCode: difficulty.code, level });
        continue;
      }
      const pair = `${songId}:${difficulty.code}`;
      pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
      const status = inactive ? "inactive" : "active";
      const sourceKey = buildUgcChartSourceKey(songId, difficulty.code);
      const chart = {
        songId,
        difficultyCode: difficulty.code,
        difficultyKey: difficulty.key,
        sourceKey,
        status,
        level: numericLevel
      };
      charts.push(chart);

      if (!ratingPairs.has(pair)) collector.add("WARNING", "RATING_MISSING", { songId, difficultyCode: difficulty.code });
      if (!hasNoteCount(noteCounts, song, difficulty)) collector.add("WARNING", "NOTE_COUNT_MISSING", { songId, difficultyCode: difficulty.code });
      if (!Array.isArray(song.max_combo) || !isChartLevel(song.max_combo[difficulty.code - 1])) {
        collector.add("WARNING", "CHART_COMBO_METADATA_MISSING", { songId, difficultyCode: difficulty.code });
      }
    }
  }

  for (const [songId, count] of songIdCounts) {
    if (count > 1) collector.add("ERROR", "SONG_ID_DUPLICATE", { songId, count });
  }
  for (const [pair, count] of pairCounts) {
    if (count > 1) collector.add("ERROR", "CHART_PAIR_DUPLICATE", { pair, count });
  }
  for (const [title, ids] of titleIds) {
    if (ids.size > 1) collector.add("INFO", "SAME_TITLE_MULTIPLE_IDS", { title, songIds: [...ids].sort((a, b) => a - b) });
  }

  charts.sort((a, b) => a.songId - b.songId || a.difficultyCode - b.difficultyCode);
  const revisionInput = charts.map((chart) => `${chart.sourceKey}|${chart.status}`).join("\n");
  const catalogRevision = createHash("sha256").update(revisionInput).digest("hex").slice(0, 32);
  const issues = collector.list();
  const errors = issues.filter((issue) => issue.severity === "ERROR").reduce((sum, issue) => sum + issue.count, 0);
  const warnings = issues.filter((issue) => issue.severity === "WARNING").reduce((sum, issue) => sum + issue.count, 0);
  const duplicatePairs = issues.find((issue) => issue.code === "CHART_PAIR_DUPLICATE")?.count || 0;

  return {
    catalog: { revision: catalogRevision, charts },
    summary: {
      songsScanned: songs.length,
      chartsDiscovered: charts.length,
      activeCharts: charts.filter((chart) => chart.status === "active").length,
      inactiveCharts: charts.filter((chart) => chart.status === "inactive").length,
      removedSongs,
      editCharts: charts.filter((chart) => chart.difficultyCode === 5).length,
      emptyLevels,
      duplicatePairs,
      warnings,
      errors
    },
    issues
  };
};

export const loadUgcCatalogAudit = async (options = {}) => {
  const paths = resolveUgcCatalogPaths(options);
  const [songs, ratingsPayload, noteCounts] = await Promise.all([
    readFile(paths.songDataPath, "utf8").then(JSON.parse),
    readFile(paths.ratingPath, "utf8").then(JSON.parse),
    readFile(paths.noteCountPath, "utf8").then(JSON.parse)
  ]);
  return { paths, ...buildUgcCatalogAudit({ songs, ratingsPayload, noteCounts }) };
};
