import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import Ajv from 'ajv/dist/2020.js';
import {developerApis} from '../../utils/developer-api-guide.ts';
const require=createRequire(import.meta.url),yaml=require('yaml');
export function guideContract(){return yaml.parse(readFileSync(new URL('../../../docs/developer-api-batch1-openapi.yaml',import.meta.url),'utf8'));}
export function validateGuideResponse(kind,body){
 const contract=guideContract(),api=developerApis.find(x=>x.id===kind);
 const ajv=new Ajv({strict:false});for(const [name,schema]of Object.entries(contract.components.schemas))ajv.addSchema(schema,'#/components/schemas/'+name);
 const schema=contract.paths[api.path].get.responses['200'].content['application/json'].schema;
 const validate=ajv.compile(schema);assert.ok(validate(body),kind+': '+JSON.stringify(validate.errors));
}
