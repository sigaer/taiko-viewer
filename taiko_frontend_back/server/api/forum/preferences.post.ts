import { readBody } from "h3";
import { updateForumPreferences } from "~/server/utils/forum";

export default defineEventHandler(async (event) =>
  updateForumPreferences(event, await readBody(event)),
);
