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
