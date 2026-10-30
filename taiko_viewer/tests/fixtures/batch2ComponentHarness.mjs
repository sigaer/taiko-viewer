import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {parse,compileScript} from '@vue/compiler-sfc';
import {createRenderer,h,Suspense,nextTick} from 'vue';
const vue=new URL('../../node_modules/vue/dist/vue.runtime.esm-bundler.js',import.meta.url).href;
let instance = 0;
export async function component(path, sourceRoot = new URL('../../',import.meta.url)){
 const source=await readFile(new URL(path,sourceRoot),'utf8');
 let code=compileScript(parse(source).descriptor,{id:'batch2-component'}).content;
 code=code.replace(/from ["']vue["']/g,'from '+JSON.stringify(vue))
 .replace(/import \{ ElMessage, ElMessageBox \} from "element-plus";/g,'const { ElMessage, ElMessageBox } = globalThis.__batch2Messages;')
 .replace(/import \{ ElMessage \} from "element-plus";/g,'const { ElMessage } = globalThis.__batch2Messages;')
 .replace(/import \{ buildPageDescription \} from "~\/utils\/seo";/g,'const buildPageDescription = x => x;')
 .replace(/(["'])~\/utils\/([A-Za-z]+)\1/g,(_,q,name)=>JSON.stringify(new URL('../../utils/'+name+'.ts',import.meta.url).href));
 const compiled=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 let result;try{result=(await import('data:text/javascript,'+encodeURIComponent(compiled+'\n// fixture '+(++instance)))).default;}catch{throw new Error('SFC harness import failed: '+path);}
 result.render=()=>h('div');return result;
}
const renderer=createRenderer({createElement:()=>({}),insert:()=>{},remove:()=>{},setElementText:()=>{},patchProp:()=>{},parentNode:()=>null,nextSibling:()=>null,createText:()=>({}),createComment:()=>({}),setText:()=>{},setComment:()=>{}});
export async function mount(component,props={}){
 const app=renderer.createApp({render:()=>h(Suspense,null,{default:()=>h(component,props)})});app.mount({});
 for(let i=0;i<20;i++)await nextTick();
 const model=app._instance.subTree.suspense.activeBranch.component.setupState;
 return {model,close:()=>app.unmount(),deactivate:()=>app._instance.subTree.suspense.activeBranch.component.da?.forEach(fn=>fn()),activate:()=>app._instance.subTree.suspense.activeBranch.component.a?.forEach(fn=>fn())};
}
