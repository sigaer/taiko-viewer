import { ensureAccountSchema, getAccountDb } from "./account-db";
import { CREATE_FORUM_TABLES } from "./forum-schema-definition";
import { schemaRequirement, validateSchemaTables } from "./account-schema-runtime";
const requirements = CREATE_FORUM_TABLES.map(schemaRequirement);
export const ensureForumSchema = async () => {
  await ensureAccountSchema();
  await validateSchemaTables(getAccountDb(), requirements, "forum");
};
