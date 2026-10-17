import type { Pool, RowDataPacket } from "mysql2/promise";
import { createError } from "h3";
import { CREATE_TABLES } from "./account-schema-definition";
import { BETA_TABLES } from "../services/annual-beta/schema";
import { GOAL_TABLE_SQL } from "../services/goals/schema";
import { GROWTH_MEASUREMENT_TABLE_SQL } from "../services/growth-history/schema";
import { GROWTH_RECENT_CURSOR_TABLE_SQL } from "../services/growth-recent/schema";

export type AccountSchemaScope = "legacy" | "source" | "annual";
type Column = { name: string; type: string; nullable: boolean; collation?: string };
export type TableRequirement = { name: string; columns: Column[]; unique: string[][] };
/** Split SQL definitions, respecting type parentheses and quoted defaults. */
export function splitSchemaDefinitions(body: string): string[] {
  const parts: string[] = []; let start = 0, depth = 0, quote = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) { if (body[i + 1] === quote) i++; else quote = ""; } }
    else if (c === "'" || c === '"' || c === "`") quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) { parts.push(body.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(body.slice(start).trim()); return parts;
}
export function schemaRequirement(sql: string): TableRequirement {
  const match = /^CREATE TABLE IF NOT EXISTS ([a-z0-9_]+)\s*\(([\s\S]*)\) ENGINE=/i.exec(sql);
  if (!match) throw new Error("Invalid schema declaration");
  const table: TableRequirement = { name: match[1], columns: [], unique: [] };
  for (const part of splitSchemaDefinitions(match[2])) {
    const key = /^(?:PRIMARY KEY|UNIQUE(?: KEY| INDEX)?(?:\s+\w+)?)\s*\(([^)]+)\)/i.exec(part);
    if (key) { table.unique.push(key[1].split(",").map(x => x.trim().replaceAll("`", ""))); continue; }
    if (/^(?:KEY|INDEX|CONSTRAINT|FOREIGN|CHECK)\b/i.test(part)) continue;
    const column = /^`?([a-z0-9_]+)`?\s+([a-z]+(?:\([^)]*\))?(?:\s+UNSIGNED)?)/i.exec(part);
    if (!column) throw new Error("Invalid schema column");
    const collation = /\bCOLLATE[ =]+([a-z0-9_]+)/i.exec(part)?.[1] || /\) ENGINE=.*?\bCOLLATE[ =]+([a-z0-9_]+)/i.exec(sql)?.[1];
    table.columns.push({ name: column[1], type: column[2].toLowerCase().replace(/\s+/g, " "), nullable: !/\bNOT NULL\b|\bPRIMARY KEY\b/i.test(part), ...(/^(?:char|varchar|text|longtext)/i.test(column[2]) && collation ? {collation} : {}) });
    if (/\bPRIMARY KEY\b|\bUNIQUE\b/i.test(part)) table.unique.push([column[1]]);
  }
  return table;
}
const sourceTables = new Set(["web_data_sync_receipts", "taiko_source_service_grants", "taiko_source_service_grant_audit", "taiko_bot_binding_operations", "taiko_qq_migration_codes", "taiko_hiroba_binding_operations", "taiko_source_lifecycle", "taiko_manual_grant_receipts", "taiko_manual_creations", "web_taiko_binding_revocations", "web_taiko_binding_confirmations"]);
const annual = (name: string) => name.startsWith("web_annual_") || name.startsWith("web_beta_");
const declarations = [...CREATE_TABLES, ...BETA_TABLES, GOAL_TABLE_SQL, GROWTH_MEASUREMENT_TABLE_SQL, GROWTH_RECENT_CURSOR_TABLE_SQL].map(schemaRequirement);
// bind's final identity constraints are supplied by the explicit legacy migration.
const bind: TableRequirement = { name: "bind", columns: [
  { name: "row_id", type: "bigint unsigned", nullable: false }, { name: "qq", type: "varchar(191)", nullable: false },
  { name: "id", type: "varchar(25)", nullable: false }, { name: "visible", type: "tinyint(1)", nullable: true },
  { name: "slot_index", type: "int", nullable: false }, { name: "is_current", type: "tinyint(1)", nullable: false },
  { name: "source", type: "varchar(16)", nullable: false }, { name: "created_at", type: "datetime", nullable: true }
], unique: [["row_id"], ["qq", "slot_index"], ["qq", "id"]] };
export const accountSchemaRequirements = (scope: AccountSchemaScope): TableRequirement[] => [
  ...declarations.filter(t => scope === "source" ? !annual(t.name) : scope === "annual" ? !sourceTables.has(t.name) : !sourceTables.has(t.name) && !annual(t.name)).map(table => {
    // Legacy readers support the deployed 128-char attribution column. Source
    // writes accept longer platform principals and require the explicit widening.
    if (scope !== "source" && table.name === "web_hiroba_credentials") return { ...table, columns: table.columns.map(c => c.name === "configured_by_qq" ? { ...c, type: "varchar(128)" } : c) };
    return table;
  }), bind
];
export function compatibleColumnType(required: string, actual: string): boolean {
  const normalize = (x: string) => x.toLowerCase().replace(/\b(tinyint|smallint|mediumint|int|bigint)\(\d+\)/g, "$1").replace(/\s+/g, " ");
  if (normalize(required) === normalize(actual)) return true;
  // Legacy bind.visible is nullable INT; both readers treat NULL as false and
  // writers use only 0/1. Wider signed integer storage preserves that range.
  const integers = ["tinyint", "smallint", "mediumint", "int", "bigint"];
  const ri = integers.indexOf(normalize(required)), ai = integers.indexOf(normalize(actual));
  if (ri >= 0 && ai >= ri) return true;
  const r = /^(?:var)?char\((\d+)\)$/.exec(required), a = /^(?:var)?char\((\d+)\)$/.exec(actual);
  return Boolean(r && a && Number(a[1]) >= Number(r[1]));
}
export const compatibleColumnCollation = (table: string, required: string | undefined, actual: string) => !required || required === actual ||
  // These two deployed legacy tables use MySQL 8's default Unicode collation.
  // Their identity/hash values are canonical digits/hex; keep existing nickname
  // comparison semantics. New binary Source receipt/grant columns remain exact.
  (["taiko_manual_accounts", "taiko_manual_claim_codes"].includes(table) && required === "utf8mb4_general_ci" && actual === "utf8mb4_0900_ai_ci");
const validated = new WeakMap<object, Map<string, { until: number; promise: Promise<void> }>>();
export const clearAccountSchemaValidation = (db: object | null) => { if (db) validated.delete(db); };
/** No schema mutation, seed, migration, or repair DML is reachable here. */
export async function validateSchemaTables(db: Pick<Pool, "query">, required: TableRequirement[], scope: string) {
  let cache = validated.get(db); if (!cache) { cache = new Map(); validated.set(db, cache); }
  const previous = cache.get(scope); if (previous && previous.until > Date.now()) return previous.promise;
  const promise = (async () => {
    try {
      const names = required.map(t => t.name);
      const [columns] = await db.query<RowDataPacket[]>("SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?)", [names]);
      const [indexes] = await db.query<RowDataPacket[]>("SELECT TABLE_NAME,INDEX_NAME,COLUMN_NAME,SEQ_IN_INDEX,SUB_PART FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND NON_UNIQUE=0 AND TABLE_NAME IN (?) ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX", [names]);
      for (const table of required) {
        const found = new Map(columns.filter(c => c.TABLE_NAME === table.name).map(c => [c.COLUMN_NAME, c]));
        for (const column of table.columns) {
          const actual = found.get(column.name);
          if (!actual || !compatibleColumnType(column.type, String(actual.COLUMN_TYPE)) || (!column.nullable && actual.IS_NULLABLE !== "NO") || !compatibleColumnCollation(table.name, column.collation, String(actual.COLLATION_NAME))) throw new Error("Schema mismatch");
        }
        const keys = new Map<string, string[]>();
        const prefixed = new Set(indexes.filter(i => i.TABLE_NAME === table.name && i.SUB_PART !== null).map(i => String(i.INDEX_NAME)));
        for (const row of indexes.filter(i => i.TABLE_NAME === table.name && !prefixed.has(String(i.INDEX_NAME)))) { const key = String(row.INDEX_NAME); const cols = keys.get(key) || []; cols.push(String(row.COLUMN_NAME)); keys.set(key, cols); }
        for (const unique of table.unique) if (![...keys.values()].some(cols => cols.join(",") === unique.join(","))) throw new Error("Schema identity constraint mismatch");
      }
    } catch {
      throw createError({ statusCode: 503, statusMessage: "数据服务暂不可用，请稍后重试", data: { code: "ACCOUNT_SCHEMA_UNAVAILABLE", capability: scope } });
    }
  })();
  cache.set(scope, { until: Date.now() + 30_000, promise });
  try { await promise; } catch (error) { cache.delete(scope); throw error; }
}

export const validateAccountSchema = (db: Pick<Pool, "query">, scope: AccountSchemaScope = "legacy") => validateSchemaTables(db, accountSchemaRequirements(scope), scope);
