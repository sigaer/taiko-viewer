import {createHash} from 'node:crypto';
import type {PoolConnection,RowDataPacket} from 'mysql2/promise';
import type {HirobaTicket} from '../../services/account/hiroba-authority.ts';
import {principalFailure} from '../../services/account/principal-access.ts';
import {readBotBindingData,botBindingPayload,type BotBindingData} from './bot-binding-rows.ts';
export const metadataHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function credentialRows(db:PoolConnection,ids:readonly string[]){
 if(!ids.length)return [];
 const [rows]=await db.execute<RowDataPacket[]>(`SELECT CAST(id AS CHAR) AS id,taiko_no,email,password_enc,configured_by_qq FROM web_hiroba_credentials
  WHERE taiko_no IN (${ids.map(()=>'?').join(',')}) ORDER BY taiko_no FOR UPDATE`,[...ids].sort());
 if(rows.some(row=>!ids.includes(row.taiko_no)||typeof row.email!=='string'||typeof row.password_enc!=='string'||Buffer.byteLength(row.password_enc)>8192))throw new Error('Invalid credential state');
 return rows.map(row=>({id:row.id,taiko_no:row.taiko_no,email:row.email,password_enc:row.password_enc,configured_by_qq:row.configured_by_qq}));
}
export async function hirobaBindingResult(db:PoolConnection,ticket:HirobaTicket,ids:readonly string[]){
 const bind=ticket.principal&&ids.length?botBindingPayload(ticket.principal.principal,await readBotBindingData(db,ticket.principal)):null;
 return {ok:true,taikoIds:[...ids],bind};
}
export async function saveHirobaBinding(db:PoolConnection,ticket:HirobaTicket,ids:readonly string[],email:string,passwordEnc:string){
 let data:BotBindingData|undefined;
 if(ticket.principal&&ids.length)data=await readBotBindingData(db,ticket.principal);
 await credentialRows(db,ids);
 for(const id of [...ids].sort())await db.execute(`INSERT INTO web_hiroba_credentials(taiko_no,email,password_enc,configured_by_qq) VALUES (?,?,?,?)
  ON DUPLICATE KEY UPDATE email=VALUES(email),password_enc=VALUES(password_enc),configured_by_qq=VALUES(configured_by_qq),updated_at=CURRENT_TIMESTAMP`,[id,email,passwordEnc,ticket.principal?.principal||null]);
 if(data&&ticket.principal){
  const existing=new Map(data.rows.map(row=>[row.id,row])),used=new Set(data.rows.map(row=>row.slot_index));
  if(data.rows.length+ids.filter(id=>!existing.has(id)).length>128)throw principalFailure(409,'绑定数量已达上限。');
  for(const id of ids){
   const row=existing.get(id);if(row?.source==='manual')throw principalFailure(403,'手动账号必须通过创建或认领接口绑定。');
   if(row)await db.execute("UPDATE bind SET visible=0,source='hiroba' WHERE row_id=?",[row.row_id]);
   else{let slot=1;while(used.has(slot))slot++;used.add(slot);await db.execute("INSERT INTO bind(qq,id,visible,slot_index,is_current,source) VALUES (?,?,0,?,0,'hiroba')",[ticket.principal.principal,id,slot]);}
  }
  const predicate='CAST(qq AS BINARY)=CAST(? AS BINARY)';
  await db.execute('UPDATE bind SET is_current=0 WHERE '+predicate,[ticket.principal.principal]);
  await db.execute('UPDATE bind SET is_current=1 WHERE '+predicate+' AND CAST(id AS BINARY)=CAST(? AS BINARY)',[ticket.principal.principal,ticket.target||ids[0]]);
  await db.execute(`INSERT INTO taiko_bind_identity_state(identity_key,current_virtual) VALUES (?,0)
   ON DUPLICATE KEY UPDATE current_virtual=0`,[ticket.principal.principal]);
 }
}
