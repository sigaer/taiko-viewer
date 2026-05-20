import { getTitlesPageContent } from "~/server/services/content";

export default defineEventHandler(async () => getTitlesPageContent());
