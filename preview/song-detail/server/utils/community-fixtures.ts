import { FORUM_SECTION_SEEDS } from '../../../../taiko_viewer/types/forum';

// Synthetic read model only. All successful writes in browser checks are
// intercepted transports; this fixture never loads the business backend.
export const communityAuthor = { id: 990093, username: 'Synthetic community A', avatarUrl: '', role: 'user', roleLabel: 'User', taikoIdMasked: '', verifiedTitle: null, verifiedTitleplateId: null };
export const communitySections = FORUM_SECTION_SEEDS.map((section, index) => ({ ...section, id: index + 1, threadCount: 0, postCount: 0, featuredThreadCount: 0 }));
export const communityNotifications = Array.from({ length: 23 }, (_, index) => ({
  id: 8750 - index, type: 'reply', title: `Synthetic reply ${index + 1} · 長い曲名の練習記録と返信`,
  body: '合成用户回复了你的练习记录。テスト用の返信本文です。', actor: communityAuthor,
  threadId: 7001, postId: 7100 + index, isRead: index >= 21, createdAt: '2026-10-22T10:00:00Z'
}));
export const communityThread = {
  id: 7001, title: 'Synthetic long discussion · 長い曲名の練習記録と譜面の振り返り',
  summary: 'Synthetic discussion body', threadType: 'discussion', author: communityAuthor,
  section: communitySections[0], contentBlocks: [{ type: 'paragraph', text: 'Synthetic discussion body' }], posts: [{ id: 7100, floorNo: 1, bodyText: 'Synthetic reply body', contentBlocks: [{type:'paragraph',text:'Synthetic reply body'}], parentPostId: null, rootPostId: null, replies: [], author:communityAuthor, likeCount:0, viewerHasLiked:false, isBlockedAuthor:false, createdAt:'2026-10-22T10:00:00Z' }],
  songId: 1455, songTitle: 'Synthetic long song title', difficultyType: 5, level: 10,
  song: {id:1455,title:'Synthetic long song title',titleJp:'Synthetic long song title',coverUrl:'/miku.png',category:'test',difficultyType:5,difficultyLabel:'裏',level:10},
  tags: [], coverImageUrl: '', replyCount: 1, likeCount: 0, favoriteCount: 0, viewCount: 0,
  isPinned: false, isFeatured: false, isLocked: false, viewerHasLiked: false, viewerHasFavorited: false,
  status: 'published', createdAt: '2026-10-22T10:00:00Z', updatedAt: '2026-10-22T10:00:00Z', latestPostAt: '2026-10-22T10:00:00Z'
};
export function communityData(path: string, query: Record<string, unknown>, state: string) {
  if (path === '/api/forum/sections') return { items: communitySections };
  if (path === '/api/forum/notifications') {
    const page = Math.max(1, Number(query.page || 1)), pageSize = 20;
    const items = state === 'community-empty' ? [] : communityNotifications;
    return { page, pageSize, total: items.length, unreadCount: items.filter(item => !item.isRead).length, items: items.slice((page - 1) * pageSize, page * pageSize) };
  }
  if (path === '/api/forum/threads/7001') return communityThread;
}
