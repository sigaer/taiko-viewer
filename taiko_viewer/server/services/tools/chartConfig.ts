import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getContentRuntimePaths } from "~/server/services/content/runtime";

const BPM_RE = /^\d+(?:-\d+)?$/;
const PATTERN_RE = /^[ox]+$/i;
const LEVEL_RE = /^[鬼松竹梅]\d+$/;

const LEVEL_MAP: Record<string, string> = {
  松: "ard",
  竹: "mal",
  梅: "asy"
};

const LETTER_MAP: Record<string, string> = {
  Edit: "里谱",
  Oni: "魔王",
  Hard: "困难",
  Normal: "一般",
  Easy: "简单"
};

type ParsedQuery =
  | { mode: "bpm_only"; bpmStr: string }
  | { mode: "bpm_level_only"; bpmStr: string; level: string }
  | { mode: "pattern"; division: string; patternName: string; bpmStr?: string; level?: string };

type PatternData = {
  by_bpm: Record<string, string[]>;
  by_level: Record<string, string[]>;
  by_tag: Record<string, string[]>;
  song_meta: Record<string, { song_name?: string; song_name_jp?: string }>;
};

export type ChartConfigResult = {
  lines: string[];
};

let patternCache: PatternData | null = null;

const loadPatternData = async (): Promise<PatternData> => {
  if (patternCache) {
    return patternCache;
  }
  const { repoRoot } = getContentRuntimePaths();
  const filePath = resolve(repoRoot, "songs", "analyze_result_filtered.json");
  const raw = await readFile(filePath, "utf-8");
  patternCache = JSON.parse(raw) as PatternData;
  return patternCache;
};

export const parseChartConfigQuery = (commandText: string): ParsedQuery | null => {
  const argsText = commandText.replace(/^查配置\s*/i, "").trim();
  if (!argsText) {
    return null;
  }

  const tokens = argsText.split(/\s+/);
  if (tokens.length === 1 && BPM_RE.test(tokens[0])) {
    return { mode: "bpm_only", bpmStr: tokens[0] };
  }
  if (
    tokens.length === 2 &&
    tokens.some((token) => BPM_RE.test(token)) &&
    tokens.some((token) => LEVEL_RE.test(token))
  ) {
    return {
      mode: "bpm_level_only",
      bpmStr: tokens.find((token) => BPM_RE.test(token))!,
      level: tokens.find((token) => LEVEL_RE.test(token))!
    };
  }

  let division = "16";
  let tokenIndex = 0;
  if (tokens.length >= 2 && BPM_RE.test(tokens[0]) && PATTERN_RE.test(tokens[1])) {
    division = tokens[0];
    tokenIndex = 1;
  }

  if (tokenIndex >= tokens.length) {
    return null;
  }

  const patternName = tokens[tokenIndex].toLowerCase();
  if (!PATTERN_RE.test(patternName)) {
    return null;
  }

  let bpmStr: string | undefined;
  let level: string | undefined;
  const remainTokens = tokens.slice(tokenIndex + 1);
  if (remainTokens.length) {
    const first = remainTokens.shift()!;
    if (BPM_RE.test(first)) {
      bpmStr = first;
      if (remainTokens.length) {
        const second = remainTokens.shift()!;
        if (!LEVEL_RE.test(second)) {
          return null;
        }
        level = second;
      }
    } else if (LEVEL_RE.test(first)) {
      level = first;
    } else {
      return null;
    }
  }

  if (remainTokens.length) {
    return null;
  }

  return { mode: "pattern", division, patternName, bpmStr, level };
};

const parseBpmRange = (bpmStr?: string): [number, number] | null => {
  if (!bpmStr) {
    return null;
  }
  if (bpmStr.includes("-")) {
    const [lo, hi] = bpmStr.split("-", 2).map((value) => Number(value));
    return [Math.min(lo, hi), Math.max(lo, hi)];
  }
  const bpm = Number(bpmStr);
  return [bpm, bpm];
};

const collectBpmIds = (byBpm: Record<string, string[]>, bpmRange: [number, number] | null) => {
  if (!bpmRange) {
    return new Set<string>();
  }
  const ids = new Set<string>();
  for (let bpm = bpmRange[0]; bpm <= bpmRange[1]; bpm += 1) {
    const list = byBpm[String(bpm)];
    if (list) {
      list.forEach((id) => ids.add(id));
    }
  }
  return ids;
};

const collectLevelIds = (byLevel: Record<string, string[]>, level?: string) => {
  if (!level) {
    return new Set<string>();
  }
  const levelNumber = level.slice(1);
  const levelRank = level[0];
  const targetDiff = byLevel[String(levelNumber)] || [];

  if (levelRank === "鬼") {
    return new Set(targetDiff.filter((id) => id.endsWith("dit") || id.endsWith("Oni")));
  }

  const suffix = LEVEL_MAP[levelRank] || "";
  return new Set(targetDiff.filter((id) => id.slice(-3) === suffix));
};

const resolveSongName = (songMeta: PatternData["song_meta"], title: string) => {
  const meta = songMeta[title] || {};
  return meta.song_name || meta.song_name_jp || title;
};

const sampleItems = <T>(items: T[], limit = 10) => {
  if (items.length <= limit) {
    return items;
  }
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, limit);
};

const formatItems = (ids: string[], songMeta: PatternData["song_meta"]) =>
  ids.map((songId) => {
    const [title, course] = songId.split("||", 2);
    return `${resolveSongName(songMeta, title)} ${LETTER_MAP[course] || course}`;
  });

export const queryChartConfig = async (queryText: string): Promise<ChartConfigResult> => {
  const parsed = parseChartConfigQuery(queryText.trim());
  if (!parsed) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "格式不正确，应为：查配置 [分音符] 配置 [BPM] [难度]；省略分音符时默认按16分，也可仅输入 BPM 或 BPM+难度。"
    });
  }

  const patternData = await loadPatternData();
  const { by_bpm: byBpm, by_level: byLevel, by_tag: byTag, song_meta: songMeta } = patternData;
  const bpmRange = parseBpmRange(
    parsed.mode === "pattern" ? parsed.bpmStr : parsed.bpmStr
  );

  if (parsed.mode === "bpm_only") {
    const bpmIds = collectBpmIds(byBpm, bpmRange);
    if (!bpmIds.size) {
      return { lines: ["未找到满足该 BPM 条件的歌曲。"] };
    }
    const songNames = [...new Set([...bpmIds].map((id) => resolveSongName(songMeta, id.split("||", 1)[0])))].sort();
    const songShow = sampleItems(songNames, 10);
    const lines = ["为您找到以下歌曲：", `【BPM匹配】${songNames.length} 首`];
    if (songNames.length > 10) {
      lines.push("（随机返回10条）");
    }
    lines.push(...songShow);
    return { lines };
  }

  if (parsed.mode === "bpm_level_only") {
    const matchedIds = [...collectBpmIds(byBpm, bpmRange)].filter((id) => collectLevelIds(byLevel, parsed.level).has(id));
    if (!matchedIds.length) {
      return { lines: ["未找到满足该 BPM 和难度条件的谱面。"] };
    }
    const matchShow = sampleItems(matchedIds, 10);
    const lines = ["为您找到以下谱面：", `【BPM+难度匹配】${matchedIds.length} 条`];
    if (matchedIds.length > 10) {
      lines.push("（随机返回10条）");
    }
    lines.push(...formatItems(matchShow, songMeta));
    return { lines };
  }

  const dp = `${parsed.division} ${parsed.patternName}`;
  const exactList = byTag[dp] || [];
  const exactSet = new Set(exactList);

  const substrSet = new Set<string>();
  if (parsed.patternName.length >= 6) {
    const prefix = `${parsed.division} `;
    for (const [tagKey, ids] of Object.entries(byTag)) {
      if (!tagKey.startsWith(prefix)) {
        continue;
      }
      const longPat = tagKey.slice(prefix.length).toLowerCase();
      if (longPat.includes(parsed.patternName)) {
        ids.forEach((id) => substrSet.add(id));
      }
    }
    substrSet.forEach((id) => {
      if (exactSet.has(id)) {
        substrSet.delete(id);
      }
    });
  }

  if (!exactSet.size && !substrSet.size) {
    return { lines: ["未找到匹配的谱面"] };
  }

  const applyFilters = (songIds: Set<string>) => {
    let filtered = new Set(songIds);
    if (bpmRange) {
      const bpmIds = collectBpmIds(byBpm, bpmRange);
      filtered = new Set([...filtered].filter((id) => bpmIds.has(id)));
    }
    if (parsed.level) {
      const levelIds = collectLevelIds(byLevel, parsed.level);
      filtered = new Set([...filtered].filter((id) => levelIds.has(id)));
    }
    return [...filtered];
  };

  const exactRes = applyFilters(exactSet);
  const substrRes = applyFilters(substrSet);
  if (!exactRes.length && !substrRes.length) {
    return { lines: ["未找到满足该条件的谱面。"] };
  }

  const lines = ["为您找到以下谱面："];
  if (exactRes.length) {
    lines.push(`\n【精确匹配】${exactRes.length} 条`);
    if (exactRes.length > 10) {
      lines.push("（随机返回10条）");
    }
    lines.push(...formatItems(sampleItems(exactRes, 10), songMeta));
  }
  if (parsed.patternName.length >= 6 && substrRes.length) {
    lines.push(`\n【子串匹配】${substrRes.length} 条`);
    if (substrRes.length > 10) {
      lines.push("（随机返回10条）");
    }
    lines.push(...formatItems(sampleItems(substrRes, 10), songMeta));
  }
  return { lines };
};
