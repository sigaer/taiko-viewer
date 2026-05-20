import { listForumSections } from "~/server/utils/forum";

export default defineEventHandler(async () => ({
  items: await listForumSections()
}));
