import {createError} from 'h3';
import {user,binding,publicSongs,profile} from './site-fixtures';
const date='2026-10-23T00:00:00Z';
export const entryUser={...user,annualSummaryAccess:false,developerApiV1Access:true,myTaikoReadModelAccess:true};
const application={id:8709,replyEmail:'synthetic@example.invalid',reason:'合成开发者申请 · テスト利用申請',imageUrls:[],status:'approved',reviewNote:'合成审批记录',reviewedAt:date,createdAt:date,updatedAt:date};
export const entryTicket={id:8709,title:'合成同步问题 · 同期に関するお問い合わせ',category:'sync',content:'合成工单正文，仅用于页面验证。',contact:'synthetic@example.invalid',status:'open',mailStatus:'failed',hasUnread:true,messageCount:2,createdAt:date,updatedAt:date};
export const entryTicketDetail={...entryTicket,messages:[{id:1,authorRole:'user',authorUserId:entryUser.id,content:entryTicket.content,mailStatus:'failed',createdAt:date},{id:2,authorRole:'staff',authorUserId:999,content:'合成站务回复 · テスト返信',mailStatus:'failed',createdAt:date}]};
export function entryData(path:string,query:Record<string,unknown>,state:string):unknown{
 if(!state.startsWith('entry-'))return undefined;
 const failure=state==='entry-failure',empty=state==='entry-empty';
 if(path==='/api/account/profile')return profile(empty?'unbound':'scores');
 if(path==='/api/account/auth/me')return {authenticated:true,user:entryUser};
 const paths=['/api/account/sync/targets','/api/account/developer','/api/account/developer/review','/api/account/developer/grants','/api/account/developer/clients','/api/support/tickets'];
 if(failure&&paths.includes(path))throw createError({statusCode:503,statusMessage:'Synthetic entry read failure'});
 if(path==='/api/account/sync/targets')return {currentBinding:empty?null:binding,hasUserdata:!empty,canSyncFromWahlap:true,scoreTokenAvailable:!empty,scoreToken:empty?null:{taikoId:binding.taikoId,exists:true,tokenMask:'MASKED',lastUsedAt:date,createdAt:date,updatedAt:date},targets:empty?[]:[{id:'synthetic-one',label:'合成接收端一',description:'テスト配信先'},{id:'synthetic-two',label:'合成接收端二',description:'テスト配信先'}],cooldownRemainingSeconds:0,cooldownUntil:'',lastSync:empty?null:{id:1,taikoId:binding.taikoId,status:'partial',targetIds:['synthetic-one','synthetic-two'],results:[{targetId:'synthetic-one',label:'合成接收端一',ok:true,statusCode:200,message:'合成成功',receivedBytes:4096,decompressedBytes:8192,songCount:26},{targetId:'synthetic-two',label:'合成接收端二',ok:false,statusCode:503,message:'合成读取失败',receivedBytes:0,decompressedBytes:0,songCount:null}],originalBytes:8192,compressedBytes:4096,createdAt:date,updatedAt:date}};
 if(path==='/api/account/developer')return {canReview:state==='entry-reviewer',currentApplication:empty?null:application,history:empty?[]:[application],token:empty?null:{id:1,tokenMask:'MASKED',status:'active',issuedAt:date,lastUsedAt:date,revokedAt:''}};
 if(path==='/api/account/developer/review'){
  if(state!=='entry-reviewer')throw createError({statusCode:403,statusMessage:'Synthetic reviewer-only operation'});
  return {pending:empty?[]:[{...application,id:8710,status:'pending',applicant:{id:990094,username:'合成申请人',email:'synthetic@example.invalid'}}],history:[application]};
 }
 if(path==='/api/account/developer/grants')return {consentVersion:'viewer-account-consent-v2',audience:'viewer:developer-api:v1',clients:[{clientId:'clt_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',displayName:'合成应用 · テストアプリ',status:'active'}],bindings:[{bindingId:'1',source:'wahlap',displayName:'合成绑定'}],grants:empty?[]:[{grantId:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',ownerUserId:String(entryUser.id),playerId:'plr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',revision:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',consentVersion:'viewer-account-consent-v2',consentedAt:date,issuedAt:date,clientId:'clt_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',bindingId:'1',scopes:['account:read'],expiresAt:null,revokedAt:null}],hasMore:{clients:false,bindings:false,grants:false},nextCursor:null};
 if(path==='/api/account/developer/clients')return {clients:[],hasMore:false,nextCursor:null};
 if(path==='/api/support/tickets')return {items:empty?[]:[entryTicket,{...entryTicket,id:8710,title:'合成已关闭工单',status:'closed',hasUnread:false,mailStatus:'sent'}]};
 if(path==='/api/support/tickets/8709')return entryTicketDetail;
 if(path==='/api/support/tickets/8710')return {...entryTicketDetail,id:8710,status:'closed'};
 if(path==='/api/content/songs'&&query.view==='list'){
  if(state==='entry-catalog-failure')throw createError({statusCode:503,statusMessage:'Synthetic shelf read failure'});
  const shelf=Number(query.shelfStatus),keyword=String(query.keyword||'').trim();
  const all=empty?[]:Array.from({length:26},(_,i)=>({...publicSongs[i%publicSongs.length],id:900000+shelf*100+i,song_name:`合成${shelf===1?'已下架':shelf===2?'其他':'实装'}歌曲 ${i+1} · 长标题の楽曲で折り返しを確認するためのテスト`,song_name_jp:`テスト楽曲 ${i+1} 長いタイトルの表示と操作を確認`,shelf_status:shelf})).filter(x=>!keyword||x.song_name.includes(keyword)||x.song_name_jp.includes(keyword));
  const page=Number(query.page||1),pageSize=Number(query.pageSize||12);return {songs:all.slice((page-1)*pageSize,page*pageSize),total:all.length,page,pageSize};
 }
 return undefined;
}
