import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import { getOfficialTitlesContent } from "~/server/services/content/titles";
import { getRuntimePaths } from "~/server/internal/account/shared";

export const CUSTOM_TITLE_MAX_LENGTH = 30;

export type CustomTitleRow = RowDataPacket & {
  id: number;
  title_name: string;
  title_key: string;
  song_id: number;
  difficulty_level: number;
  achievement_type: "clear" | "full_combo" | "all_perfect";
  creator_type: string;
  creator_id: string;
  creator_name: string;
  source: string;
  group_id: string | null;
  group_name: string | null;
  created_at: string;
  updated_at: string;
};

export const normalizeCustomTitleName = (value: unknown) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();

export const normalizeCustomTitleKey = (value: unknown) =>
  normalizeCustomTitleName(value).toLocaleLowerCase();

export const readAllCustomTitleRows = async () => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<CustomTitleRow[]>(
    `SELECT id, title_name, title_key, song_id, difficulty_level, achievement_type,
            creator_type, creator_id, creator_name, source, group_id, group_name,
            created_at, updated_at
       FROM taiko_custom_titles
      ORDER BY id ASC`
  );
  return rows;
};

export const getCustomTitleCatalogFingerprint = async () => {
  const { repoRoot } = getRuntimePaths();
  const [rows, plateHashes] = await Promise.all([
    readAllCustomTitleRows(),
    Promise.all(
      [
        "name_plate_custom_sliver.png",
        "name_plate_custom_gold.png",
        "name_plate_custom_rainbow.png"
      ].map(async (filename) => {
        try {
          const content = await readFile(resolve(repoRoot, "assets", "name_plate_custom", filename));
          return createHash("sha1").update(content).digest("hex").slice(0, 12);
        } catch {
          return `missing:${filename}`;
        }
      })
    )
  ]);
  return createHash("sha1")
    .update(
      JSON.stringify(
        {
          titles: rows.map((row) => [
            Number(row.id),
            row.title_name,
            Number(row.song_id),
            Number(row.difficulty_level),
            row.achievement_type,
            String(row.updated_at || "")
          ]),
          plates: plateHashes
        }
      )
    )
    .digest("hex")
    .slice(0, 16);
};

let officialTitleKeysCache: { expiresAt: number; keys: Set<string> } | null = null;

export const getOfficialTitleKeys = async () => {
  if (officialTitleKeysCache && officialTitleKeysCache.expiresAt > Date.now()) {
    return officialTitleKeysCache.keys;
  }
  const payload = await getOfficialTitlesContent();
  const keys = new Set(
    (payload.titles || [])
      .map((item) => normalizeCustomTitleKey(item?.name))
      .filter(Boolean)
  );
  officialTitleKeysCache = { expiresAt: Date.now() + 60_000, keys };
  return keys;
};
