import { createError, defineEventHandler, getCookie, getHeader, getMethod, getQuery, getRequestURL, readBody, sendRedirect, setCookie } from 'h3';
import { details as songs, user, extraReadonly, profile, publicSongs, recommendations, songScores } from '../utils/site-fixtures';
export default defineEventHandler(async event => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith('/api/')) {
    const state = getQuery(event).previewState;
    if (typeof state === 'string' && ['scores', 'guest', 'empty', 'pending', 'unbound', 'failure'].includes(state)) {
      setCookie(event, 'song_preview_state', state, { path: '/', sameSite: 'lax' });
      // SSR and client requests must use the same fixture on the first navigation.
      const otherCookies=(getHeader(event,'cookie') || '').split(';').map(value=>value.trim()).filter(value=>value && !value.startsWith('song_preview_state='));
      event.node.req.headers.cookie=[...otherCookies,`song_preview_state=${state}`].join('; ');
    }
    return;
  }
  // This existing POST is a read-only preview operation. No goal is ever written.
  if(path==='/api/account/growth/goal/preview' && getMethod(event)==='POST'){
    if(getCookie(event,'song_preview_state')==='guest')throw createError({statusCode:401,statusMessage:'Synthetic preview is signed out'});
    const body=await readBody(event),item=recommendations.find(item=>item.recommendationToken===body.recommendationToken && item.canCreateGoal);
    if(!item)throw createError({statusCode:409,statusMessage:'Invalid synthetic recommendation source'});
    return {profileId:'1',scoreRevision:'synthetic-review-r1',songId:item.songId,difficultyType:item.level,title:item.title,starLevel:item.starLevel,goalOptions:['score-pb','ng-reduced','clear','fc','df'],activeGoal:null};
  }
  // No mutation is implemented or forwarded by this preview root.
  if (!['GET', 'HEAD'].includes(getMethod(event))) throw createError({ statusCode: 405, statusMessage: 'Read-only component preview' });
  const state = getCookie(event, 'song_preview_state') || 'scores';
  const signedIn = state !== 'guest';
  if(state==='failure' && ['/api/content/home','/api/account/growth/overview','/api/account/growth/recent'].includes(path))throw createError({statusCode:503,statusMessage:'Synthetic preview unavailable'});
  if(!signedIn && path.startsWith('/api/account/') && path!=='/api/account/auth/me')throw createError({statusCode:401,statusMessage:'Synthetic preview is signed out'});
  const extra=extraReadonly(path,getQuery(event),state);
  if(extra!==undefined)return extra;
  if (path === '/api/account/auth/me') return { authenticated: signedIn, user: signedIn ? user : null };
  if (path === '/api/annual-beta/status') return { authenticated: signedIn, mode: 'public', entitled: false, pending: false };
  const songMatch = path.match(/^\/api\/content\/songs\/(\d+)$/);
  if (songMatch) return songs[Number(songMatch[1])] || { song: publicSongs.find(song=>song.id===Number(songMatch[1]))||null, ratingEntries: [], branchAudioVariants: {}, tjaBundleUrl: null };
  const ugc = path.match(/^\/api\/content\/songs\/(\d+)\/ugc$/);
  if (ugc) return { chart: { chartId: `${ugc[1]}-${getQuery(event).difficulty || 4}`, songId: Number(ugc[1]), difficultyCode: Number(getQuery(event).difficulty || 4) }, difficulty: { count: 0, verifiedCount: 0, distribution: { '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0 }, mean: null, summary: 'insufficient' }, tags: [], availableTags: [], tips: [] };
  if (path === '/api/forum/threads') return { items: [], total: 0, page: 1, pageSize: 3 };
  if (path.match(/^\/api\/account\/charts\/\d+\/\d+\/ugc\/me$/)) return { chart: { chartId: path.split('/').slice(4, 6).join('-'), songId: Number(path.split('/')[4]), difficultyCode: Number(path.split('/')[5]) }, difficultyVote: null, tagSlugs: [], tagSelections: [], tip: null, helpfulTipIds: [] };
  if (path === '/api/account/bindings') return { bindings: signedIn ? profile(state).bindings : [], currentBinding: signedIn ? profile(state).currentBinding : null };
  const scores = path.match(/^\/api\/account\/songs\/(\d+)$/);
  if (scores) {
    return { items: signedIn ? songScores(Number(scores[1]),state) : [] };
  }
  const download = path.match(/^\/api\/content\/songs\/(\d+)\/tja-package$/);
  if (download && songs[Number(download[1])]) return sendRedirect(event, `https://viewer.sakura-bot.cn${path}`, 302);
  throw createError({ statusCode: 404, statusMessage: 'No read-only fixture for this endpoint' });
});
