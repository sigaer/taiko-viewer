import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getContentRuntimePaths } from "~/server/services/content/runtime";

const COURSE_MAP: Record<string, string> = {
  Edit: "里谱",
  Oni: "魔王",
  Hard: "困难",
  Normal: "一般",
  Easy: "简单"
};

type NoteCountData = Record<string, Record<string, Record<string, number>>>;

let noteCountCache: NoteCountData | null = null;

const loadNoteCountData = async () => {
  if (noteCountCache) {
    return noteCountCache;
  }
  const { repoRoot } = getContentRuntimePaths();
  const filePath = resolve(repoRoot, "songs", "tja_note_counts.json");
  const raw = await readFile(filePath, "utf-8");
  noteCountCache = JSON.parse(raw) as NoteCountData;
  return noteCountCache;
};

export type NoteCountResult = {
  total: number;
  items: Array<{ title: string; course: string }>;
  truncated: boolean;
};

export const queryNoteCount = async (count: number): Promise<NoteCountResult> => {
  if (!Number.isFinite(count) || count < 0) {
    throw createError({ statusCode: 400, statusMessage: "物量必须为非负整数" });
  }

  const data = await loadNoteCountData();
  const hits: Array<{ title: string; course: string }> = [];

  for (const [title, courses] of Object.entries(data)) {
    for (const [courseLevel, counts] of Object.entries(courses)) {
      const courseKey = courseLevel.split("|")[0];
      const course = COURSE_MAP[courseKey] || courseKey;
      const value = counts.total;
      if (value === undefined || value === null) {
        continue;
      }
      if (Number(value) === count) {
        hits.push({ title, course });
      }
    }
  }

  hits.sort((a, b) => a.title.localeCompare(b.title) || a.course.localeCompare(b.course));

  if (!hits.length) {
    return { total: 0, items: [], truncated: false };
  }

  const truncated = hits.length > 20;
  return {
    total: hits.length,
    items: hits.slice(0, 20),
    truncated
  };
};
