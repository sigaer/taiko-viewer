import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from '../../../taiko_viewer/node_modules/ajv/dist/ajv.js';
import {projectCatalog as mapCatalog,difficultyToTjaCourse} from '../src/catalog.mjs';
const schema=JSON.parse(readFileSync(new URL('../schema/contract-v1.json',import.meta.url)));
const fixtures=JSON.parse(readFileSync(new URL('../fixtures/api-v1.json',import.meta.url)));
const ajv=new Ajv({strict:true,allowUnionTypes:true});ajv.addSchema(schema);const validate=name=>ajv.compile({$ref:schema.$id+'#/$defs/'+name});
test('Contract 1.1 Song uses source names and does not duplicate title',()=>{
 assert.equal(schema.$id,'urn:sakura-taiko:contract:1.1');
 assert.equal(schema.$defs.ApiReadVersions.properties.contractVersion.enum[0],'1.1');
 assert.deepEqual(Object.keys(schema.$defs.Song.properties),['songId','song_name','song_name_jp','aliases','catalogRevision','availability']);
 assert.equal(Object.hasOwn(schema.$defs.Song.properties,'title'),false);
});
test('Contract 1.1 catalog names, aliases, region, mode, shelf and difficulty/course match cross-language examples',()=>{
 assert.deepEqual(mapCatalog(fixtures.catalogInput,'synthetic-catalog-v1',fixtures.aliasInput),fixtures.catalogExpected);
 for(const song of fixtures.catalogExpected.songs)assert.equal(validate('Song')(song),true);
 for(const chart of fixtures.catalogExpected.charts)assert.equal(validate('Chart')(chart),true);
 for(let i=1;i<=5;i++)assert.equal(difficultyToTjaCourse(i),i-1);
 for(const bad of [0,6,1.5,'4',true])assert.throws(()=>difficultyToTjaCourse(bad));
 assert.throws(()=>mapCatalog([...fixtures.catalogInput,fixtures.catalogInput[0]],'r'));
 assert.throws(()=>mapCatalog(fixtures.catalogInput,'r',[{id:1,aliases:[]},{id:1,aliases:[]}]));
 assert.throws(()=>mapCatalog(fixtures.catalogInput,'r',[{id:'9007199254740992',aliases:[]}]));
});
test('grant DTO is canonical schema, while unopened scopes remain a separate runtime policy',()=>{
 assert.equal(validate('ResourceGrant')(fixtures.grant),true);
 assert.equal(validate('ResourceGrant')({...fixtures.grant,token:'forbidden'}),false);
 assert.equal(validate('ResourceGrant')({...fixtures.grant,audience:'other'}),false);
 const definition=schema.$defs.ResourceGrant;assert.ok(definition.properties.scopes.items.enum.includes('history:read'));
});

