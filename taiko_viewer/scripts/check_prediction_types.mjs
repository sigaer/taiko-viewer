import ts from 'typescript';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const files=['utils/prediction-evidence/types.ts','utils/prediction-evidence/personal.ts','utils/prediction-evidence/artifact.ts','server/services/prediction-evidence/preview.ts','tests/predictionArtifact.test.ts','tests/predictionEvidence.test.ts'].map(p=>resolve(root,p));
const program=ts.createProgram(files,{strict:true,noEmit:true,skipLibCheck:true,allowJs:true,checkJs:false,baseUrl:root,paths:{'~/*':['./*']},target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,allowImportingTsExtensions:true,resolveJsonModule:true,esModuleInterop:true,typeRoots:[resolve(root,'node_modules/@types')]});
const diagnostics=ts.getPreEmitDiagnostics(program);
for(const d of diagnostics)console.error(ts.formatDiagnostic(d,{getCurrentDirectory:()=>root,getCanonicalFileName:x=>x,getNewLine:()=> '\n'}));
if(diagnostics.length)process.exitCode=1;else console.log('PASS strict prediction evidence TypeScript');
