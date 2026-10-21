import { extraReadonly, recommendations } from './site-fixtures';
import type { PlayerGrowthOverview } from '../../../../taiko_viewer/types/player-growth';

export const songRowTitle = 'ハッピーシンセサイザ ～長い曲名でも最後まで読める、今日の練習と次の目標～';
export const songRowRecommendations = recommendations.map((item, index) => index === 0
  ? { ...item, songId:1455, level:5, title:songRowTitle, starLevel:10, isUnplayed:false, recommendationToken:'synthetic-shared-song-1455-5', canCreateGoal:true }
  : index === 1 ? { ...item, canCreateGoal:false } : item);

export function songRowData(path:string, query:Record<string,any>, state:string) {
  if (!state.startsWith('song-rows')) return undefined;
  if (path === '/api/account/recommendation/tool') return {
    model:'v1', basis:query.dim || 'rating', profileId:'1', scoreRevision:'synthetic-review-r1', generatedAt:'2026-10-21T04:00:00Z',
    items:songRowRecommendations.slice(0, Math.min(50, Number(query.n) || 20)), image:null
  };
  if (path !== '/api/account/growth/overview') return undefined;
  const overview = extraReadonly(path, {}, 'scores') as PlayerGrowthOverview;
  overview.todayPlan.items = songRowRecommendations.slice(0,3).map((item,index) => ({
    songId:item.songId, difficultyType:item.level as 4|5, title:item.title, starLevel:item.starLevel,
    isUnplayed:item.isUnplayed, targetDimension:'complex', reason:'target-dimension',
    currentBestScore:index === 0 ? 980000 : null, currentBestRank:index === 0 ? 5 : null,
    ...(index === 0 ? {goalOptions:['score-pb' as const,'fc' as const]} : index === 1 ? {goalOptions:[]} : {})
  }));
  return overview;
}
