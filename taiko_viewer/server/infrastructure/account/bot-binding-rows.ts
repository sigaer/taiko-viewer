import type {Pool,PoolConnection,RowDataPacket} from 'mysql2/promise';
import {MANUAL_SOURCE_ID} from '../../internal/account/source-lifecycle.ts';
import {principalFailure,requirePrincipalSources,type PrincipalTicket} from '../../services/account/principal-access.ts';
import type {BotBindingEffect} from './bot-binding-effect.ts';
export type BotBindingRow={row_id:string;qq:string;id:string;visible:number;slot_index:number;is_current:number;source:'wahlap'|'hiroba'|'manual';display_name?:string};
export type BotBindingData={rows:BotBindingRow[];virtual:boolean};
const sourceFailure=()=>{throw new Error('Invalid private binding state');};
export async function readBotBindingData(db:Pick<Pool,'execute'>,ticket:PrincipalTicket,locked=true):Promise<BotBindingData>{
 const [records]=await db.execute<RowDataPacket[]>(`SELECT CAST(row_id AS CHAR) AS row_id,qq,id,COALESCE(visible,0) AS visible,
  COALESCE(slot_index,1) AS slot_index,COALESCE(is_current,0) AS is_current,COALESCE(source,'wahlap') AS source
  FROM bind WHERE qq=? ORDER BY slot_index,row_id LIMIT 129`+(locked?' FOR UPDATE':''),[ticket.principal]);
 if(records.length>128)sourceFailure();
 const rows:BotBindingRow[]=records.map(row=>{
  if(row.qq!==ticket.principal)throw principalFailure(403,'没有访问该绑定的权限。');
  if(!/^[1-9][0-9]{0,19}$/.test(row.row_id)||typeof row.id!=='string'||!/^[0-9]{1,25}$/.test(row.id)||
    !Number.isSafeInteger(row.slot_index)||row.slot_index<1||row.slot_index>=1000000||![0,1].includes(row.visible)||![0,1].includes(row.is_current)||
    !['wahlap','hiroba','manual'].includes(row.source)||(row.source==='manual')!==MANUAL_SOURCE_ID.test(row.id))sourceFailure();
  return {row_id:row.row_id,qq:row.qq,id:row.id,visible:row.visible,slot_index:row.slot_index,is_current:row.is_current,source:row.source};
 });
 if(rows.filter(row=>row.is_current===1).length>1||new Set(rows.map(row=>row.id)).size!==rows.length||new Set(rows.map(row=>row.slot_index)).size!==rows.length)sourceFailure();
 requirePrincipalSources(ticket,rows.map(row=>row.id));
 for(const row of rows)if(row.source==='manual'){
  // Plain consistent reads avoid a bind->manual-account row lock inversion.
  const [[manual]]=await db.execute<RowDataPacket[]>('SELECT nickname FROM taiko_manual_accounts WHERE taiko_id=? LIMIT 1',[row.id]);
  if(!manual||typeof manual.nickname!=='string')sourceFailure();row.display_name=manual.nickname;
 }
 const [[state]]=await db.execute<RowDataPacket[]>('SELECT identity_key,current_virtual FROM taiko_bind_identity_state WHERE identity_key=? LIMIT 1'+(locked?' FOR UPDATE':''),[ticket.principal]);
 if(state&&(state.identity_key!==ticket.principal||![0,1].includes(state.current_virtual)))sourceFailure();
 return {rows,virtual:state?.current_virtual===1};
}
export function botBindingPayload(principal:string,data:BotBindingData){
 const selected=data.rows.find(row=>row.is_current===1)||data.rows[0];
 const bindings=data.rows.map(row=>({slot:row.slot_index,taikoId:row.id,visible:row.visible,isCurrent:row===selected,source:row.source,
  displayName:row.source==='manual'?row.display_name||'手动账号':row.id,isManual:row.source==='manual',canExternalSync:row.source!=='manual'}));
 const current=bindings.find(row=>row.isCurrent)||bindings[0];if(!current)return {ok:true,found:false,identityKey:principal,bindings:[]};
 const currentVirtual=data.virtual&&bindings.filter(row=>!row.isManual).length>=2;
 return {ok:true,found:true,identityKey:principal,taikoId:current.taikoId,visible:current.visible,currentTaikoId:current.taikoId,
  currentSlot:currentVirtual?0:current.slot,currentVirtual,currentSource:current.source,bindings};
}
export type BotBindingIntent=Readonly<{action:'read'|'upsert'|'current'|'remove'|'visibility';principal:string;sourceId:string|null;platform:'wahlap'|'hiroba'|null;visible:number|null;slot:number|null;forceLast?:boolean}>;
export async function applyBotBindingIntent(db:PoolConnection,ticket:PrincipalTicket,intent:BotBindingIntent,data:BotBindingData):Promise<BotBindingEffect|undefined>{
 const predicate='CAST(qq AS BINARY)=CAST(? AS BINARY)';
 if(intent.action==='upsert'){
  const existing=data.rows.find(row=>row.id===intent.sourceId);
  if(existing?.source==='manual')throw principalFailure(403,'手动账号必须通过创建或认领接口绑定。');
  if(existing)await db.execute('UPDATE bind SET visible=?,source=? WHERE row_id=?',[intent.visible,intent.platform,existing.row_id]);
  else{
   if(data.rows.length>=128)throw principalFailure(409,'绑定数量已达上限。');
   const used=new Set(data.rows.map(row=>row.slot_index));let slot=1;while(used.has(slot))slot++;
   await db.execute('INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES (?,?,?,?,0,?)',[ticket.principal,intent.sourceId,intent.visible,slot,intent.platform]);
  }
  await db.execute('UPDATE bind SET is_current=0 WHERE '+predicate,[ticket.principal]);
  await db.execute('UPDATE bind SET is_current=1 WHERE '+predicate+' AND CAST(id AS BINARY)=CAST(? AS BINARY)',[ticket.principal,intent.sourceId]);
 }else if(intent.action==='current'){
  if(intent.slot===0){if(data.rows.filter(row=>row.source!=='manual').length<2)throw principalFailure(409,'至少需要 2 个 CN/JP 账号才能使用 u0。');}
  else{const target=data.rows.find(row=>row.slot_index===intent.slot);if(!target)throw principalFailure(404,'未找到该槽位。');
   await db.execute('UPDATE bind SET is_current=0 WHERE '+predicate,[ticket.principal]);await db.execute('UPDATE bind SET is_current=1 WHERE row_id=?',[target.row_id]);}
 }else if(intent.action==='visibility'){
  await db.execute('UPDATE bind SET visible=? WHERE qq=? AND '+predicate,[intent.visible,ticket.principal,ticket.principal]);
  return {kind:'visibility',matched:data.rows.length};
 }else if(intent.action==='remove'){
  const index=data.rows.findIndex(row=>row.id===intent.sourceId),target=data.rows[index];
  if(!target)throw principalFailure(404,'当前未绑定该鼓众广场ID。');
  if(target.source==='manual')throw principalFailure(403,'手动账号请使用“解绑空白账号”或“永久删除空白账号”。');
  if(data.rows.length===1&&!intent.forceLast)return {kind:'remove',removed:false,needsConfirmation:true};
  if(target.source==='hiroba')await db.execute(`DELETE FROM web_hiroba_credentials WHERE taiko_no=?
   AND configured_by_qq=? AND CAST(configured_by_qq AS BINARY)=CAST(? AS BINARY)`,[target.id,ticket.principal,ticket.principal]);
  await db.execute('DELETE FROM bind WHERE row_id=?',[target.row_id]);
  const remaining=data.rows.filter(row=>row!==target);
  if(remaining.length){
   const selected=remaining.find(row=>row.is_current===1)||remaining[Math.min(index,remaining.length-1)];
   const offset=Math.max(...remaining.map(row=>row.slot_index))+remaining.length+1;
   await db.execute('UPDATE bind SET slot_index=slot_index+? WHERE qq=? AND '+predicate,[offset,ticket.principal,ticket.principal]);
   for(const [slot,row] of remaining.entries())await db.execute('UPDATE bind SET slot_index=?,is_current=? WHERE row_id=?',[slot+1,row===selected?1:0,row.row_id]);
   // Shared native selection permits manual members. The client payload still
   // applies its external-only virtual profile without destroying that state.
   await db.execute(`INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES (?,?)
    ON DUPLICATE KEY UPDATE current_virtual=VALUES(current_virtual)`,[ticket.principal,data.virtual&&remaining.length>=2?1:0]);
  }else await db.execute('DELETE FROM taiko_bind_identity_state WHERE identity_key=? AND CAST(identity_key AS BINARY)=CAST(? AS BINARY)',[ticket.principal,ticket.principal]);
  return {kind:'remove',removed:true,needsConfirmation:false};
 }
 if(intent.action==='upsert'||intent.action==='current')await db.execute(`INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES (?,?)
  ON DUPLICATE KEY UPDATE current_virtual=VALUES(current_virtual)`,[ticket.principal,intent.action==='current'&&intent.slot===0?1:0]);
}
