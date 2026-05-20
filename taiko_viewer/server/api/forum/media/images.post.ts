import { readForumImageMultipart, uploadForumImage } from "~/server/utils/forum";

export default defineEventHandler(async (event) => uploadForumImage(event, await readForumImageMultipart(event)));
