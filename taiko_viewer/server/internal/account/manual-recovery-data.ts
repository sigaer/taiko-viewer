import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client";
import { decodeSqlRecoveryBackup } from "../../infrastructure/taiko-publication/sql-backup";
import type { SourceLifecycleReceipt } from "./source-lifecycle";

export type RecoveryRow = Record<string, string | number | null>;
export type ManualRecoveryData = {
  schema: 1; manualAccount: RecoveryRow; bindings: RecoveryRow[]; botBindings: RecoveryRow[];
  products: { goals: RecoveryRow[]; measurements: RecoveryRow[]; cursors: RecoveryRow[]; titles: RecoveryRow[]; locks: RecoveryRow[] };
};
// Explicit schema allowlists: recovery data cannot supply SQL table/column names.
export const RECOVERY_COLUMNS = {
  taiko_manual_accounts: "taiko_id nickname bot_identity_key created_by created_at updated_at",
  web_taiko_bindings: "id user_id taiko_id source manual_account_id is_current verified_title verified_titleplate_id mydon_showcase_layout created_at updated_at",
  bind: "row_id qq id source visible slot_index is_current created_at",
  web_player_goals: "id user_id binding_id song_id difficulty_type goal_type source source_basis source_mode source_rank source_revision source_generated_at status active_binding_id baseline_version goal_data created_at updated_at cancelled_at completed_at",
  web_growth_measurements: "id user_id binding_id score_revision measurement_version algorithm_version model_revision rating dimensions_json focus sample_count availability_state captured_at created_at",
  web_growth_recent_cursors: "user_id binding_id cursor_token observation_revision observation_observed_at algorithm_version created_at updated_at",
  web_taiko_binding_mydon_showcase_titles: "id binding_id slot_index title_name created_at updated_at",
  web_song_locks: "id user_id taiko_id song_no level is_locked created_at updated_at"
} as const;
export const RECOVERY_PRODUCT_TABLES = {
  goals: "web_player_goals", measurements: "web_growth_measurements", cursors: "web_growth_recent_cursors",
  titles: "web_taiko_binding_mydon_showcase_titles", locks: "web_song_locks"
} as const;
export type RecoveryTable = keyof typeof RECOVERY_COLUMNS;
const unavailable = () => { throw new PublicationUnavailableError(); };
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return unavailable();
  return value as Record<string, unknown>;
};
const exactKeys = (value: Record<string, unknown>, keys: string) => {
  if (Object.keys(value).sort().join(" ") !== keys.split(" ").sort().join(" ")) unavailable();
};
const positiveId = (value: unknown) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) return unavailable();
  return value;
};
const identityKey = (value: unknown) => {
  if (typeof value !== "string" || !value.includes(":") || value.trim() !== value || value.length > 191) return unavailable();
  return value;
};
function rows(value: unknown, table: RecoveryTable, limit: number) {
  if (!Array.isArray(value) || value.length > limit) return unavailable();
  const allowed = new Set(RECOVERY_COLUMNS[table].split(" "));
  const primary = table === "bind" ? "row_id" : table === "web_growth_recent_cursors" ? "binding_id" : table === "taiko_manual_accounts" ? "taiko_id" : "id";
  const seen = new Set<unknown>();
  return value.map(item => {
    const row = record(item);
    if (Object.entries(row).some(([key, field]) => !allowed.has(key) ||
      !(field === null || typeof field === "string" || (typeof field === "number" && Number.isFinite(field))))) unavailable();
    if (table !== "taiko_manual_accounts") positiveId(row[primary]);
    if (seen.has(row[primary])) unavailable();
    seen.add(row[primary]);
    return row as RecoveryRow;
  });
}

export function decodeManualRecoveryData(value: unknown, checksum: string, receipt: SourceLifecycleReceipt): ManualRecoveryData {
  const raw = record(decodeSqlRecoveryBackup(value, checksum));
  exactKeys(raw, "schema manualAccount bindings botBindings products");
  if (raw.schema !== 1) unavailable();
  const [account] = rows([raw.manualAccount], "taiko_manual_accounts", 1);
  if (account.taiko_id !== receipt.taiko_id || typeof account.nickname !== "string" || account.nickname.length > 64 ||
    !["viewer", "bot"].includes(String(account.created_by))) unavailable();
  if (account.bot_identity_key !== null) identityKey(account.bot_identity_key);
  const bindings = rows(raw.bindings, "web_taiko_bindings", 128);
  const botBindings = rows(raw.botBindings, "bind", 128);
  const owners = new Map<number, number>();
  for (const row of bindings) {
    const id = positiveId(row.id), userId = positiveId(row.user_id);
    if (row.taiko_id !== receipt.taiko_id || row.source !== "manual" ||
      (row.manual_account_id != null && row.manual_account_id !== receipt.taiko_id) || ![0, 1].includes(Number(row.is_current))) unavailable();
    owners.set(id, userId);
  }
  const botOwners = new Set<string>();
  for (const row of botBindings) {
    const key = identityKey(row.qq);
    if (botOwners.has(key) || row.id !== receipt.taiko_id || row.source !== "manual" ||
      ![0, 1].includes(Number(row.visible)) || ![0, 1].includes(Number(row.is_current))) unavailable();
    positiveId(row.slot_index);
    botOwners.add(key);
  }
  if (receipt.actor_kind === "viewer" ? ![...owners.values()].includes(Number(receipt.actor_key)) : !botOwners.has(receipt.actor_key)) unavailable();
  const products = record(raw.products);
  exactKeys(products, "goals measurements cursors titles locks");
  const result: ManualRecoveryData["products"] = {} as ManualRecoveryData["products"];
  for (const name of Object.keys(RECOVERY_PRODUCT_TABLES) as Array<keyof typeof RECOVERY_PRODUCT_TABLES>) {
    result[name] = rows(products[name], RECOVERY_PRODUCT_TABLES[name], 10_000);
    for (const row of result[name]) {
      if (name === "locks") {
        if (row.taiko_id !== receipt.taiko_id || ![...owners.values()].includes(positiveId(row.user_id))) unavailable();
      } else {
        const userId = owners.get(positiveId(row.binding_id));
        if (!userId || (name !== "titles" && positiveId(row.user_id) !== userId)) unavailable();
      }
    }
  }
  return { schema: 1, manualAccount: account, bindings, botBindings, products: result };
}

export function recoveryInsert(table: RecoveryTable, row: RecoveryRow) {
  const columns = Object.keys(row).filter(key => key !== "active_binding_id"); // Generated SQL column, never assigned.
  const allowed = new Set(RECOVERY_COLUMNS[table].split(" "));
  if (!columns.length || columns.some(key => !allowed.has(key))) unavailable();
  const values = columns.map(key => {
    const value = row[key];
    // MySQL Date values became ISO strings in the private JSON backup. Passing
    // a Date preserves original DATETIME(3) and the connection's timezone.
    if (key.endsWith("_at") && typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value)) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) unavailable();
      return date;
    }
    return value;
  });
  return { sql: `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`, values };
}
