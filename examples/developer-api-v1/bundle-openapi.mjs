import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const R=new URL('../../',import.meta.url),require=createRequire(new URL('taiko_viewer/package.json',R)),YAML=require('yaml');
/** Offline-only bundling. Resolve only the single canonical repository Schema. */
export async function bundleOpenApi(){
 const doc=YAML.parse(await readFile(new URL('docs/083-developer-api-openapi.yaml',R),'utf8'));
 const schema=JSON.parse(await readFile(new URL('packages/sakura-taiko-contract/schema/contract-v1.json',R),'utf8'));
 function walk(v){if(Array.isArray(v))return v.map(walk);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>{
  if(k==='$ref'){
   if(x.startsWith('../packages/sakura-taiko-contract/schema/contract-v1.json#'))return [k,'#/components/schemas/Contract'+x.split('#')[1]];
   if(x.startsWith('#/$defs/'))return [k,'#/components/schemas/Contract'+x.slice(1)];
   if(!x.startsWith('#/'))throw new Error('Unapproved OpenAPI reference');
  }return [k,walk(x)];}));return v;}
 const bundled=walk(doc);bundled.components.schemas={...(bundled.components.schemas||{}),Contract:walk(schema)};
 // Embedded schema is an offline rendering of the canonical source, not another authority.
 delete bundled.components.schemas.Contract.$id;return bundled;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)throw new Error('Pass a disk-backed output file path');
 await writeFile(process.argv[2],JSON.stringify(await bundleOpenApi(),null,2)+'\n',{flag:'wx'});
}
