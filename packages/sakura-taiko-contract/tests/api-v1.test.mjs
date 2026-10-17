import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import Ajv from '../../../taiko_viewer/node_modules/ajv/dist/ajv.js';
import {projectCatalog as mapCatalog,difficultyToTjaCourse} from '../src/catalog.mjs';
const schema=JSON.parse(readFileSync(new URL('../schema/contract-v1.json',import.meta.url)));
const fixtures=JSON.parse(readFileSync(new URL('../fixtures/api-v1.json',import.meta.url)));
const ajv=new Ajv({strict:true,allowUnionTypes:true});ajv.addSchema(schema);const validate=name=>ajv.compile({$ref:schema.$id+'#/$defs/'+name});
test('additions preserve every existing v1 definition and required field',()=>{
 const before=JSON.parse(execFileSync('git',['show','c9b87f4:packages/sakura-taiko-contract/schema/contract-v1.json'],{encoding:'utf8'}));
 for(const [name,definition] of Object.entries(before.$defs)){
  const current=structuredClone(schema.$defs[name]);if(name==='Song'||name==='Chart'){delete current.properties.availability;if(name==='Chart')delete current.properties.tjaCourse;}
  assert.deepEqual(current,definition,name+' existing contract changed');
 }
});
test('Catalog region, mode, shelf, difficulty/course and source IDs match frozen cross-language examples',()=>{
 assert.deepEqual(mapCatalog(fixtures.catalogInput,'synthetic-catalog-v1'),fixtures.catalogExpected);
 for(const song of fixtures.catalogExpected.songs)assert.equal(validate('Song')(song),true);
 for(const chart of fixtures.catalogExpected.charts)assert.equal(validate('Chart')(chart),true);
 for(let i=1;i<=5;i++)assert.equal(difficultyToTjaCourse(i),i-1);
 for(const bad of [0,6,1.5,'4',true])assert.throws(()=>difficultyToTjaCourse(bad));
 assert.throws(()=>mapCatalog([...fixtures.catalogInput,fixtures.catalogInput[0]],'r'));
});
test('grant DTO is canonical schema, while unopened scopes remain a separate runtime policy',()=>{
 assert.equal(validate('ResourceGrant')(fixtures.grant),true);
 assert.equal(validate('ResourceGrant')({...fixtures.grant,token:'forbidden'}),false);
 assert.equal(validate('ResourceGrant')({...fixtures.grant,audience:'other'}),false);
 const definition=schema.$defs.ResourceGrant;assert.ok(definition.properties.scopes.items.enum.includes('history:read'));
});

