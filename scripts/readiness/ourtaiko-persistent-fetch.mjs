// Only injected into the private real-link staging child. Never import in production.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const root='/var/tmp/taiko-viewer-ourtaiko-staging';
const privateRoot='/var/tmp/taiko-viewer-oidc-loopback/private';
const client=JSON.parse(await readFile(privateRoot+'/client.json','utf8'));
const account=JSON.parse(await readFile(privateRoot+'/test-account.json','utf8'));
const pinned=JSON.parse(await readFile(root+'/admission.json','utf8'));
assert.equal(process.env.TAIKO_OIDC_PERSISTENT_STAGING,'1');
assert.equal(client.clientId,'Sakura-staging');
const paths=new Map([['/.well-known/openid-configuration',['discovery','GET']],['/o/.well-known/jwks.json',['jwks','GET']],['/o/token/',['token','POST']],['/internal/v1/external/lookup',['lookup','POST']],['/internal/v1/external/link',['link','POST']]]);
const counts={application:'Sakura-staging',discovery:[],jwks:[],token:[],lookup:[],link:[],blocked:0,ownedAccountVerified:false,linkPermissionVerified:false};
let verifiedSub=null,linkSent=false,stop=false;
if(process.env.TAIKO_OURTAIKO_RECOVER_SAME_PAIR==='1'){
 const pair=JSON.parse(await readFile(root+'/evidence/pair.json','utf8'));
 const remote=JSON.parse(await readFile(root+'/evidence/first-remote-confirmation.json','utf8'));
 assert.equal(pair.application,client.clientId);assert.equal(pair.viewerId,pinned.reservedViewerId);assert.equal(pair.ownedTestAccountVerified,true);
 assert.equal(remote.httpStatus,200);assert.equal(remote.code,'OK');assert.equal(remote.ourtaikoSub,pair.ourtaikoSub);assert.equal(remote.viewerId,pair.viewerId);
 verifiedSub=pair.ourtaikoSub;counts.ownedAccountVerified=true;counts.recoveryOfConfirmedPair=true;
}
let saving=Promise.resolve();
const save=()=>{const text=JSON.stringify(counts,null,2)+'\n';saving=saving.then(()=>writeFile(root+'/evidence/network.json',text,{mode:0o600}));return saving;};
async function boundedJson(response){
 const reader=response.clone().body?.getReader();if(!reader)throw Error('Empty response');
 const decoder=new TextDecoder('utf-8',{fatal:true});let text='',bytes=0,done=false;
 try{while(true){const r=await reader.read();if(r.done){done=true;break;}bytes+=r.value.byteLength;if(bytes>32768)throw Error('Response limit');text+=decoder.decode(r.value,{stream:true});}return JSON.parse(text+decoder.decode());}
 finally{if(!done)void reader.cancel().catch(()=>{});reader.releaseLock();}
}
const original=globalThis.fetch;
await save();
globalThis.fetch=async(input,options={})=>{
 let route;
 try{
  const url=new URL(input instanceof Request?input.url:String(input));route=paths.get(url.pathname);
  const method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  assert.ok(url.origin==='https://sso.ourtaiko.org'&&!url.search&&!url.username&&!url.password&&route&&route[1]===method);
  if(route[0]==='link'){
   assert.ok(process.env.TAIKO_OURTAIKO_VERIFY_LINKED_LOGIN!=='1'&&!stop&&!linkSent&&verifiedSub&&counts.ownedAccountVerified);
   const data=JSON.parse(options.body),headers=new Headers(options.headers);
   assert.equal(data.id,verifiedSub);assert.equal(data.externalId,pinned.reservedViewerId);
   assert.deepEqual(Object.keys(data).sort(),['externalId','id']);
   assert.equal(headers.get('x-service-id'),client.clientId);assert.ok(headers.get('x-service-key')===client.clientSecret);
   assert.ok(!headers.has('origin')&&!headers.has('cookie')&&!headers.has('authorization'));
   linkSent=true;
  }
 }catch{counts.blocked++;await save();throw Error('Staging outbound policy');}
 try{
  const response=await original(input,{...options,redirect:'error'});
  counts[route[0]].push(response.status);
  if(route[0]==='lookup'&&response.status===200){
   const payload=await boundedJson(response),request=JSON.parse(options.body);
   assert.ok(payload.code==='OK'&&payload.data?.id===request.id&&/^[0-9a-f]{32}$/.test(request.id));
   assert.ok(payload.data.emailVerified===true&&typeof payload.data.email==='string'&&payload.data.email.toLowerCase()===account.email.toLowerCase());
   assert.ok(!verifiedSub||verifiedSub===request.id);verifiedSub=request.id;counts.ownedAccountVerified=true;
   await writeFile(root+'/evidence/pair.json',JSON.stringify({application:client.clientId,ourtaikoSub:verifiedSub,viewerId:pinned.reservedViewerId,ownedTestAccountVerified:true,verifiedAt:new Date().toISOString()},null,2)+'\n',{mode:0o600});
  }
  if(route[0]==='link'){
   const payload=await boundedJson(response);
   if(response.status===200&&payload.code==='OK'&&payload.data?.id===verifiedSub&&payload.data?.externalId===pinned.reservedViewerId){
    counts.linkPermissionVerified=true;
    await writeFile(root+'/evidence/remote-confirmation.json',JSON.stringify({application:client.clientId,ourtaikoSub:verifiedSub,viewerId:pinned.reservedViewerId,httpStatus:response.status,code:'OK',linkedAt:payload.data.linkedAt,confirmedAt:new Date().toISOString()},null,2)+'\n',{mode:0o600});
   }else stop=true;
  }
  await save();return response;
 }catch{stop=true;if(route[0]==='link'&&!counts.link.length)counts.link.push('UNKNOWN');await save();throw Error('Staging provider result unavailable');}
};
