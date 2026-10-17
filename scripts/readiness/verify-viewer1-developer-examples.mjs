import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {bundleOpenApi} from '../../examples/developer-api-v1/bundle-openapi.mjs';
const R=fileURLToPath(new URL('../../',import.meta.url)),require=createRequire(resolve(R,'taiko_viewer/package.json')),esbuild=require('esbuild'),Ajv=require('ajv');
const bundled=await bundleOpenApi();let refs=0;
function check(v){if(Array.isArray(v))return v.forEach(check);if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(k==='$ref'){assert.ok(x.startsWith('#/'));let target=bundled;for(const part of x.slice(2).split('/'))target=target[part.replaceAll('~1','/').replaceAll('~0','~')];assert.ok(target);refs++;}else check(x);}}
check(bundled);const bundleFile=resolve(process.env.QA_EVIDENCE_DIR,'developer-api-v1-bundled.json');await writeFile(bundleFile,JSON.stringify(bundled,null,2)+'\n');
const ajv=new Ajv({strict:false,allowUnionTypes:true});let examples=0;for(const methods of Object.values(bundled.paths))for(const op of Object.values(methods))for(const c of [...Object.values(op.responses).flatMap(r=>Object.values(r.content||{})),...Object.values(op.requestBody?.content||{})]){
 const check=ajv.compile({...c.schema,components:bundled.components});for(const example of [...(c.example===undefined?[]:[c.example]),...Object.values(c.examples||{}).map(x=>x.value)]){assert.equal(check(example),true,JSON.stringify(check.errors));examples++;}
}
const output=resolve(process.env.QA_RUN_TMPDIR,'server-example.mjs');try{await esbuild.build({entryPoints:[resolve(R,'examples/developer-api-v1/server-read.ts')],bundle:true,platform:'node',format:'esm',target:'node24',outfile:output,logLevel:'silent'});}finally{esbuild.stop();}
const sdk=await import(pathToFileURL(output));let revoked=false,requests=0,privateRequests=0;const observations=[];
const fixture=bundled.paths['/api/v1/taiko/players/{playerId}/scores'].get.responses['200'].content['application/json'].example;
const catalog=bundled.paths['/api/v1/taiko/catalog/songs'].get.responses['200'].content['application/json'].example;
const key='synthetic-key-held-only-in-backend',player=fixture.playerId;
const server=createServer((req,res)=>{requests++;res.setHeader('cache-control','private, no-store');res.setHeader('content-type','application/json');
 if(req.url==='/api/v1/taiko/catalog/songs'){assert.equal(req.headers.authorization,undefined);res.end(JSON.stringify(catalog));return;}
 privateRequests++;assert.equal(req.headers.authorization,'Bearer '+key);assert.equal(req.headers['if-none-match'],undefined);assert.equal(req.url,'/api/v1/taiko/players/'+player+'/scores');
 if(revoked){res.statusCode=403;res.end(JSON.stringify({code:'GRANT_REQUIRED',message:'GRANT_REQUIRED',requestId:'synthetic-request'}));}else res.end(JSON.stringify(fixture));
});
try{
 server.listen(0,'127.0.0.1');await once(server,'listening');const baseUrl='http://127.0.0.1:'+server.address().port;
 assert.ok((await sdk.readPublicCatalog(baseUrl)).items.length);observations.push('public-example-without-key');
 const scores=await sdk.readAuthorizedScores({baseUrl,key,playerId:player});assert.equal(scores.playerId,player);observations.push('server-private-example-reads');
 revoked=true;let refusal;try{await sdk.readAuthorizedScores({baseUrl,key,playerId:player});}catch(error){refusal=sdk.safeFailure(error);}assert.deepEqual(refusal,{status:403,code:'GRANT_REQUIRED',requestId:'synthetic-request'});assert.equal(privateRequests,2);observations.push('revocation-no-cache-no-automatic-retry');
 assert.equal(requests,3);
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
const report={status:'PASS_SCOPED',examples,internalRefs:refs,bundleSha256:createHash('sha256').update(await readFile(bundleFile)).digest('hex'),observations,serverClosed:!server.listening,scope:'SDK example against synthetic loopback transport; real SQL authority evidence is separately reused',contractFrozen:false,productionAccess:false};await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'developer-examples.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
