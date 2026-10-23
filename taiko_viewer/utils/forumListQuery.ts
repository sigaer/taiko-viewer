const text = (value: unknown) => String(Array.isArray(value) ? value[0] || '' : value || '');
const positive = (value: unknown, maximum: number) => {
  const n = Number(text(value));
  return Number.isSafeInteger(n) && n > 0 && n <= maximum ? n : 0;
};
export const parseForumListQuery = (query: Record<string, unknown>) => ({
  keyword: text(query.keyword).trim().slice(0, 80),
  sort: ['latest', 'hot', 'featured'].includes(text(query.sort)) ? text(query.sort) : 'latest',
  threadType: ['discussion', 'guide', 'achievement', 'official', 'strategy'].includes(text(query.threadType)) ? text(query.threadType) : '',
  songId: positive(query.songId, Number.MAX_SAFE_INTEGER) ? String(positive(query.songId, Number.MAX_SAFE_INTEGER)) : '',
  difficultyType: positive(query.difficultyType, 5) ? String(positive(query.difficultyType, 5)) : '',
  page: positive(query.page, 1000000) || 1,
});
export const forumListLocationQuery = (query: Record<string, unknown>) => {
  const value = parseForumListQuery(query);
  return {
    keyword: value.keyword || undefined, sort: value.sort === 'latest' ? undefined : value.sort,
    threadType: value.threadType || undefined, songId: value.songId || undefined,
    difficultyType: value.difficultyType || undefined, page: value.page > 1 ? String(value.page) : undefined,
  };
};
