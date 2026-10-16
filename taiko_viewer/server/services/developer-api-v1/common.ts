import {createHash,randomUUID} from 'node:crypto';
import {defineEventHandler,getHeader,setHeader,setResponseStatus,type H3Event} from 'h3';
export const AUDIENCE='viewer:developer-api:v1';
export const CONSENT_VERSION='viewer-resource-consent-v1';
export const OPEN_SCOPES=['profile:read','scores:read'] as const;
export class ApiFailure extends Error { constructor(public status:number,public code:string){super(code);} }
export const deny=()=>new ApiFailure(403,'GRANT_REQUIRED');
export const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
export function enabled(){const c=useRuntimeConfig();return c.developerApiV1===true||String(c.developerApiV1)==='1';}
export function requireEnabled(){if(!enabled())throw new ApiFailure(404,'NOT_FOUND');}
export function exactKeys(value:Record<string,unknown>,keys:string[]){if(Object.keys(value).some(k=>!keys.includes(k)))throw new ApiFailure(400,'INVALID_REQUEST');}
export function apiHandler(task:(event:H3Event)=>Promise<unknown>){return defineEventHandler(async event=>{
 const requestId=randomUUID();setHeader(event,'cache-control','private, no-store');setHeader(event,'vary','Authorization, Cookie');setHeader(event,'x-request-id',requestId);
 try{requireEnabled();return await task(event);}catch(error){const e=error instanceof ApiFailure?error:new ApiFailure(503,'UNAVAILABLE');setResponseStatus(event,e.status);return {code:e.code,message:e.code,requestId};}
});}
export function conditional(event:H3Event,payload:unknown,privateRead=false){
 const text=JSON.stringify(payload);if(Buffer.byteLength(text)>8*1024*1024)throw new ApiFailure(503,'UNAVAILABLE');
 const etag='"v1-'+hash(text)+'"';setHeader(event,'etag',etag);
 setHeader(event,'cache-control',privateRead?'private, no-store':'public, max-age=60, must-revalidate');
 if(getHeader(event,'if-none-match')===etag){setResponseStatus(event,304);return null;}return payload;
}
