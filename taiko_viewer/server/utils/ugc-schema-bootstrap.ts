// Explicit administrative bootstrap; no runtime caller.
import { getAccountDb } from "./account-db";
import { UGC_CREATE_TABLE_STATEMENTS } from "../services/ugc/schema";
export const initializeUgcSchema = async () => {
  for (const statement of UGC_CREATE_TABLE_STATEMENTS) await getAccountDb().execute(statement);
};
