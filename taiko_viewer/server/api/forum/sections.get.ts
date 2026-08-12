import { listForumSections } from "~/server/utils/forum";
import { setAnonymousSWR } from "~/server/utils/cache-policy";

export default defineEventHandler(async (event) => {
  setAnonymousSWR(event, 30, 120);
  return { items: await listForumSections() };
});
