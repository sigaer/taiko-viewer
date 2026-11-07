import { communityAuthor, communitySections, communityThread } from './community-fixtures';

// Synthetic fixtures for the opt-in, read-only preview server only.
export const discoveryThreads = communitySections.flatMap((section, sectionIndex) =>
  Array.from({ length: 14 }, (_, index) => ({
    ...communityThread,
    id: 81000 + sectionIndex * 100 + index,
    section,
    threadType: 'guide',
    title: `Discovery ${sectionIndex + 1} · ${index + 1}`,
    author: {
      ...communityAuthor,
      username: index % 2 ? '無称号のプレイヤー' : '鼓声未停',
      role: index === 0 ? 'moderator' : 'user',
      taikoIdMasked: 'MASKED-ID-HIDDEN',
      verifiedTitle: index % 2 ? null : '春色的鼓声・長い称号でも一行で表示する太鼓の達人プレイヤー'.repeat(3),
      verifiedTitleplateId: index % 2 ? null : 987654321
    },
    song: {
      ...communityThread.song,
      id: index === 1 ? 90000001 : index === 2 ? 90000002 : 1455,
      title: '很长的中文歌曲名称与练习记录，歌曲名称最多显示两行且不挤压封面'.repeat(3),
      titleJp: 'とても長い日本語の曲名でもジャケットを押し広げず二行まで表示する'.repeat(3)
    }
  }))
);
export const discoveryDetail = {
  ...discoveryThreads[0],
  posts: [{
    ...communityThread.posts[0], author: discoveryThreads[0].author,
    replies: [{ ...communityThread.posts[0], id: 7101, parentPostId: 7100, rootPostId: 7100, author: discoveryThreads[2].author }]
  }]
};

export function discoveryData(path: string, query: Record<string, unknown>, state: string) {
  if (state !== 'forum-discovery') return undefined;
  if (path === '/api/account/auth/me') return { authenticated: false, user: null };
  if (path === '/api/forum/home') return {
    sections: communitySections, featuredThreads: [], hotThreads: discoveryThreads.slice(0, 3),
    latestGuides: [], announcements: [], leaderboard: [], highlightedTags: [], currentUser: null, unreadNotificationCount: 0
  };
  if (/^\/api\/forum\/threads\/\d+$/.test(path)) return discoveryDetail;
  if (path !== '/api/forum/threads') return undefined;
  let items = discoveryThreads;
  if (query.sectionSlug) items = items.filter(item => item.section.slug === query.sectionSlug);
  if (query.keyword) items = items.filter(item => item.title.includes(String(query.keyword)));
  if (query.threadType) items = items.filter(item => item.threadType === query.threadType);
  if (query.songId) items = items.filter(item => item.song.id === Number(query.songId));
  if (query.difficultyType) items = items.filter(item => item.song.difficultyType === Number(query.difficultyType));
  const page = Number(query.page || 1), pageSize = Number(query.pageSize || 12);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize, sort: query.sort || 'latest' };
}
