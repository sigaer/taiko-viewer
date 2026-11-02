// Loaded only into the owned loopback Nuxt child. Never log URL queries,
// headers, bodies, credentials, codes, cookies or tokens.
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const target=resolve(process.env.QA_EVIDENCE_DIR,'oidc-loopback-network.json');
const paths=new Map([
 ['/.well-known/openid-configuration',['discovery','GET']],
 ['/o/.well-known/jwks.json',['jwks','GET']],
 ['/o/token/',['token','POST']],
 ['/internal/v1/external/lookup',['lookup','POST']]
]);
const counts={discovery:{requests:0,ok:0,failed:0},jwks:{requests:0,ok:0,failed:0},token:{requests:0,ok:0,failed:0},lookup:{requests:0,ok:0,failed:0},blocked:0,metadataVerified:false};
const original=globalThis.fetch;
let writing=Promise.resolve();
function save(){const data=JSON.stringify(counts,null,2)+'\n';writing=writing.then(()=>writeFile(target,data,{mode:0o600})).catch(()=>{});return writing;}
await save();
globalThis.fetch=async(input,options={})=>{
 let url;try{url=new URL(input instanceof Request?input.url:String(input));}catch{counts.blocked++;await save();throw Error('Loopback outbound policy');}
 const route=paths.get(url.pathname),method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if(url.origin!=='https://sso.ourtaiko.org'||url.search||url.username||url.password||!route||method!==route[1]){counts.blocked++;await save();throw Error('Loopback outbound policy');}
 const row=counts[route[0]];row.requests++;
 try{
  const response=await original(input,{...options,redirect:'error'});
  response.ok?row.ok++:row.failed++;await save();return response;
 }catch{row.failed++;await save();throw Error('Loopback provider request failed');}
};
// Read public metadata with Node's actual TLS trust store, without client
// credentials or an authorization request. Do not claim a login from this.
try{
 const response=await fetch('https://sso.ourtaiko.org/.well-known/openid-configuration',{signal:AbortSignal.timeout(8000)});
 if(!response.ok||!response.body)throw Error();
 const decoder=new TextDecoder('utf-8',{fatal:true});let text='',bytes=0;
 for await(const chunk of response.body){bytes+=chunk.byteLength;if(bytes>32768)throw Error();text+=decoder.decode(chunk,{stream:true});}
 const metadata=JSON.parse(text+decoder.decode());
 if(metadata.issuer!=='https://sso.ourtaiko.org'||!metadata.scopes_supported?.includes('openid')||!metadata.scopes_supported?.includes('profile')||!metadata.code_challenge_methods_supported?.includes('S256')||!metadata.id_token_signing_alg_values_supported?.includes('RS256')||!metadata.token_endpoint_auth_methods_supported?.includes('client_secret_basic'))throw Error();
 for(const key of ['authorization_endpoint','token_endpoint','jwks_uri'])if(new URL(metadata[key]).origin!=='https://sso.ourtaiko.org')throw Error();
 counts.metadataVerified=true;await save();
}catch{throw Error('Real OurTaiko public metadata preflight failed');}
