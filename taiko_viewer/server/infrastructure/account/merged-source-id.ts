import {validBotPrincipal} from './principal-policy.ts';
const prefix='u0v1_';
export const isMergedSource=(input:unknown)=>typeof input==='string'&&input.startsWith(prefix);
export function mergedSourceId(principal:string){
  if(!validBotPrincipal(principal))throw new Error('Invalid Bot principal');
  return prefix+Buffer.from(principal,'utf8').toString('base64url');
}
export function mergedSourcePrincipal(input:unknown){
  if(typeof input!=='string'||!/^u0v1_[A-Za-z0-9_-]{1,192}$/.test(input))throw new Error('Invalid merged identity');
  const principal=Buffer.from(input.slice(prefix.length),'base64url').toString('utf8');
  if(!validBotPrincipal(principal)||mergedSourceId(principal)!==input)throw new Error('Invalid merged identity');
  return principal;
}
