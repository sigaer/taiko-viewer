import { extraReadonly, binding, profile } from './site-fixtures';
import { songRowData } from './song-row-fixtures';
import type { PlayerGrowthOverview, RecentGrowthResponse } from '../../../../taiko_viewer/types/player-growth';

// Frozen synthetic input, with no business transport or persistence.
export function homeDeepData(path: string, state: string) {
  if (state !== 'home-deep') return undefined;
  if (path === '/api/account/profile') {
    const data = profile('scores');
    data.bindings.push({...binding,id:2,taikoId:'synthetic-binding-B',displayName:'Synthetic binding B',isCurrent:false});
    return data;
  }
  if (path === '/api/account/sync/targets') return {
    currentBinding:binding,hasUserdata:true,canSyncFromWahlap:true,scoreTokenAvailable:false,scoreToken:null,
    targets:[{id:'synthetic-target',label:'Synthetic preview target',description:''}],cooldownRemainingSeconds:0,cooldownUntil:'',lastSync:null
  };
  if (path === '/api/account/growth/overview') {
    const overview = songRowData(path, {}, 'song-rows') as PlayerGrowthOverview;
    overview.dailyProgress = (extraReadonly(path, {}, 'changes') as PlayerGrowthOverview).dailyProgress;
    return overview;
  }
  if (path === '/api/account/growth/recent') {
    const recent = extraReadonly(path, {}, 'changes') as RecentGrowthResponse;
    recent.boundary.currentToken = 'synthetic-home-deep-token';
    recent.boundary.acknowledgeRequired = true;
    return recent;
  }
  return undefined;
}
