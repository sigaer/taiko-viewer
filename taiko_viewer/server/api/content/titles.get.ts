import { getTitlesPageContent } from "~/server/services/content";
import { resolveViewerLocale } from "~/server/utils/locale";

export default defineEventHandler(async (event) => getTitlesPageContent(resolveViewerLocale(event)));
