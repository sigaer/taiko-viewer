// Production SFC scripts with controlled lifecycle/transport; not DOM or SQL.
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {reactivePorts} from './forumHandlerHarness.mjs';
export {deferred,settle} from './forumHandlerHarness.mjs';
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const strip=s=>stripTypeScriptTypes(s.replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\r?\n/gm,''),{mode:'strip'});
export async function accountPage(path,exposed,api,options={}){
 const r=reactivePorts(),user=r.ref(options.user??null),states=new Map([['account-user',user],['account-binding-generation',r.ref(0)]]),messages=[],navigations=[],remembered=[];
 const authError=r.ref(null);
 const resource={data:r.ref(options.data??null),pending:r.ref(false),error:r.ref(''),refresh:async()=>{},accept:v=>{resource.data.value=v;}};
 resource.refreshCurrent=resource.refresh;
 const ports={...r,useState:(key,factory)=>{if(!states.has(key))states.set(key,r.ref(factory()));return states.get(key);},useI18n:()=>({t:k=>k,locale:r.ref('zh')}),useLocalePath:()=>p=>p,useRoute:()=>({query:options.query??{}}),useViewerApiFetch:()=>api,useAccountState:()=>({accountUser:user,accountAuthError:authError,fetchCurrentUser:async()=>{const next=options.session?await options.session():{id:1};user.value=next;authError.value=options.sessionError&&!next?'Synthetic auth read failure':null;return next;}}),useAnnualBeta:()=>({track:()=>{}}),useRememberedAccountIdentifier:()=>({loadRememberedIdentifier:()=>({enabled:false,identifier:''}),saveRememberedIdentifier:(id,on)=>remembered.push({id,on})}),definePageMeta:()=>{},useViewerSeo:()=>{},buildPageDescription:v=>v,useViewerDateTime:()=>({formatDateTime:v=>v}),useForumResource:(_key,load)=>{resource.load=load;return resource;},navigateTo:async target=>{navigations.push(target);return options.navigate?.(target);},ElMessage:Object.fromEntries(['error','success','warning'].map(kind=>[kind,text=>messages.push({kind,text})])),ElMessageBox:options.dialog??{},onMounted:()=>{},setInterval:()=>1,clearInterval:()=>{},FormData:class{append(){}},window:{confirm:()=>true}};
 for(const name of ['useAccountRequestGuard','useAccountPageScope','useAuthFormScope']){
  const code=strip((await readFile(new URL('../../composables/'+name+'.ts',import.meta.url),'utf8')).replace('export const','const'));
  ports[name]=new Function(...Object.keys(ports),code+';return '+name+';')(...Object.values(ports));
 }
 const source=await readFile(new URL('../../'+path,import.meta.url),'utf8'),script=source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
 const model=await new AsyncFunction(...Object.keys(ports),strip(script)+';return {'+exposed.join(',')+'};')(...Object.values(ports));
 return {...model,user,states,resource,messages,navigations,remembered,deactivate:()=>r.fire('deactivated'),activate:()=>r.fire('activated'),unmount:()=>r.fire('beforeUnmount')};
}
