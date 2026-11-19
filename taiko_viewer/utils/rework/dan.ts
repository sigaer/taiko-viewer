// Slice F: pure helpers of the dan course pages (/grade/2023 … /grade/2026/:grade).
// The data is what the existing files give (assets/data/grade_dojo_nijiiro_{2025,2026}.json: wiki pages captured as
// HTML fragments; utils/gradeDojoLegacy.ts for 2023 / 2024). Nothing is invented: the song list and the pass
// conditions are read out of the fragments' own tables; when a table does not have the expected shape the fragment is
// shown as it is. No dan badges, personal pass records or pass statistics (RK-46: no data source).
// The fragments are wiki text in Japanese or Chinese, so the patterns below are regular expressions over that text.

export type GradeSectionBlock = { type: string; html: string };
export type GradeSectionTab = { title: string; html: string };
export type GradeSection = { title: string; blocks: GradeSectionBlock[]; tabs?: GradeSectionTab[] };
export type GradePage = {
  slug: string;
  title: string;
  displayTitle: string;
  sourceUrl: string;
  lastModified: string;
  navigationHtml: string;
  sections: GradeSection[];
};
export type GradeGroup = { key: "kyu" | "dan" | "jin"; items: readonly string[] };

/** Dan years in the version switch, newest first. Every one has a page; 2025 / 2026 redirect to their first grade. */
export const DAN_YEARS = ["2026", "2025", "2024", "2023"] as const;
export type DanYear = (typeof DAN_YEARS)[number];

// ---------- A small reader for the fragments' tables (no DOM: the same code runs in SSR and in the browser) ----------

export type Cell = { html: string; text: string; rowspan: number; colspan: number; style: string };
export type Table = { head: Cell[][]; body: Cell[][]; foot: Cell[][] };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
export const decodeEntities = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[name.toLowerCase()] ?? all;
  });
/** Visible text of a fragment: tags removed, entities decoded, whitespace collapsed. */
export const htmlText = (html: string) => decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i"))?.[1] ?? "";

function rows(section: string): Cell[][] {
  return [...section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...row[1].matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map((cell) => ({
      html: cell[3],
      text: htmlText(cell[3]),
      rowspan: Math.max(1, Number(attr(cell[2], "rowspan")) || 1),
      colspan: Math.max(1, Number(attr(cell[2], "colspan")) || 1),
      style: attr(cell[2], "style")
    }))
  );
}

/** The first table of a fragment, or null. Tables are not nested in these fragments. */
export function readTable(html: string): Table | null {
  const table = html.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table) return null;
  const part = (name: string) => table.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";
  const body = part("tbody") || (!/<thead|<tfoot/i.test(table) ? table : "");
  return { head: rows(part("thead")), body: rows(body), foot: rows(part("tfoot")) };
}

/** Expand row and column spans: grid[r][c] is the cell covering that position (the same object across its span). */
export function expandGrid(body: Cell[][]): Cell[][] {
  const grid: Cell[][] = [];
  body.forEach((row, r) => {
    grid[r] ||= [];
    let c = 0;
    for (const cell of row) {
      while (grid[r][c]) c++;
      for (let dr = 0; dr < cell.rowspan; dr++) {
        grid[r + dr] ||= [];
        for (let dc = 0; dc < cell.colspan; dc++) grid[r + dr][c + dc] = cell;
      }
      c += cell.colspan;
    }
  });
  return grid;
}

/** Text before the fragment's first table inside its first list item ("楽曲情報", "合格条件", "補足" …). */
export const blockLabel = (html: string) => htmlText(html.match(/<li>([\s\S]*?)(?:<div|<table|<ul|<\/li>)/i)?.[1] ?? "");

// ---------- Songs ----------

export type DanSong = {
  /** "1曲目" / "第1曲" as written */
  order: string;
  /** title as written, with the inner-oni suffix */
  title: string;
  /** title without the inner-oni suffix (what the song catalogue holds) */
  matchTitle: string;
  /** link of the title in the fragment (the wiki page of the chart), or null */
  href: string | null;
  difficulty: number | null;
  star: number | null;
  /** difficulty text as written, for the cases the reader does not understand */
  difficultyText: string;
  combo: string;
  bpm: string;
};
export type DanSongTable = { label: string; songs: DanSong[]; totalCombo: string | null };

const URA = /[(（]\s*裏譜面\s*[)）]\s*$/;
/** Difficulty words of both fragment languages → difficulty type (1–4); the inner-oni suffix makes oni 5. */
export function danDifficulty(text: string, title = ""): { difficulty: number | null; star: number | null } {
  const star = Number(text.match(/★\s*[×x✕]?\s*(\d{1,2})/)?.[1]) || null;
  let difficulty: number | null = null;
  if (/^\s*(かんたん|简单|簡単|梅)/.test(text)) difficulty = 1;
  else if (/^\s*(ふつう|普通|竹)/.test(text)) difficulty = 2;
  else if (/^\s*(むずかしい|困难|难|難|松)/.test(text)) difficulty = 3;
  else if (/^\s*(おに|鬼|魔王)/.test(text)) difficulty = URA.test(title) ? 5 : 4;
  else if (/^\s*(裏|里)/.test(text)) difficulty = 5;
  return { difficulty, star };
}

/** The song table ("曲名 | 難易度 | 最大コンボ数 | BPM"), or null when the fragment is something else. */
export function readSongTable(html: string): DanSongTable | null {
  const table = readTable(html);
  if (!table || !table.body.length) return null;
  const head = table.head[0]?.map((c) => c.text).join("|") || "";
  if (!/曲名/.test(head) || !/BPM/i.test(head)) return null;
  const songs: DanSong[] = [];
  for (const row of table.body) {
    if (row.length !== 5) return null;
    const [order, name, diff, combo, bpm] = row;
    const title = name.text;
    if (!title) return null;
    const href = name.html.match(/<a\b[^>]*\shref="([^"]*)"/i)?.[1] || null;
    songs.push({
      order: order.text,
      title,
      matchTitle: title.replace(URA, "").trim(),
      href: href && href !== "#" ? decodeEntities(href) : null,
      ...danDifficulty(diff.text, title),
      difficultyText: diff.text,
      combo: combo.text,
      bpm: bpm.text
    });
  }
  const foot = table.foot[0];
  const totalCombo = foot && foot.length >= 3 ? foot[foot.length - 2]?.text || null : null;
  return { label: blockLabel(html), songs, totalCombo: totalCombo && totalCombo !== "-" ? totalCombo : null };
}

// ---------- Pass conditions ----------

export type DanTierKind = "pass" | "gold" | "other";
export type DanConditionTier = {
  kind: DanTierKind;
  /** tier name as written ("合格条件", "金合格条件") */
  label: string;
  /** per condition column: one value, or one value per row of the tier (the per-song roll counts) */
  values: string[][];
};
export type DanConditions = { label: string; columns: string[]; tiers: DanConditionTier[] };

const tierKind = (cell: Cell): DanTierKind =>
  /f6d011/i.test(cell.style) || /^金/.test(cell.text) ? "gold" : /e42112/i.test(cell.style) || /合格/.test(cell.text) ? "pass" : "other";

/** The pass condition table: a header row of condition names and one group of rows per tier. */
export function readConditions(html: string): DanConditions | null {
  const table = readTable(html);
  if (!table || !table.body.length) return null;
  const header = table.head[0];
  if (!header || header.length < 2) return null;
  const columns = header.slice(1).map((c) => c.text);
  const grid = expandGrid(table.body);
  const width = columns.length + 1;
  const tiers: DanConditionTier[] = [];
  let r = 0;
  while (r < grid.length) {
    const row = grid[r];
    if (!row || row.length !== width || row.some((c) => !c)) return null;
    const lead = row[0];
    const span = lead.rowspan;
    const values: string[][] = [];
    for (let c = 1; c < width; c++) {
      const seen: Cell[] = [];
      for (let k = r; k < r + span; k++) {
        const cell = grid[k]?.[c];
        if (!cell || grid[k][0] !== lead) return null;
        if (!seen.includes(cell)) seen.push(cell);
      }
      values.push(seen.map((cell) => cell.text));
    }
    tiers.push({ kind: tierKind(lead), label: lead.text, values });
    r += span;
  }
  if (!tiers.length || tiers.some((t) => t.kind === "other")) return null;
  return { label: blockLabel(html), columns, tiers };
}

// ---------- Neighbours (the fragment's navigation table) ----------

export type DanLink = { label: string; to: string | null };
export type DanNeighbours = { prevGrade: DanLink | null; nextGrade: DanLink | null; prevYear: DanLink | null; nextYear: DanLink | null };

const linkOf = (cell: Cell | undefined): DanLink | null => {
  if (!cell || !cell.text || cell.text === "-") return null;
  const href = cell.html.match(/<a\b[^>]*\shref="([^"]*)"/i)?.[1] ?? "";
  // Only site paths become links; "#" placeholders (2023 / 2024) stay text.
  return { label: cell.text, to: /^\/grade\//.test(href) ? decodeURIComponent(href) : null };
};
/** Previous / next grade and year from the navigation fragment ("←前へ | | 次へ→"). */
export function readNeighbours(html: string): DanNeighbours {
  const body = readTable(html)?.body ?? [];
  const [grades, years] = body;
  return {
    prevGrade: linkOf(grades?.[0]),
    nextGrade: linkOf(grades?.[2]),
    prevYear: linkOf(years?.[0]),
    nextYear: linkOf(years?.[2])
  };
}

// ---------- Course view ----------

export type DanCourse = {
  songs: DanSongTable | null;
  conditions: DanConditions | null;
  /** remaining fragments of the first section ("補足", "連打条件詳細" …), shown as they are */
  details: string[];
};

/** Song table and pass conditions out of the first section; the fragments that do not parse stay in `details`. */
export function danCourse(page: Pick<GradePage, "sections">): DanCourse {
  const first = page.sections[0];
  const out: DanCourse = { songs: null, conditions: null, details: [] };
  for (const block of first?.blocks ?? []) {
    if (!out.songs) {
      const songs = readSongTable(block.html);
      if (songs) {
        out.songs = songs;
        continue;
      }
    }
    if (!out.conditions && /^合格条件/.test(blockLabel(block.html))) {
      const conditions = readConditions(block.html);
      if (conditions) {
        out.conditions = conditions;
        continue;
      }
    }
    out.details.push(block.html);
  }
  return out;
}

/**
 * Wiki markup → markup for the page. Inline colours are replaced by a data attribute the page styles with tokens
 * (tier cells, the shaded "精度曲" cells, separators, coloured emphasis); the "#" placeholder links of 2023 / 2024
 * become plain text. Everything else stays as written.
 */
export function danRichHtml(html: string): string {
  return html
    .replace(/<a\b[^>]*\shref="#"[^>]*>([\s\S]*?)<\/a>/gi, "<span>$1</span>")
    .replace(/\sstyle="([^"]*)"/gi, (_all, style: string) => {
      const s = style.toLowerCase();
      if (/display\s*:\s*none/.test(s)) return ' hidden=""';
      if (/e42112/.test(s)) return ' data-dan-tone="pass"';
      if (/f6d011/.test(s)) return ' data-dan-tone="gold"';
      if (/e6e6e6/.test(s)) return ' data-dan-tone="shade"';
      if (/d0d8e0/.test(s)) return ' data-dan-tone="rule"';
      if (/(^|;)\s*color\s*:/.test(s)) return ' data-dan-tone="mark"';
      return "";
    });
}

// ---------- Song catalogue matching (links to song detail) ----------

const norm = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
export type CatalogSong = { id: number; song_name: string; song_name_jp?: string };
/** The catalogue song whose Japanese or Chinese title is exactly the dan song's title; null when none or several. */
export function matchCatalogSong(title: string, candidates: readonly CatalogSong[]): CatalogSong | null {
  const want = norm(title);
  if (!want) return null;
  const hits = candidates.filter((song) => norm(song.song_name_jp || "") === want || norm(song.song_name || "") === want);
  const ids = new Set(hits.map((song) => Number(song.id)));
  return ids.size === 1 ? hits[0] : null;
}

/** Song detail address for a matched dan song (the dan's difficulty preselected). */
export const danSongLocation = (id: number, difficulty: number | null) =>
  difficulty ? `/songs/${id}?difficulty=${difficulty}` : `/songs/${id}`;

/** Titles to look up in the catalogue for a course (useDanSongLinks). */
export const danSongTitles = (page: Pick<GradePage, "sections"> | undefined) =>
  page ? (danCourse(page).songs?.songs ?? []).map((song) => song.matchTitle) : [];
