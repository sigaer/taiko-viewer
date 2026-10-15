import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {createApp,createError,defineEventHandler,toNodeListener} from 'h3';
import privateCache from '../server/middleware/private-cache.ts';
import {privateSourceResponse,recordPrivateSourceView} from '../server/infrastructure/account/private-source-response.ts';

async function fixture(task:(request:(path:string,headers?:Record<string,string>)=>Promise<Response>)=>Promise<void>,withMiddleware=true){
  const app=createApp();
  if(withMiddleware)app.use(privateCache);
  app.use(defineEventHandler(event=>{
    if(event.path.startsWith('/api/developer/'))return privateSourceResponse(event,'current',async()=>{
      if(event.node.req.headers.authorization==='Bearer synthetic-unavailable')throw createError({statusCode:503,statusMessage:'Unavailable'});
      if(event.node.req.headers.authorization!=='Bearer synthetic-owner')throw createError({statusCode:403,statusMessage:'Denied'});
      recordPrivateSourceView(event,{commitId:'synthetic',sequence:1});
      return {score:123};
    });
    if(event.path.includes('/denied'))throw createError({statusCode:401,statusMessage:'Denied'});
    return {ok:true};
  }));
  const server=createServer(toNodeListener(app));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert.ok(address&&typeof address!=='string');
  try{await task((path,headers={})=>fetch(`http://127.0.0.1:${address.port}${path}`,{headers,signal:AbortSignal.timeout(3000)}));}
  finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}

test('private proxy/internal success and denial responses disallow storage', {timeout:10000},()=>fixture(async request=>{
  for(const prefix of ['/api/taiko/proxy/bind','/api/taiko/proxy/hiroba/credentials/123','/api/taiko/internal/manual','/api/account/bindings']){
    for(const suffix of ['','/denied']){
      const response=await request(prefix+suffix);
      assert.equal(response.status,suffix?401:200);
      assert.equal(response.headers.get('cache-control'),'private, no-store');
      await response.text();
    }
  }
  const publicResponse=await request('/api/taiko/manifest');
  assert.equal(publicResponse.headers.get('cache-control'),null);await publicResponse.text();
}));

test('matching private ETag cannot turn lost authority into cached success', {timeout:10000},()=>fixture(async request=>{
  const path='/api/developer/userdata/123';
  const first=await request(path,{authorization:'Bearer synthetic-owner'});
  assert.equal(first.status,200);const etag=first.headers.get('etag');assert.ok(etag);await first.text();
  const hit=await request(path,{authorization:'Bearer synthetic-owner','if-none-match':etag});
  assert.equal(hit.status,304);assert.equal(hit.headers.get('cache-control'),'private, no-cache, must-revalidate');
  const denied=await request(path,{'if-none-match':etag});
  assert.equal(denied.status,403);assert.equal(denied.headers.get('cache-control'),'private, no-store');
  assert.equal(denied.headers.get('etag'),null);assert.equal(denied.headers.get('x-taiko-source-view'),null);
  assert.match(denied.headers.get('vary')||'',/Authorization/);await denied.text();
  const failed=await request(path,{authorization:'Bearer synthetic-unavailable','if-none-match':etag});
  assert.equal(failed.status,503);assert.equal(failed.headers.get('cache-control'),'private, no-store');
  assert.equal(failed.headers.get('etag'),null);await failed.text();
}));

test('private response helper protects failures when used without route middleware', {timeout:10000},()=>fixture(async request=>{
  for(const authorization of ['', 'Bearer synthetic-unavailable']){
    const response=await request('/api/developer/userdata/123',{authorization});
    assert.equal(response.status,authorization?503:403);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.equal(response.headers.get('etag'),null);await response.text();
  }
},false));
