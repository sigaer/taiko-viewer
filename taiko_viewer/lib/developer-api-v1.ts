import type {CatalogSongsResponse,CatalogChartsResponse,DeveloperScoresResponse,DeveloperProfileResponse} from '@sakura-taiko/contract';
export class DeveloperApiError extends Error {
 constructor(public status:number,public code:string,public requestId:string|null){super(code);}
}
/** No response cache and no inferred owner/consent. A Key supplies client identity only. */
export function createDeveloperApi(options:{baseUrl:string;key?:string;fetcher?:typeof fetch}){
 const base=new URL(options.baseUrl);if(base.username||base.password||base.search||base.hash||base.pathname!=='/'||!['http:','https:'].includes(base.protocol)||base.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw new Error('Use an explicit HTTPS origin or isolated loopback origin');
 const fetcher=options.fetcher||fetch;
 async function read<T>(path:string,etag?:string):Promise<{data:T|null;etag:string|null;notModified:boolean}>{
  const response=await fetcher(new URL('/api/v1/taiko/'+path,base),{headers:{...(options.key?{authorization:'Bearer '+options.key}:{}),...(etag?{'if-none-match':etag}:{})},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(response.status===304)return {data:null,etag:response.headers.get('etag'),notModified:true};
  const data=await response.json();if(!response.ok)throw new DeveloperApiError(response.status,typeof data?.code==='string'?data.code:'UNAVAILABLE',typeof data?.requestId==='string'?data.requestId:null);
  return {data:data as T,etag:response.headers.get('etag'),notModified:false};
 }
 const resource=(playerId:string)=>{if(!/^plr_[a-f0-9]{32}$/.test(playerId))throw new Error('Invalid player ID');return 'players/'+playerId;};
 return {meta:()=>read<Record<string,unknown>>('meta'),songs:()=>read<CatalogSongsResponse>('catalog/songs'),charts:()=>read<CatalogChartsResponse>('catalog/charts'),scores:(playerId:string,etag?:string)=>read<DeveloperScoresResponse>(resource(playerId)+'/scores',etag),profile:(playerId:string,etag?:string)=>read<DeveloperProfileResponse>(resource(playerId)+'/profile',etag)};
}
