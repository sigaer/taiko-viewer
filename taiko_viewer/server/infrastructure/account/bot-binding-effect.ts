import {createHash} from 'node:crypto';
import type {RowDataPacket} from 'mysql2/promise';
import type {BotBindingData,BotBindingIntent} from './bot-binding-rows.ts';
import {botBindingPayload} from './bot-binding-rows.ts';

export const bindingHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type BotBindingEffect = Readonly<
 {kind:'remove';removed:boolean;needsConfirmation:boolean} |
 {kind:'visibility';matched:number}
>;

export function effectHash(intent:BotBindingIntent,effect:BotBindingEffect){
 return bindingHash([bindingHash(intent),effect]);
}

/** Small, durable outcome; replay never deletes a newly rebound Source. */
export function receiptEffect(row:RowDataPacket,intent:BotBindingIntent):BotBindingEffect|undefined{
 if(intent.action!=='remove'&&intent.action!=='visibility')return undefined;
 if(typeof row.effect_json!=='string'||Buffer.byteLength(row.effect_json)>512)throw new Error('Invalid binding receipt');
 const value=JSON.parse(row.effect_json);
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid binding receipt');
 let effect:BotBindingEffect;
 if(intent.action==='remove'){
  if(Object.keys(value).length!==3||value.kind!=='remove'||typeof value.removed!=='boolean'||typeof value.needsConfirmation!=='boolean'||
    value.removed===value.needsConfirmation)throw new Error('Invalid binding receipt');
  effect={kind:'remove',removed:value.removed,needsConfirmation:value.needsConfirmation};
 }else{
  if(Object.keys(value).length!==2||value.kind!=='visibility'||!Number.isSafeInteger(value.matched)||value.matched<0||value.matched>128)throw new Error('Invalid binding receipt');
  effect={kind:'visibility',matched:value.matched};
 }
 if(row.effect_hash!==effectHash(intent,effect))throw new Error('Invalid binding receipt');
 return effect;
}

export function bindingResponse(principal:string,data:BotBindingData,intent:BotBindingIntent,effect?:BotBindingEffect){
 const binding=botBindingPayload(principal,data);
 if(!effect)return binding;
 return {...binding,operation:effect.kind==='remove'?{...effect,targetTaikoId:intent.sourceId}:effect};
}
