import { readBody } from "h3";
import { submitForumFeedback } from "~/server/utils/forum";

export default defineEventHandler(async (event) =>
  submitForumFeedback(event, await readBody(event)),
);
