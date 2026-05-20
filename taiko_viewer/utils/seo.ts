export const SITE_TITLE = "Sakura Taiko Viewer";
export const CANONICAL_BASE_URL = "https://viewer.sakura-bot.cn";
export const DEFAULT_OG_IMAGE = "https://static.sakura-bot.cn/banner.png";

export const DEFAULT_DESCRIPTION =
  "Sakura Taiko Viewer 是太鼓达人国行数据看板，提供歌曲列表、谱面攻略、段位查询、称号一览与玩家论坛社区。";

export const DEFAULT_KEYWORDS = [
  "Sakura Taiko Viewer",
  "taiko viewer",
  "太鼓达人",
  "太鼓之达人",
  "国行太鼓",
  "谱面攻略",
  "段位查询",
  "段位道场",
  "歌曲列表",
  "称号一览"
] as const;

export const formatViewerTitle = (title?: string) => {
  const normalized = String(title || "").trim();
  if (!normalized || normalized === SITE_TITLE || normalized === "首页") {
    return SITE_TITLE;
  }
  return `${SITE_TITLE} · ${normalized}`;
};

export const buildPageDescription = (pageDesc: string) => {
  const text = String(pageDesc || "").trim();
  if (!text) return DEFAULT_DESCRIPTION;
  if (text.includes(SITE_TITLE)) return text;
  return `${SITE_TITLE}：${text}`;
};

export const buildPageKeywords = (extra: string[] = []) => {
  const merged = [...DEFAULT_KEYWORDS, ...extra.map((item) => String(item).trim()).filter(Boolean)];
  return Array.from(new Set(merged)).join(", ");
};

export const buildWebSiteJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_TITLE,
  alternateName: ["taiko viewer", "太鼓达人数据看板"],
  url: CANONICAL_BASE_URL,
  description: DEFAULT_DESCRIPTION,
  inLanguage: "zh-CN"
});

export const buildOrganizationJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_TITLE,
  url: CANONICAL_BASE_URL,
  logo: DEFAULT_OG_IMAGE
});
