// Strict checking of the changed server boundary; IO adapters retain explicit typed fixture contracts.
import ts from 'typescript';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const config=ts.readConfigFile(resolve(root,'tests/fixtures/portfolio.tsconfig.json'),ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,resolve(root,'tests/fixtures'));
const files=[...parsed.fileNames,...['portfolio-service.ts','portfolio-evaluation.ts','portfolio-evaluator.ts','sync-portfolio.ts','portfolio-read-negotiation.ts'].map(p=>resolve(root,'server/services/goals',p))];
const stubs=new Map(Object.entries({
 'server/internal/account/shared.ts':`export async function getCurrentBindingRow(userId:number):Promise<{id:number;taiko_id:string;source:string}|null>{return null;}`,
 'server/utils/account-db.ts':`export function getAccountDb():import('mysql2/promise').Pool{throw Error();}`,
 'server/services/content/index.ts':`export async function getSongCatalog():Promise<Array<{id:number;song_name:string;[key:string]:unknown}>>{return [];}`,
 'server/services/content/catalogAuthority.ts':`export async function captureCatalogAuthority():Promise<{root:string;data:import('../../../utils/multi-objective/contracts').CatalogAuthoritySnapshot}>{throw Error();}export async function readCatalogPointerRevision(root:string):Promise<string>{return '';}`,
 'server/services/goals/snapshot.ts':`export async function readGoalSnapshot(id:string,verify?:boolean):Promise<{current:{songs?:Record<string,unknown>[]};revision:string;capturedAt:string;provenance:import('../../../utils/goalEvaluation').GoalProvenance|null}>{throw Error();}`,
 'server/services/taiko-domain/publication.ts':`export async function withDomainScoreRead<T>(id:string,task:()=>Promise<T>):Promise<T>{return task();}`,
 'server/services/goals/evaluation.ts':`export async function evaluateCurrentGoalForBinding(userId:number,body:Record<string,unknown>,before:import('./sync-observation').SyncObservation|null):Promise<import('../../../types/goal-evaluation').GoalEvaluationResponse>{throw Error();}`
}).map(([p,code])=>[resolve(root,p),code]));
parsed.options.typeRoots=[resolve(root,'node_modules/@types')];parsed.options.allowJs=true;
const host=ts.createCompilerHost(parsed.options),original=host.getSourceFile.bind(host);
host.getSourceFile=(path,language,onError,create)=>stubs.has(path)?ts.createSourceFile(path,stubs.get(path),language,true):original(path,language,onError,create);
const program=ts.createProgram(files,{...parsed.options,typeRoots:[resolve(root,'node_modules/@types')],allowJs:true,configFilePath:resolve(root,'tests/fixtures/portfolio.tsconfig.json')},host),diagnostics=ts.getPreEmitDiagnostics(program);
for(const d of diagnostics)console.error(ts.formatDiagnostic(d,{getCurrentDirectory:()=>root,getCanonicalFileName:x=>x,getNewLine:()=> '\n'}));
if(diagnostics.length)process.exitCode=1;else console.log('PASS strict Portfolio server TypeScript (typed IO boundaries)');
