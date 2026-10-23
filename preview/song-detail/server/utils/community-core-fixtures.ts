import { createError } from 'h3';
import { communityAuthor, communitySections, communityThread } from './community-fixtures';

// Isolated page inputs, never loaded by the normal application server.
export const coreThreads = Array.from({ length: 29 }, (_, i) => ({
  ...communityThread, id: 7200 + i,
  title: `Core ${i + 1} · 长曲名の練習と振り返り · ${i % 3 === 0 ? '検索攻略' : '日常讨论'}`,
  summary: '合成正文：真实页面验收。', author: { ...communityAuthor, id: i % 2 + 1 },
  section: communitySections[i % 2 === 0 ? 3 : 7],
  threadType: i % 3 === 0 ? 'guide' : 'discussion', isFeatured: i < 3,
  song: { ...communityThread.song, difficultyType: i % 2 === 0 ? 5 : 4 },
  likeCount: i, replyCount: 1,
  latestPostAt: new Date(Date.UTC(2026, 9, 23, 0, i)).toISOString()
}));
export function coreList(query: Record<string, unknown>) {
  let rows = [...coreThreads];
  if (query.sectionSlug) rows = rows.filter(row => row.section.slug === query.sectionSlug);
  if (query.keyword) rows = rows.filter(row => row.title.includes(String(query.keyword)));
  if (query.threadType) rows = rows.filter(row => row.threadType === query.threadType);
  if (query.songId) rows = rows.filter(row => row.song.id === Number(query.songId));
  if (query.difficultyType) rows = rows.filter(row => row.song.difficultyType === Number(query.difficultyType));
  if (query.scope === 'mine') rows = rows.filter(row => row.author.id === Number(query.syntheticUser || 1));
  rows.sort((a, b) => query.sort === 'hot' ? b.likeCount - a.likeCount : query.sort === 'featured' ? Number(b.isFeatured) - Number(a.isFeatured) || b.id - a.id : b.id - a.id);
  const page = Math.max(1, Number(query.page || 1)), pageSize = Number(query.pageSize || 12);
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: rows.length, sort: query.sort || 'latest' };
}
export const coreHome = {
  sections: communitySections, featuredThreads: coreList({ sort: 'featured', pageSize: 6 }).items,
  hotThreads: coreList({ sort: 'hot', pageSize: 6 }).items,
  latestGuides: coreList({ threadType: 'guide', pageSize: 6 }).items,
  announcements: [], leaderboard: [], highlightedTags: [],
  currentUser: { ...communityAuthor, id: 1 }, unreadNotificationCount: 3
};
export const coreDetail = {
  ...coreThreads[0], contentBlocks: [
    { type: 'paragraph', text: 'Core thread body · テスト本文' },
    { type: 'image', imageUrl: '/miku.png', alt: 'Synthetic original image' }
  ],
  posts: [{ ...communityThread.posts[0], id: 7301, bodyText: 'Visible floor', contentBlocks: [{type:'paragraph',text:'Visible floor'}],
    replies: [{ ...communityThread.posts[0], id: 7302, parentPostId: 7301, rootPostId: 7301, bodyText: 'Blocked reply secret', contentBlocks: [{type:'paragraph',text:'Blocked reply secret'},{type:'image',imageUrl:'/miku.png',alt:'Blocked image'}], isBlockedAuthor:true }]
  }]
};
export function communityCoreData(path: string, query: Record<string, unknown>, state: string) {
  if (!state.startsWith('community-core')) return undefined;
  if (state === 'community-core-mine-failure' && path === '/api/forum/threads' && query.scope === 'mine') throw createError({ statusCode: 503, statusMessage: 'Synthetic SSR mine failure' });
  if (path === '/api/forum/home') return coreHome;
  if (path === '/api/forum/threads') return coreList(query);
  if (/^\/api\/forum\/threads\/\d+$/.test(path)) return { ...coreDetail, id: Number(path.split('/').pop()) };
}
