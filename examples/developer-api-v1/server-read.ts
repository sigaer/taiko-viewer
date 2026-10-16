import {createDeveloperApi,DeveloperApiError} from '../../taiko_viewer/lib/developer-api-v1.ts';
/** Server-side only. Supply a backend-held Key and a playerId from explicit owner consent.
 * Return data to your own authorized application flow; never log payloads or keys.
 */
export async function readAuthorizedScores(options:{baseUrl:string;key:string;playerId:string;fetcher?:typeof fetch}){
 const api=createDeveloperApi(options);
 // No If-None-Match or payload cache. A revoked/expired grant always reaches server authority.
 return (await api.scores(options.playerId)).data;
}
export async function readPublicCatalog(baseUrl:string,fetcher?:typeof fetch){
 return (await createDeveloperApi({baseUrl,fetcher}).songs()).data;
}
export function safeFailure(error:unknown){
 if(error instanceof DeveloperApiError)return {status:error.status,code:error.code,requestId:error.requestId};
 return {status:503,code:'CLIENT_FAILURE',requestId:null};
}
