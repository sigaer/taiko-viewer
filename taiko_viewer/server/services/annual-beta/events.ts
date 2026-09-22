import { randomUUID } from "node:crypto";
import type { H3Event } from "h3";
import { createError, getCookie, getHeader, getRequestURL, getRequestIP, setCookie } from "h3";
import { ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import { getSecureCookieFlag } from "~/server/internal/account/shared";
import { createMemoryRateLimiter } from "~/server/utils/rate-limit";
import { hashBetaToken, newBetaToken } from "./core";
import pkg from "../../../package.json";
import { ANNUAL_ALGORITHM_VERSION } from "~/server/services/account/annual-summary/constants";

export const CLIENT_EVENTS = new Set([
 "home_view","annual_entry_impression","annual_entry_click","beta_invite_gate_view","beta_invite_submit",
 "auth_start","binding_entry_impression","binding_entry_click","binding_start","binding_id_submitted",
 "binding_verification_instruction_view","binding_pending","binding_verify_start",
 "annual_entry_ready","annual_report_open","annual_slide_view","annual_report_complete",
 "annual_poster_open","annual_share_action","annual_feedback_open","annual_rating_rank_layout_anomaly"
]);
const ONCE = new Set(["home_view","annual_entry_impression","beta_invite_gate_view","binding_entry_impression","binding_verification_instruction_view","annual_entry_ready","annual_report_open","annual_report_complete","annual_poster_open","annual_rating_rank_layout_anomaly"]);
const LAYOUT_NUMBER_KEYS = new Set(["inner_height","visual_viewport_height","visual_viewport_offset_top","visual_viewport_scale","annual_stage_height","scene_top","scene_bottom","scene_height","content_top","content_bottom","content_height","chart_top","chart_bottom","chart_height","visual_top","visual_bottom","visual_height","axis_labels_top","axis_labels_bottom","axis_labels_height","axis_safe_margin","scroll_y"]);
const META_KEYS = new Set(["source","slide_key","action","reason","duration_ms","sync_duration_ms","data_updated_at","songs_count","charts_count","plays_count","job_id","cached","auth_method",...LAYOUT_NUMBER_KEYS,"ua"]);
export const safeBetaMetadata = (input: unknown) => {
 const value: Record<string,unknown>={};
 if (!input || typeof input!=="object" || Array.isArray(input))return value;
 for (const [key,item] of Object.entries(input)) {
  if(!META_KEYS.has(key))continue;
  if(key==='ua' && typeof item==='string')value[key]=item.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,300);
  else if(typeof item==='number' && Number.isFinite(item))value[key]=LAYOUT_NUMBER_KEYS.has(key)?Math.max(-1e6,Math.min(item,1e6)):Math.max(0,Math.min(item,1e12));
  else if(typeof item==='boolean')value[key]=item;
  else if(typeof item==='string' && /^[\w .:TZ/+\-]{1,100}$/.test(item))value[key]=item;
 }
 return value;
};
export const assertBetaOrigin = (event: H3Event) => {
 const origin=getHeader(event,"origin");
 if(!origin || origin!==getRequestURL(event).origin)throw createError({statusCode:403,statusMessage:"Invalid request origin"});
};
const limitInvite=createMemoryRateLimiter({windowMs:60_000,limit:60,maxBuckets:5000,message:"请稍后再试"});
const limitEvent=createMemoryRateLimiter({windowMs:60_000,limit:180,maxBuckets:10000,message:"请稍后再试"});
export const betaRate = (event:H3Event, kind:"invite"|"event") => (kind==='invite'?limitInvite:limitEvent)(event,(getRequestIP(event,{xForwardedFor:false})||"unknown")+':'+hashBetaToken(getCookie(event,'annual_beta_session')||'anonymous'));
export type BetaContext={sessionId:string;participantId:string;userId:number|null;inviteId:string|null;locale:string;device:string;route:string};
const routeName=(input:string)=> {
 const path=input.split('?')[0];
 return /^\/(?:ja\/)?(?:account\/(?:profile|sync|login|register|version-summary)|annual|)$/.test(path)?path:'/annual';
};
export const betaContext = async(event:H3Event,userId:number|null=null):Promise<BetaContext>=> {
 await ensureAccountSchema();const db=getAccountDb();let token=getCookie(event,'annual_beta_session')||'';
 let sid=/^[A-Za-z0-9_-]{43}$/.test(token)?hashBetaToken(token):'';
 let [sessions]:any=sid?await db.execute('SELECT s.*,p.user_id AS previous_user FROM web_beta_sessions s JOIN web_beta_participants p ON p.id=s.participant_id WHERE s.id=? AND s.expires_at>NOW()',[sid]):[[]];
 if(sessions[0]?.previous_user && Number(sessions[0].previous_user)!==userId)sessions=[];
 if(!sessions.length){
  token=newBetaToken();sid=hashBetaToken(token);const pid=randomUUID();
  await db.execute('INSERT INTO web_beta_participants (id) VALUES (?)',[pid]);
  await db.execute('INSERT INTO web_beta_sessions (id,participant_id,expires_at) VALUES (?,?,?)',[sid,pid,new Date(Date.now()+12*60*60_000)]);
  sessions=[{participant_id:pid}];
  setCookie(event,'annual_beta_session',token,{httpOnly:true,secure:getSecureCookieFlag(event),sameSite:'lax',path:'/',maxAge:12*60*60});
 }
 let pid=sessions[0].participant_id;
 if(userId){
  await db.execute('INSERT INTO web_beta_participants (id,user_id) VALUES (?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)',[randomUUID(),userId]);
  const [users]:any=await db.execute('SELECT * FROM web_beta_participants WHERE user_id=?',[userId]);const target=users[0].id;
  if(target!==pid){
   await db.execute('UPDATE web_beta_sessions SET participant_id=? WHERE id=?',[target,sid]);
   // Only attach anonymous events. Switching logins never reattributes another user.
   await db.execute('UPDATE web_beta_events SET participant_id=?,user_id=? WHERE session_id=? AND user_id IS NULL',[target,userId,sid]);
   pid=target;
  }
 }
 const [people]:any=await db.execute('SELECT invite_id FROM web_beta_participants WHERE id=?',[pid]);
 return {sessionId:sid,participantId:pid,userId,inviteId:people[0]?.invite_id||null,locale:(getHeader(event,'x-viewer-locale')||getCookie(event,'viewer_locale'))==='ja'?'ja':'zh',device:/Mobile|Android|iPhone/i.test(getHeader(event,'user-agent')||'')?'mobile':'desktop',route:routeName(getHeader(event,'x-beta-route')||'/annual')};
};
export const recordBetaEvent = async(ctx:BetaContext,name:string,metadata:unknown={},dedup?:string)=> {
 const meta=safeBetaMetadata(metadata);const key=dedup || (name==='annual_slide_view'?`${name}:${String(meta.slide_key||'unknown')}`:ONCE.has(name)?name:null);
 await getAccountDb().execute(`INSERT IGNORE INTO web_beta_events
 (event_id,participant_id,user_id,invite_id,session_id,event_name,app_version,algorithm_version,locale,device_class,route,metadata_json,dedup_key)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,[randomUUID(),ctx.participantId,ctx.userId,ctx.inviteId,ctx.sessionId,name,pkg.version,ANNUAL_ALGORITHM_VERSION,ctx.locale,ctx.device,ctx.route,JSON.stringify(meta),key]);
};
export const trackBetaServer = async(event:H3Event,userId:number|null,name:string,meta:unknown={})=> {
 // Hooks never break auth, binding or sync if telemetry is unavailable.
 if(!getCookie(event,'annual_beta_session'))return;
 try{await recordBetaEvent(await betaContext(event,userId),name,meta);}catch{console.warn('[annual-beta] event write failed',name);}
};
export const trackBetaUser = async(userId:number,name:string,meta:unknown={},dedup?:string)=> {
 try{
  await ensureAccountSchema();const [rows]:any=await getAccountDb().execute(`SELECT p.id,p.invite_id,s.id AS session_id FROM web_beta_participants p JOIN web_beta_sessions s ON s.participant_id=p.id WHERE p.user_id=? ORDER BY s.created_at DESC LIMIT 1`,[userId]);
  if(!rows.length)return;const r=rows[0];
  const [context]:any=await getAccountDb().execute('SELECT locale,device_class,route FROM web_beta_events WHERE session_id=? ORDER BY occurred_at DESC LIMIT 1',[r.session_id]);
  const c=context[0];await recordBetaEvent({participantId:r.id,inviteId:r.invite_id,userId,sessionId:r.session_id,locale:c?.locale||'zh',device:c?.device_class||'desktop',route:c?.route||'/annual'},name,meta,dedup);
 }catch{console.warn('[annual-beta] event write failed',name);}
};

export const recordBetaEventSafely = async (...args: Parameters<typeof recordBetaEvent>) => {
 try { await recordBetaEvent(...args); } catch { console.warn('[annual-beta] event write failed', args[1]); }
};
