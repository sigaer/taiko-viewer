/** Compatibility JSON keeps score/Profile fields, never operational secrets.
 * The upstream panel, songs, achievement and dojo are the established DTO. */
const privateKey=/(?:password|passwd|cookie|credential|secret|authorization|access.?key|token|session|email|phone|card.?id|qr.?code)/i;
export function sanitizeDeveloperScores(data:Record<string,unknown>){
 let nodes=0;
 const copy=(value:unknown,depth=0):unknown=>{
  if(++nodes>1000000||depth>16)throw new Error('Score response limit');
  if(Array.isArray(value))return value.map(v=>copy(v,depth+1));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!privateKey.test(k)&&k!=='__proto__').map(([k,v])=>[k,copy(v,depth+1)]));
  return value;
 };
 return Object.fromEntries(['profile','songs','achievement','dojo','_meta'].filter(k=>Object.hasOwn(data,k)).map(k=>[k,copy(data[k])]));
}
