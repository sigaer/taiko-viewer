import type { RowDataPacket } from "mysql2/promise";
import { UGC_CREATE_TABLE_STATEMENTS } from "~/server/services/ugc/schema";
import { ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";

import { schemaRequirement, validateSchemaTables } from "./account-schema-runtime";
const requirements = UGC_CREATE_TABLE_STATEMENTS.map(schemaRequirement);
export const ensureUgcSchema = async () => {
  await ensureAccountSchema();
  await validateSchemaTables(getAccountDb(), requirements, "ugc");
};

export const getUgcDb = () => getAccountDb();

export type UgcDbRow<T> = T & RowDataPacket;
