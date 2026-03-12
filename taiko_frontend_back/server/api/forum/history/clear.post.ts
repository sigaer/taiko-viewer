import { clearForumHistory } from "~/server/utils/forum";

export default defineEventHandler(async (event) => clearForumHistory(event));
