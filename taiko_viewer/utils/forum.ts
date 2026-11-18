export const FORUM_IMAGE_MAX_MB = 20;
export const FORUM_IMAGE_MAX_BYTES = FORUM_IMAGE_MAX_MB * 1024 * 1024;

export const resolveForumSectionTranslation = (
  translate: (key: string, fallback?: string) => string,
  slug: string,
  fallback: string
) => {
  const key = `forum.sections.${slug}.name`;
  const value = translate(key, fallback);
  return value === key || value.startsWith("forum.") ? fallback : value;
};

export const resolveForumSectionDescription = (
  translate: (key: string, fallback?: string) => string,
  slug: string,
  fallback: string
) => {
  const key = `forum.sections.${slug}.description`;
  const value = translate(key, fallback);
  return value === key || value.startsWith("forum.") ? fallback : value;
};

/** The masked Taiko ID the forum API returns for a user without a binding (server/internal/forum/shared.ts). */
export const FORUM_UNBOUND_TAIKO_ID = "未绑定";
