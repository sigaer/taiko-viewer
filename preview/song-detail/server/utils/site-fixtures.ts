import catalog from '../../fixtures/catalog.json';
import happiness from '../../fixtures/1455.json';
import tenjiku from '../../fixtures/1.json';
import miku from '../../fixtures/1357.json';
import saitama from '../../fixtures/627.json';
import type { SongDetailPayload, SongCatalogItem } from '~/types/content';

export const publicSongs = catalog.songs as SongCatalogItem[];
export const details: Record<number, SongDetailPayload> = {1455: happiness, 1: tenjiku, 1357: miku, 627: saitama};
export const user = {id: 990093, username: '预览鼓众', email: 'song-preview@example.invalid', emailVerified: true, avatarUrl: '', createdAt: '2026-01-01T00:00:00Z'};
export const binding = {id: 1, taikoId: 'synthetic-song-preview', source: 'wahlap', isCurrent: true, displayName: '预览鼓众', isManual: false, canExternalSync: true, verifiedTitle: '春色的鼓声', currentTitle: '春色的鼓声', verifiedTitleplateId: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-19T12:00:00Z'};
export const recommendations = publicSongs.slice(0,20).map((song,index) => ({
  songId:song.id,level:index===10?5:4,title:song.song_name,isUnplayed:index%7===6,
  candidateIndicator:10.5+index*.01,referenceIndicator:10.4,deviationRatio:.02,inStrictRange:true,
  starLevel:Number(index===10?song.level_5:song.level_4)||null,
  recommendationToken:`synthetic-review-${song.id}-${index===10?5:4}`,canCreateGoal:index%7!==6
}));
const dimensions = {big_song:11.2,stamina:10.7,speed:10.9,accuracy_power:11.4,rhythm:10.8,complex:10.6};
const change = {start:null,end:null,compatible:false,reason:'insufficient',ratingDelta:null,dimensionDeltas:null,primaryDimensionChange:null,primaryDimension:null,focusFrom:null,focusTo:null};
export function profile(state:string){
  const active=state!=='unbound';
  return {user,bindings:active?[binding]:[],currentBinding:active?binding:null,
    pendingBinding:state==='pending'?{taikoId:'700000000000000093',originalTitle:'春色的鼓声',originalTitleplateId:1,expiresAt:'2026-10-21T12:00:00Z'}:null,
    qqBinding:null,verificationStatus:{emailVerified:true,taikoVerified:active}};
}
export function songScores(id:number,state:string){
  const detail=details[id],song=detail?.song||publicSongs.find(s=>s.id===id);
  if(state==='empty'||!song)return [];
  return [4,5].filter(level=>level===4||Number(song.level_5)>0).map(level=>{
    const combo=Number(song.max_combo?.[level-1]||detail?.ratingEntries.find(item=>Number(item.level)===level)?.combo||0);
    return {songNo:id,level,levelLabel:level===4?'魔王':'里谱',starLevel:level===4?song.level_4:song.level_5,maxCombo:combo,
      title:song.song_name,titleJp:song.song_name_jp,subtitle:song.subtitle||'',category:song.type,bpm:song.bpm,
      version:(song.version||[]).join(' / '),artists:(song.artists||[]).join(' / '),shelfStatus:0,isCustom:false,isLocked:false,
      highScore:level===4?980000:1000450,bestScoreRank:5,goodCnt:Math.max(0,combo-8),okCnt:7,ngCnt:1,poundCnt:25,stageCnt:12,
      clearCnt:12,fullComboCnt:0,dondafulComboCnt:0,comboCnt:Math.min(450,combo),updateDatetime:'2026-10-07 14:00:00',highscoreDatetime:'2026-10-07 14:00:00'};
  });
}
export function extraReadonly(path:string,query:Record<string,any>,state:string):unknown{
  const empty=state==='empty',signedIn=state!=='guest';
  if(path==='/api/content/songs'){
    const keyword=String(query.keyword||'').toLowerCase(),page=Math.max(1,Number(query.page)||1),size=Number(query.pageSize)||12;
    const all=publicSongs.filter(song=>!keyword||`${song.song_name} ${song.song_name_jp||''} ${song.id}`.toLowerCase().includes(keyword));
    return query.view==='list'?{songs:all.slice((page-1)*size,page*size),total:all.length,page,pageSize:size}:{songs:publicSongs};
  }
  if(path==='/api/account/progress/options')return {dani:[],constants:{pass:[],comprehensive:[]},stars:[],named:[],pages:{pass:{},comprehensive:{},star:{},named:{}}};
  if(path==='/api/admin/auth/me')return {authenticated:false,user:null};
  if(path==='/api/content/home')return {latestSongs:publicSongs.slice(0,8)};
  if(path==='/api/account/profile')return profile(state);
  if(path==='/api/account/my-don/showcase')return {bindingId:1,taikoId:binding.taikoId,hasUserdata:false,isCustom:false,layoutMode:'nickname',selectedTitles:[],availableTitles:[]};
  if(path==='/api/account/recommendation/tool')return {model:'v1',basis:query.dim||'rating',profileId:'1',scoreRevision:'synthetic-review-r1',generatedAt:'2026-10-20T06:00:00Z',items:empty?[]:recommendations.slice(0,Math.min(50,Number(query.n)||20)),image:query.image==='true'?`/__review-assets/recommendations-${Math.min(20,Number(query.n)||20)}.svg`:null};
  if(path==='/api/account/recommendation/target')return {model:'v1',target:query.target||'goku',candidateCount:0,requiredCount:20,isEnough:false,items:[]};
  if(path==='/api/account/charts/summary')return {current:empty?null:11.18,scoreCount:empty?0:120};
  if(path==='/api/account/recommendation')return {items:recommendations.slice(0,5)};
  if(path==='/api/account/songs'){
    const rows=empty?[]:publicSongs.slice(0,25).flatMap(song=>songScores(song.id,state));
    return {currentBinding:binding,total:rows.length,page:1,pageSize:25,items:rows.slice(0,Number(query.pageSize)||25)};
  }
  if(path==='/api/account/growth/overview')return {profileId:'1',scoreRevision:'synthetic-review-r1',activeGoal:null,recentCompletedGoal:null,
    playerState:{overallRating:11.18,skills:Object.entries(dimensions).map(([key,value])=>({key,value})),priorityDimension:'complex',tiedDimensions:['complex'],dataSufficiency:'ready',basis:'lowest-valid-dimension',sampleCount:120},
    todayPlan:{targetDimension:'complex',items:recommendations.slice(0,3).map(item=>({...item,difficultyType:item.level,targetDimension:'complex',reason:'target-dimension',currentBestScore:980000,currentBestRank:5})),usedFallback:false},
    dailyProgress:{calendarDay:'2026-10-20',dataMode:'SNAPSHOT_LIMITED',attendance:'unknown',uniqueCharts:null,events:[]},dataStatus:{mode:'SNAPSHOT_LIMITED',timezone:'Asia/Shanghai'}};
  if(path==='/api/account/growth/recent')return {profileId:'1',state:'caught-up',observedAt:null,facts:[],totalFacts:0,boundary:{acknowledgedToken:null,currentToken:null,acknowledgeRequired:false,recovered:false}};
  if(path==='/api/account/growth/passport')return {profileId:'1',coverage:{measurementFrom:null,measurementTo:null,measurementDays:0,recentFactsFrom:'2026-09-20',recentFactsTo:'2026-10-20',recentFactsState:'partial'},
    current:{rating:11.18,dimensions,focus:'complex',readiness:'limited'},range:{requestedDays:Number(query.range)||90,actualFrom:null,actualTo:null,timezone:'Asia/Shanghai',selectedDimension:query.dimension||'rating'},segments:[],currentSegmentChange:change,focusTimeline:[],milestones:[],activeGoal:null,recentCompletedGoal:null,currentNextAction:null};
  if(path==='/api/account/growth/weekly')return {profileId:'1',week:{from:'2026-10-19',to:'2026-10-25',timezone:'Asia/Shanghai',isCompleteWeek:false},coverage:{scoreHistoryFrom:null,scoreHistoryTo:null,scoreHistoryState:'partial',measurementFrom:null,measurementTo:null,measurementState:'unknown'},theme:{type:'limited-coverage',confidence:'low',evidenceFactKeys:[],evidenceMeasurementIds:[]},highlights:[],measurementChange:change,totals:{distinctCharts:0,pb:0,fc:0,df:0,rankUpgrade:0,completedGoals:0},currentNextAction:null};
  if(path==='/api/forum/home')return {sections:[],featuredThreads:[],hotThreads:[],latestGuides:[],announcements:[],leaderboard:[],currentUser:signedIn?user:null,unreadNotificationCount:0,highlightedTags:[]};
  if(path==='/api/content/community/chart-activity')return {items:[]};
  return undefined;
}
