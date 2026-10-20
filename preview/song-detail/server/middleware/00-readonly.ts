import { createError, defineEventHandler, getCookie, getHeader, getMethod, getQuery, getRequestURL, sendRedirect, setCookie } from 'h3';
import happiness from '../../fixtures/1455.json';
import tenjiku from '../../fixtures/1.json';
import miku from '../../fixtures/1357.json';
import saitama from '../../fixtures/627.json';
import type { SongDetailPayload } from '~/types/content';

const songs: Record<number, SongDetailPayload> = { 1455: happiness, 1: tenjiku, 1357: miku, 627: saitama };
const user = { id: 990093, username: '预览鼓众', email: 'song-preview@example.invalid', emailVerified: true, avatarUrl: '', createdAt: '2026-01-01T00:00:00Z', annualSummaryAccess: false };
const binding = { id: 1, taikoId: 'synthetic-song-preview', source: 'wahlap', isCurrent: true, displayName: '预览鼓众', isManual: false, canExternalSync: true };
export default defineEventHandler(event => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith('/api/')) {
    const state = getQuery(event).previewState;
    if (typeof state === 'string' && ['scores', 'guest', 'empty'].includes(state)) {
      setCookie(event, 'song_preview_state', state, { path: '/', sameSite: 'lax' });
      // SSR and client requests must use the same fixture on the first navigation.
      const otherCookies=(getHeader(event,'cookie') || '').split(';').map(value=>value.trim()).filter(value=>value && !value.startsWith('song_preview_state='));
      event.node.req.headers.cookie=[...otherCookies,`song_preview_state=${state}`].join('; ');
    }
    return;
  }
  // No mutation is implemented or forwarded by this preview root.
  if (!['GET', 'HEAD'].includes(getMethod(event))) throw createError({ statusCode: 405, statusMessage: 'Read-only component preview' });
  const state = getCookie(event, 'song_preview_state') || 'scores';
  const signedIn = state !== 'guest';
  if (path === '/api/account/auth/me') return { authenticated: signedIn, user: signedIn ? user : null };
  if (path === '/api/annual-beta/status') return { authenticated: signedIn, mode: 'public', entitled: false, pending: false };
  const songMatch = path.match(/^\/api\/content\/songs\/(\d+)$/);
  if (songMatch) return songs[Number(songMatch[1])] || { song: null, ratingEntries: [], branchAudioVariants: {}, tjaBundleUrl: null };
  const ugc = path.match(/^\/api\/content\/songs\/(\d+)\/ugc$/);
  if (ugc) return { chart: { chartId: `${ugc[1]}-${getQuery(event).difficulty || 4}`, songId: Number(ugc[1]), difficultyCode: Number(getQuery(event).difficulty || 4) }, difficulty: { count: 0, verifiedCount: 0, distribution: { '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0 }, mean: null, summary: 'insufficient' }, tags: [], availableTags: [], tips: [] };
  if (path === '/api/forum/threads') return { items: [], total: 0, page: 1, pageSize: 3 };
  if (path.match(/^\/api\/account\/charts\/\d+\/\d+\/ugc\/me$/)) return { chart: { chartId: path.split('/').slice(4, 6).join('-'), songId: Number(path.split('/')[4]), difficultyCode: Number(path.split('/')[5]) }, difficultyVote: null, tagSlugs: [], tagSelections: [], tip: null, helpfulTipIds: [] };
  if (path === '/api/account/bindings') return { bindings: signedIn ? [binding] : [], currentBinding: signedIn ? binding : null };
  const scores = path.match(/^\/api\/account\/songs\/(\d+)$/);
  if (scores) {
    const songId=Number(scores[1]), detail=songs[songId];
    if (!signedIn || state==='empty' || !detail?.song) return { items: [] };
    return { items: [4,5].filter(level=>level===4 || Number(detail.song?.level_5)>0).map(level=>{
      const combo=Number(detail.song?.max_combo?.[level-1] || detail.ratingEntries.find(item=>Number(item.level)===level)?.combo || 0);
      return { songNo:songId,level,levelLabel:level===4?'魔王':'里谱',starLevel:level===4?detail.song!.level_4:detail.song!.level_5,maxCombo:combo,highScore:level===4?980000:1000450,bestScoreRank:5,goodCnt:Math.max(0,combo-8),okCnt:7,ngCnt:1,poundCnt:25,stageCnt:12,clearCnt:12,fullComboCnt:0,dondafulComboCnt:0,comboCnt:Math.min(450,combo),updateDatetime:'2026-10-07 14:00:00',highscoreDatetime:'2026-10-07 14:00:00' };
    }) };
  }
  const download = path.match(/^\/api\/content\/songs\/(\d+)\/tja-package$/);
  if (download && songs[Number(download[1])]) return sendRedirect(event, `https://viewer.sakura-bot.cn${path}`, 302);
  throw createError({ statusCode: 404, statusMessage: 'No read-only fixture for this endpoint' });
});
