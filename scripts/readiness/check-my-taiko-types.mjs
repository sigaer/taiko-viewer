import ts from '../../taiko_viewer/node_modules/typescript/lib/typescript.js';
import {parse,compileScript} from '../../taiko_viewer/node_modules/@vue/compiler-sfc/dist/compiler-sfc.cjs.js';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const R=fileURLToPath(new URL('../../',import.meta.url)),V=resolve(R,'taiko_viewer');
const targets=['server/services/my-taiko/overview.ts','server/api/account/my-taiko/overview.get.ts','types/my-taiko.ts'].map(x=>resolve(V,x));
const config=ts.readConfigFile(resolve(V,'.nuxt/tsconfig.server.json'),ts.sys.readFile);const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,resolve(V,'.nuxt'));
const globals=resolve(V,'.nuxt/types/nitro-imports.d.ts');
const options={...parsed.options,noEmit:true,allowImportingTsExtensions:true,skipLibCheck:true};
const program=ts.createProgram([...targets,globals,resolve(V,'.nuxt/types/nitro-nuxt.d.ts')],options);
const diagnostics=ts.getPreEmitDiagnostics(program);const affected=diagnostics.filter(d=>d.file&&targets.includes(resolve(d.file.fileName)));
const format=d=>({file:d.file?.fileName?.replace(R,''),code:d.code,line:d.file?d.file.getLineAndCharacterOfPosition(d.start||0).line+1:null,message:ts.flattenDiagnosticMessageText(d.messageText,' ')});
const sfc=[];for(const name of ['components/my-taiko/Overview.vue','pages/my/index.vue']){const source=await readFile(resolve(V,name),'utf8');const {descriptor,errors}=parse(source);if(errors.length)throw new Error('SFC parse failed: '+name);const result=compileScript(descriptor,{id:'my-taiko-qa',inlineTemplate:true});const parsed=ts.transpileModule(result.content,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext},reportDiagnostics:true});const errors2=parsed.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error)||[];if(errors2.length)throw new Error('SFC TypeScript compile failed: '+name);sfc.push({file:name,status:'SFC_TS_TEMPLATE_COMPILE_PASS'});}
const report={status:affected.length?'FAIL':'PASS_SCOPED',affectedTypeDiagnostics:affected.map(format),transitiveDiagnosticsOutsideScope:diagnostics.length-affected.length,scope:'Semantic TypeScript on changed server/type files; Vue SFC script/template compilation, plus real Nuxt browser runtime. Not a whole repository type certification or vue-tsc template semantic certification.',sfc};await writeFile(resolve(process.env.QA_EVIDENCE_DIR,'my-taiko-types.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));process.exitCode=affected.length?1:0;
