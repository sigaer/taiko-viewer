// Explicit administrative/test CLI loader. It is not imported by server routes.
import {registerHooks} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
export function installSchemaModuleLoader(){
 const root=new URL('../',import.meta.url);
 return registerHooks({
  resolve(specifier,context,next){
   let target;
   if(specifier.startsWith('~/'))target=new URL(specifier.slice(2),root);
   else if(specifier.startsWith('.')&&context.parentURL?.startsWith(root.href)&&!context.parentURL.includes('/node_modules/'))target=new URL(specifier,context.parentURL);
   if(target){if(!existsSync(fileURLToPath(target))&&existsSync(fileURLToPath(target)+'.ts'))target=new URL(target.href+'.ts');return next(target.href,context);}
   return next(specifier,context);
  },
  load(url,context,next){
   if(url.startsWith(root.href)&&url.endsWith('.ts'))return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};
   return next(url,context);
  }
 });
}
