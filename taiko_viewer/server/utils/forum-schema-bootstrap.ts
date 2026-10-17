// Explicit administrative bootstrap; no runtime caller.
import { getAccountDb } from "./account-db";
import { CREATE_FORUM_TABLES, FORUM_SCHEMA_MIGRATIONS } from "./forum-schema-definition";
import { FORUM_SECTION_SEEDS } from "~/types/forum";
const runMigration = async (statement: string) => {
  const db = getAccountDb();
  try {
    await db.execute(statement);
  } catch (error: any) {
    const code = String(error?.code || "");
    const errno = Number(error?.errno || 0);
    if (
      code === "ER_DUP_FIELDNAME" ||
      code === "ER_DUP_KEYNAME" ||
      code === "ER_TABLE_EXISTS_ERROR" ||
      errno === 1060 ||
      errno === 1061 ||
      errno === 1050
    ) {
      return;
    }
    throw error;
  }
};

const seedSections = async () => {
  const db = getAccountDb();
  for (const section of FORUM_SECTION_SEEDS) {
    await db.execute(
      `INSERT INTO forum_sections (slug, name, description, icon, accent_color, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         description = VALUES(description),
         icon = VALUES(icon),
         accent_color = VALUES(accent_color),
         sort_order = VALUES(sort_order)`,
      [
        section.slug,
        section.name,
        section.description,
        section.icon,
        section.accentColor,
        section.sortOrder,
      ],
    );
  }
};

export const initializeForumSchema = async () => {
  const db = getAccountDb();
  for (const statement of CREATE_FORUM_TABLES) await db.execute(statement);
  for (const statement of FORUM_SCHEMA_MIGRATIONS) await runMigration(statement);
  await seedSections();
};
