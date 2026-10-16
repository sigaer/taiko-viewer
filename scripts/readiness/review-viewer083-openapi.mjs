import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const R=fileURLToPath(new URL('../../',import.meta.url)),require=createRequire(resolve(R,'taiko_viewer/package.json')),YAML=require('yaml'),Ajv=require('ajv');
const path=resolve(R,'docs/083-developer-api-openapi.yaml'),doc=YAML.parse(await readFile(path,'utf8')),schema=JSON.parse(await readFile(resolve(R,doc['x-schema-source']),'utf8'));
const ajv=new Ajv({strict:false,allowUnionTypes:true});ajv.addSchema(schema);
function refs(v){if(Array.isArray(v))return v.map(refs);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k==='$ref'&&x.startsWith('../packages/')?schema.$id+x.slice(x.indexOf('#')):refs(x)]));return v;}
let operations=0,examples=0;
for(const [path,methods] of Object.entries(doc.paths))for(const [method,op] of Object.entries(methods)){
 operations++;const route=path.replace('/api/','').replace(/\{([^}]+)\}/g,'[$1]');let source;
 try{source=await readFile(resolve(R,'taiko_viewer/server/api',route+'.'+method+'.ts'),'utf8');}catch{source=await readFile(resolve(R,'taiko_viewer/server/api',route,'index.'+method+'.ts'),'utf8');}assert.ok(source);
 for(const c of [...Object.values(op.responses).flatMap(r=>Object.values(r.content||{})),...Object.values(op.requestBody?.content||{})]){
  const validate=ajv.compile(refs(c.schema));for(const example of [...(c.example===undefined?[]:[c.example]),...Object.values(c.examples||{}).map(x=>x.value)]){assert.equal(validate(example),true,method+' '+path+': '+JSON.stringify(validate.errors));examples++;}
 }
}
assert.equal(operations,11);assert.equal(doc['x-lifecycle-policy'].contractFrozen,false);assert.equal(doc['x-lifecycle-policy'].runtimeDefaultEnabled,false);
const meta=doc.paths['/api/v1/taiko/meta'].get.responses['200'].content['application/json'];assert.deepEqual(meta.schema.properties.status.enum,['FREEZE_CANDIDATE','CONTRACT_FROZEN']);assert.equal(meta.example.contractFrozen,false);
const checkMeta=ajv.compile(refs(meta.schema));assert.equal(checkMeta({...meta.example,status:'CONTRACT_FROZEN',contractFrozen:false}),false);assert.equal(checkMeta({...meta.example,status:'CONTRACT_FROZEN',contractFrozen:true}),true);
const score=doc.paths['/api/v1/taiko/players/{playerId}/scores'].get.responses['200'].content['application/json'];const leak=structuredClone(score.example);leak.items[0].legacy={credential:'forbidden'};assert.equal(ajv.compile(refs(score.schema))(leak),false);
async function sha(path){const h=createHash('sha256');for await(const b of createReadStream(path))h.update(b);return h.digest('hex');}
const matrix=JSON.parse(await readFile(resolve(R,'docs/083-contract-and-api-matrix.json'),'utf8'));const reused=[];for(const name of ['contract','sqlHttp','browser','build','openapi']){const e=matrix.validation[name].evidence;assert.equal(await sha(e.path),e.sha256,name+' immutable evidence');reused.push({name,...e,scope:'historical ac10427 evidence; not a rerun or full revised runtime certification'});}
assert.equal(await sha(resolve(R,'packages/sakura-taiko-contract/schema/contract-v1.json')),'c9c93ad60185753cc36b62c80e094a42a84612bac19e6353f94a0143236ba46d');
const manifest=JSON.parse(await readFile(resolve(R,'docs/083-release-manifest.json'),'utf8'));assert.equal(createHash('sha256').update(JSON.stringify(schema)).digest('hex'),manifest.schemaSerializedRevision);for(const f of manifest.files)assert.equal(await sha(resolve(R,f.path)),f.sha256,'release input '+f.path);
const report={status:'PASS_SCOPED',operations,examples,openapiSha256:await sha(path),manifestSha256:await sha(resolve(R,'docs/083-release-manifest.json')),reused,productionAccess:false};await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'freeze-openapi-review.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,operations,examples,reusedEvidence:reused.length}));
