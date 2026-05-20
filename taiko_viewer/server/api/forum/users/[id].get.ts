import { getForumUserProfile } from "~/server/utils/forum";

export default defineEventHandler(async (event) =>
  getForumUserProfile(event, event.context.params?.id),
);
