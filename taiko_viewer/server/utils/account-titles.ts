import type { AccountTitle } from "~/types/account-title";
import { getAccountDb } from "./account-db";
import { schemaRequirement, validateSchemaTables } from "./account-schema-runtime";
import { ACCOUNT_TITLE_TABLE_SQL } from "../services/account-titles/schema";
import { readAccountTitles } from "../services/account-titles/repository";

const requirements = [schemaRequirement(ACCOUNT_TITLE_TABLE_SQL)];
export async function getAccountTitlesMap(userIds: number[]) {
  if (!userIds.length) return new Map<number, AccountTitle[]>();
  const db = getAccountDb();
  await validateSchemaTables(db, requirements, "account-titles");
  return readAccountTitles(db, userIds);
}
