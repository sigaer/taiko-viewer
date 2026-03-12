import { getQuery } from "h3";
import { getForumRelationshipList } from "~/server/utils/forum";

export default defineEventHandler(async (event) =>
  getForumRelationshipList(event, getQuery(event)),
);
