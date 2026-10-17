import {readServerAllowlist} from '../../infrastructure/server-allowlist.ts';
import {createHash,randomUUID} from 'node:crypto';
import {defineEventHandler,getHeader,setHeader,removeResponseHeader,setResponseStatus,type H3Event} from 'h3';
export const AUDIENCE='viewer:developer-api:v1';
export const CONSENT_VERSION='viewer-resource-consent-v1';
export const OPEN_SCOPES=['profile:read','scores:read'] as const;
export class ApiFailure extends Error { constructor(public status:number,public code:string){super(code);} }
export const deny=()=>new ApiFailure(403,'GRANT_REQUIRED');
export const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
export async function enabled(){
 const c=useRuntimeConfig();if(!(c.developerApiV1===true||String(c.developerApiV1)==='1'))return false;
 const policy=await readServerAllowlist(c.developerApiClientAllowlistPath,'clientIds',/^clt_[a-f0-9]{32}$/);
 return Boolean(policy?.ids.size);
}
export async function requireEnabled(){if(!await enabled())throw new ApiFailure(404,'NOT_FOUND');}
export function exactKeys(value:Record<string,unknown>,keys:string[]){if(Object.keys(value).some(k=>!keys.includes(k)))throw new ApiFailure(400,'INVALID_REQUEST');}
export function apiHandler(task:(event:H3Event)=>Promise<unknown>){return defineEventHandler(async event=>{
 const requestId=randomUUID();setHeader(event,'cache-control','private, no-store');setHeader(event,'vary','Authorization, Cookie');setHeader(event,'x-request-id',requestId);
 try{await requireEnabled();const result=await task(event);await requireEnabled();return result;}catch(error){removeResponseHeader(event,'etag');const e=error instanceof ApiFailure?error:new ApiFailure(503,'UNAVAILABLE');setResponseStatus(event,e.status);return {code:e.code,message:e.code,requestId};}
});}
export function conditional(event:H3Event,payload:unknown,privateRead=false){
 const text=JSON.stringify(payload);if(Buffer.byteLength(text)>8*1024*1024)throw new ApiFailure(503,'RESPONSE_LIMIT_EXCEEDED');
 const etag='"v1-'+hash(text)+'"';setHeader(event,'etag',etag);
 setHeader(event,'cache-control',privateRead?'private, no-store':'public, max-age=60, must-revalidate');
 if(getHeader(event,'if-none-match')===etag){setResponseStatus(event,304);return null;}return payload;
}
