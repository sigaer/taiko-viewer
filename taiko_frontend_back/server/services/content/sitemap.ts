import { getAccountDb } from "~/server/utils/account-db";
import { ensureForumSchema } from "~/server/utils/forum-db";
import { GUIDE_DIFFICULTY_OPTIONS } from "~/utils/guide";
import { buildCanonicalUrl, getSongCatalog } from "./index";

const STATIC_ROUTES = [
  "/",
  "/songs/available",
  "/songs/removed",
  "/titles",
  "/guide",
  "/grade",
  "/grade/2023",
  "/grade/2024",
  "/grade/2025",
  "/about",
  "/forum",
  "/alias-log"
];

const EXCLUDED_ROBOTS_PREFIXES = [
  "/account/",
  "/forum/new",
  "/forum/me",
  "/forum/notifications",
  "/settings"
];

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const loadForumRoutes = async () => {
  try {
    await ensureForumSchema();
    const db = getAccountDb();
    const [sectionRows] = await db.query<Array<{ slug: string }>>(
      "SELECT slug FROM forum_sections ORDER BY sort_order ASC, id ASC"
    );
    const [threadRows] = await db.query<Array<{ id: number }>>(
      "SELECT id FROM forum_threads WHERE status = 'published' ORDER BY id DESC"
    );
    return {
      sections: sectionRows.map((row) => `/forum/section/${row.slug}`),
      threads: threadRows.map((row) => `/forum/thread/${row.id}`)
    };
  } catch {
    return {
      sections: [] as string[],
      threads: [] as string[]
    };
  }
};

export const getPublicSitemapPaths = async () => {
  const [songs, forumRoutes] = await Promise.all([getSongCatalog(), loadForumRoutes()]);
  const songRoutes = songs.map((song) => `/songs/${song.id}`);
  const guideRoutes = GUIDE_DIFFICULTY_OPTIONS.flatMap((group) =>
    Array.from({ length: group.max }, (_, index) => `/guide/${group.value}/${index + 1}`)
  );
  return Array.from(
    new Set([...STATIC_ROUTES, ...songRoutes, ...guideRoutes, ...forumRoutes.sections, ...forumRoutes.threads])
  );
};

export const renderSitemapXml = async () => {
  const urls = await getPublicSitemapPaths();
  const items = urls
    .map((path) => `  <url><loc>${xmlEscape(buildCanonicalUrl(path))}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
};

export const renderRobotsTxt = () => {
  const disallowLines = EXCLUDED_ROBOTS_PREFIXES.map((prefix) => `Disallow: ${prefix}`);
  return `User-agent: *\n${disallowLines.join("\n")}\nAllow: /\nSitemap: ${buildCanonicalUrl("/sitemap.xml")}\n`;
};
