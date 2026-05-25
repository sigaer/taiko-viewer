export const SITE_TITLE = "Sakura Taiko Viewer";
export const CANONICAL_BASE_URL = "https://viewer.sakura-bot.cn";
export const DEFAULT_OG_IMAGE = "https://static.sakura-bot.cn/banner.png";

export const DEFAULT_DESCRIPTION =
  "Sakura Taiko Viewer is a Taiko data viewer with songs, guides, grades, titles, forum and tools.";

export const DEFAULT_KEYWORDS = ["Sakura Taiko Viewer", "taiko viewer", "taiko data viewer"] as const;

export const formatViewerTitle = (
  title?: string,
  options: {
    siteTitle?: string;
    homeTitle?: string;
  } = {}
) => {
  const normalized = String(title || "").trim();
  const siteTitle = options.siteTitle || SITE_TITLE;
  const homeTitle = options.homeTitle || "";
  if (!normalized || normalized === siteTitle || normalized === homeTitle) {
    return siteTitle;
  }
  return `${siteTitle} · ${normalized}`;
};

export const buildPageDescription = (pageDesc: string, siteTitle = SITE_TITLE) => {
  const text = String(pageDesc || "").trim();
  if (!text) return DEFAULT_DESCRIPTION;
  if (text.includes(siteTitle)) return text;
  return `${siteTitle}：${text}`;
};

export const buildPageKeywords = (base: string[] = [], extra: string[] = []) => {
  const merged = [...base, ...DEFAULT_KEYWORDS, ...extra.map((item) => String(item).trim()).filter(Boolean)];
  return Array.from(new Set(merged)).join(", ");
};

export const buildWebSiteJsonLd = (payload: {
  description: string;
  language: string;
  alternateName?: string[];
}) => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_TITLE,
  alternateName: payload.alternateName || ["taiko viewer"],
  url: CANONICAL_BASE_URL,
  description: payload.description,
  inLanguage: payload.language
});

export const buildOrganizationJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_TITLE,
  url: CANONICAL_BASE_URL,
  logo: DEFAULT_OG_IMAGE
});
