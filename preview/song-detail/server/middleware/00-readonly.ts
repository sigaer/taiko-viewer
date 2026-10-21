import { songRowData, songRowRecommendations } from '../utils/song-row-fixtures';
import { homeDeepData } from '../utils/home-deep-fixtures';
import { growthData } from '../utils/growth-fixtures';
import { batch2Data, batch2Image } from '../utils/batch2-fixtures';
import { createError, defineEventHandler, getCookie, getHeader, getMethod, getQuery, getRequestURL, readBody, setHeader, sendRedirect, setCookie } from 'h3';
import { details as songs, user, extraReadonly, profile, publicSongs, recommendations, songScores } from '../utils/site-fixtures';
export default defineEventHandler(async event => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith('/api/')) {
    const state = getQuery(event).previewState;
    if (typeof state === 'string' && ['home-deep', 'auth-failure', 'binding-failure', 'overview-failure', 'song-rows', 'scores', 'guest', 'empty', 'pending', 'unbound', 'failure', 'unchanged', 'recent-failure', 'changes', 'manual', 'options-failure', 'image-failure', 'scores-failure', 'catalog-failure', 'slow', 'growth-expanded', 'growth-empty', 'growth-single', 'growth-missing', 'growth-limited', 'growth-unknown', 'growth-incompatible', 'growth-no-next', 'growth-quiet', 'growth-no-play', 'growth-failure'].includes(state)) {
      setCookie(event, 'song_preview_state', state, { path: '/', sameSite: 'lax' });
      // SSR and client requests must use the same fixture on the first navigation.
      const otherCookies=(getHeader(event,'cookie') || '').split(';').map(value=>value.trim()).filter(value=>value && !value.startsWith('song_preview_state='));
      event.node.req.headers.cookie=[...otherCookies,`song_preview_state=${state}`].join('; ');
    }
    return;
  }
  // The automatic acknowledgement is confined to this synthetic token. This
  // controlled response neither persists a boundary nor reaches a real API.
  if (path === '/api/account/growth/recent/ack' && getMethod(event) === 'POST' && getCookie(event, 'song_preview_state') === 'home-deep') {
    const body = await readBody(event);
    if (body.profileId !== '1' || body.acknowledgeToken !== 'synthetic-home-deep-token') throw createError({statusCode:409,statusMessage:'Synthetic boundary conflict'});
    return {profileId:'1',acknowledgedToken:body.acknowledgeToken};
  }
  // This existing POST is a read-only preview operation. No goal is ever written.
  if(path==='/api/account/growth/goal/preview' && getMethod(event)==='POST'){
    if(getCookie(event,'song_preview_state')==='guest')throw createError({statusCode:401,statusMessage:'Synthetic preview is signed out'});
    const candidates=getCookie(event,'song_preview_state')==='song-rows'?songRowRecommendations:recommendations;
    const body=await readBody(event),item=candidates.find(item=>item.recommendationToken===body.recommendationToken && item.canCreateGoal);
    if(!item)throw createError({statusCode:409,statusMessage:'Invalid synthetic recommendation source'});
    return {profileId:'1',scoreRevision:'synthetic-review-r1',songId:item.songId,difficultyType:item.level,title:item.title,starLevel:item.starLevel,goalOptions:['score-pb','ng-reduced','clear','fc','df'],activeGoal:null};
  }
  // No mutation is implemented or forwarded by this preview root.
  if (!['GET', 'HEAD'].includes(getMethod(event))) throw createError({ statusCode: 405, statusMessage: 'Read-only component preview' });
  const state = getCookie(event, 'song_preview_state') || 'scores';
  if (path === '/api/account/auth/me' && state === 'auth-failure') throw createError({statusCode:503,statusMessage:'Synthetic authentication read failure'});
  if (path === '/api/account/bindings' && state === 'binding-failure') throw createError({statusCode:503,statusMessage:'Synthetic binding read failure'});
  if (path === '/api/account/growth/overview' && state === 'overview-failure') throw createError({statusCode:503,statusMessage:'Synthetic overview read failure'});
  const signedIn = state !== 'guest';
  if(state==='recent-failure' && path==='/api/account/growth/recent')throw createError({statusCode:503,statusMessage:'Synthetic recent-growth read failure'});
  if(state==='failure' && ['/api/content/home','/api/account/growth/overview','/api/account/growth/recent'].includes(path))throw createError({statusCode:503,statusMessage:'Synthetic preview unavailable'});
  if(!signedIn && path.startsWith('/api/account/') && path!=='/api/account/auth/me')throw createError({statusCode:401,statusMessage:'Synthetic preview is signed out'});
  if (state === 'options-failure' && path === '/api/account/progress/options') throw createError({statusCode:503,statusMessage:'Synthetic options unavailable'});
  if (state === 'catalog-failure' && path === '/api/content/songs') throw createError({statusCode:503,statusMessage:'Synthetic catalog read failure'});
  if (state === 'scores-failure' && path === '/api/account/songs') throw createError({statusCode:503,statusMessage:'Synthetic scores unavailable'});
  if (['/api/account/charts/b30','/api/account/progress/image'].includes(path)) {
    if (state === 'unbound') throw createError({statusCode:400,statusMessage:'请先绑定鼓众 ID'});
    if (state === 'empty' && path.endsWith('/b30')) throw createError({statusCode:404,statusMessage:'No scores in synthetic fixture'});
    if (state === 'image-failure') throw createError({statusCode:503,statusMessage:'Synthetic image unavailable'});
    if (state === 'slow') await new Promise(resolve=>setTimeout(resolve,1800));
    setHeader(event,'content-type','image/svg+xml');
    return batch2Image(path,getQuery(event));
  }
  if (path === '/api/account/growth/passport' || path === '/api/account/growth/weekly') {
    if (state === 'unbound') throw createError({statusCode:400,statusMessage:'请先绑定鼓众 ID'});
    if (state === 'growth-failure') throw createError({statusCode:503,statusMessage:'Synthetic growth read failure'});
    if (state === 'slow') await new Promise(resolve => setTimeout(resolve, 1800));
    return growthData(path, getQuery(event), state);
  }
  const deep=homeDeepData(path,state);
  if(deep!==undefined)return deep;
  const shared=songRowData(path,getQuery(event),state);
  if(shared!==undefined)return shared;
  const batch=batch2Data(path,getQuery(event),state);
  if(batch!==undefined)return batch;
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
