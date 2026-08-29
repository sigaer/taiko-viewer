import type { RowDataPacket } from "mysql2/promise";
import { UGC_CREATE_TABLE_STATEMENTS } from "~/server/services/ugc/schema";
import { ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";

let ugcSchemaReady: Promise<void> | null = null;

export const ensureUgcSchema = async () => {
  if (!ugcSchemaReady) {
    ugcSchemaReady = (async () => {
      await ensureAccountSchema();
      const db = getAccountDb();
      for (const statement of UGC_CREATE_TABLE_STATEMENTS) await db.execute(statement);
    })();
  }
  await ugcSchemaReady;
};

export const getUgcDb = () => getAccountDb();

export type UgcDbRow<T> = T & RowDataPacket;
