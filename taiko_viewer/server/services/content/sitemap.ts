import { getAccountDb } from "~/server/utils/account-db";
import { ensureForumSchema } from "~/server/utils/forum-db";
import { GUIDE_DIFFICULTY_OPTIONS } from "~/utils/guide";
import type { SongCatalogItem } from "~/types/content";
import { buildCanonicalUrl, getSongCatalog } from "./index";

const STATIC_ROUTES = [
  "/",
  "/songs/available",
  "/songs/removed",
  "/songs/v2-constants",
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

type SitemapEntry = {
  path: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
};

const STATIC_ROUTE_META: Record<string, Pick<SitemapEntry, "changefreq" | "priority">> = {
  "/": { priority: "1.0", changefreq: "daily" },
  "/songs/available": { priority: "0.9", changefreq: "daily" },
  "/songs/v2-constants": { priority: "0.8", changefreq: "daily" },
  "/guide": { priority: "0.9", changefreq: "weekly" },
  "/forum": { priority: "0.8", changefreq: "daily" },
  "/grade": { priority: "0.8", changefreq: "weekly" },
  "/grade/2025": { priority: "0.8", changefreq: "weekly" },
  "/titles": { priority: "0.7", changefreq: "weekly" },
  "/about": { priority: "0.5", changefreq: "monthly" },
  "/alias-log": { priority: "0.4", changefreq: "weekly" },
  "/songs/removed": { priority: "0.6", changefreq: "weekly" },
  "/grade/2023": { priority: "0.6", changefreq: "monthly" },
  "/grade/2024": { priority: "0.6", changefreq: "monthly" }
};

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const todayIso = () => new Date().toISOString().slice(0, 10);

const parseOpenDayToIso = (input?: string) => {
  if (!input) return undefined;
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;
  const month = match[1].padStart(2, "0");
  const day = match[2].padStart(2, "0");
  return `${match[3]}-${month}-${day}`;
};

const toIsoDateTime = (value?: string | Date | null) => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

const buildStaticEntry = (path: string): SitemapEntry => {
  const meta = STATIC_ROUTE_META[path];
  return {
    path,
    lastmod: todayIso(),
    changefreq: meta?.changefreq || "weekly",
    priority: meta?.priority || "0.6"
  };
};

const loadForumRoutes = async () => {
  try {
    await ensureForumSchema();
    const db = getAccountDb();
    const [sectionRows] = await db.query<Array<{ slug: string; updated_at: string }>>(
      "SELECT slug, updated_at FROM forum_sections ORDER BY sort_order ASC, id ASC"
    );
    const [threadRows] = await db.query<Array<{ id: number; updated_at: string }>>(
      "SELECT id, updated_at FROM forum_threads WHERE status = 'published' ORDER BY id DESC"
    );
    return {
      sections: sectionRows.map((row) => ({
        path: `/forum/section/${row.slug}`,
        lastmod: toIsoDateTime(row.updated_at)
      })),
      threads: threadRows.map((row) => ({
        path: `/forum/thread/${row.id}`,
        lastmod: toIsoDateTime(row.updated_at)
      }))
    };
  } catch {
    return {
      sections: [] as Array<{ path: string; lastmod?: string }>,
      threads: [] as Array<{ path: string; lastmod?: string }>
    };
  }
};

const buildSongEntry = (song: SongCatalogItem): SitemapEntry => ({
  path: `/songs/${song.id}`,
  lastmod: parseOpenDayToIso(song.open_day) || todayIso(),
  changefreq: "monthly",
  priority: "0.7"
});

const buildGuideEntry = (path: string): SitemapEntry => ({
  path,
  lastmod: todayIso(),
  changefreq: "weekly",
  priority: "0.7"
});

export const getPublicSitemapEntries = async (): Promise<SitemapEntry[]> => {
  const [songs, forumRoutes] = await Promise.all([getSongCatalog(), loadForumRoutes()]);
  const staticEntries = STATIC_ROUTES.map((path) => buildStaticEntry(path));
  const songEntries = songs.map((song) => buildSongEntry(song));
  const guideEntries = GUIDE_DIFFICULTY_OPTIONS.flatMap((group) =>
    Array.from({ length: group.max }, (_, index) =>
      buildGuideEntry(`/guide/${group.value}/${index + 1}`)
    )
  );
  const forumSectionEntries: SitemapEntry[] = forumRoutes.sections.map((item) => ({
    path: item.path,
    lastmod: item.lastmod || todayIso(),
    changefreq: "daily",
    priority: "0.7"
  }));
  const forumThreadEntries: SitemapEntry[] = forumRoutes.threads.map((item) => ({
    path: item.path,
    lastmod: item.lastmod || todayIso(),
    changefreq: "weekly",
    priority: "0.6"
  }));

  const merged = new Map<string, SitemapEntry>();
  for (const entry of [
    ...staticEntries,
    ...songEntries,
    ...guideEntries,
    ...forumSectionEntries,
    ...forumThreadEntries
  ]) {
    merged.set(entry.path, entry);
  }
  return Array.from(merged.values());
};

export const getPublicSitemapPaths = async () => {
  const entries = await getPublicSitemapEntries();
  return entries.map((entry) => entry.path);
};

const renderUrlEntry = (entry: SitemapEntry) => {
  const parts = [`<loc>${xmlEscape(buildCanonicalUrl(entry.path))}</loc>`];
  if (entry.lastmod) parts.push(`<lastmod>${xmlEscape(entry.lastmod)}</lastmod>`);
  if (entry.changefreq) parts.push(`<changefreq>${entry.changefreq}</changefreq>`);
  if (entry.priority) parts.push(`<priority>${entry.priority}</priority>`);
  return `  <url>\n    ${parts.join("\n    ")}\n  </url>`;
};

export const renderSitemapXml = async () => {
  const entries = await getPublicSitemapEntries();
  const items = entries.map((entry) => renderUrlEntry(entry)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
};

export const renderRobotsTxt = () => {
  const disallowLines = EXCLUDED_ROBOTS_PREFIXES.map((prefix) => `Disallow: ${prefix}`);
  return `User-agent: *\n${disallowLines.join("\n")}\nAllow: /\nSitemap: ${buildCanonicalUrl("/sitemap.xml")}\n`;
};
