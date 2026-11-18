<script setup lang="ts">
import {ref,computed,onMounted,onActivated,watch,nextTick} from 'vue';
import type {ResourceGrant,DeveloperClient} from '@sakura-taiko/contract';
definePageMeta({
  contentLayout: "reading",hidePageHeader:true,reworkElementPlus:true,middleware:'account-auth',pageTitleKey:'account.developer',hidePageDescription:true,navKey:'/account/profile'});
const {accountUser,fetchCurrentUser}=useAccountState();
await fetchCurrentUser(true);
if(accountUser.value?.developerApiV1Access!==true)throw createError({statusCode:404,statusMessage:'Not found'});
const api=useViewerApiFetch();
const {t,locale}=useI18n();
const ja=computed(()=>locale.value==='ja');
// Slice E2: the inline zh / ja table moved to locales (rework.account.grants.*), same texts.
const GRANTS_COPY_KEYS=["title", "intro", "legacyNote", "grantNew", "grantHelp", "app", "binding", "profile", "scores", "allData", "untilRevoked", "legacy", "decline", "allow", "revoke", "active", "revoked", "expired", "empty", "choose", "loading", "refresh", "failure", "clientTitle", "name", "register", "saved", "removed", "limited", "grantRecords", "next", "first", "disable", "disabled", "disabledSaved", "disableConfirm"] as const;
const copy=computed(()=>(void ja.value,Object.fromEntries(GRANTS_COPY_KEYS.map(key=>[key,t(`rework.account.grants.${key}`)])) as Record<(typeof GRANTS_COPY_KEYS)[number],string>));
type State={consentVersion:string;audience:string;clients:DeveloperClient[];bindings:Array<{bindingId:string;source:string;displayName:string|null}>;grants:ResourceGrant[];hasMore:{clients:boolean;bindings:boolean;grants:boolean};nextCursor?:string|null};
const state=ref<State|null>(null),ownClients=ref<DeveloperClient[]>([]),pending=ref(true),busy=ref(false),error=ref(''),notice=ref(''),ownClientsHasMore=ref(false),ownClientsCursor=ref<string|null>(null),grantPage=ref(0),clientPage=ref(0);
const grantHeading=ref<HTMLElement|null>(null),clientList=ref<HTMLElement|null>(null);
const approvedDeveloper=ref(false);
const bindingId=ref(''),clientId=ref(''),clientName=ref('');
const consentPanel=ref<HTMLDetailsElement|null>(null);
const canSubmit=computed(()=>!!state.value&&!!bindingId.value&&!!clientId.value&&!busy.value&&!pending.value);
const actionScope=useAccountPageScope(()=>{
 state.value=null;ownClients.value=[];pending.value=false;busy.value=false;error.value='';notice.value='';
 approvedDeveloper.value=false;bindingId.value='';clientId.value='';clientName.value='';
 ownClientsHasMore.value=false;ownClientsCursor.value=null;grantPage.value=0;clientPage.value=0;
},false,()=>{void refresh();});
watch(()=>accountUser.value?.id,()=>{void refresh();},{flush:'sync'});
async function refresh(){
 if(accountUser.value?.developerApiV1Access!==true){pending.value=false;return;}
 const ticket=actionScope.capture();
 if(!actionScope.current(ticket))return;
 pending.value=true;error.value='';
 try{
  const [grants,own,developer]=await Promise.all([
   api<State>('/api/account/developer/grants'),
   api<{clients:DeveloperClient[];hasMore:boolean;nextCursor?:string|null}>('/api/account/developer/clients'),
   api<{currentApplication:{status:string}|null}>('/api/account/developer').catch(()=>null)
  ]);
  if(!actionScope.current(ticket))return;
  state.value=grants;
  ownClients.value=own.clients;
  ownClientsHasMore.value=own.hasMore;
  ownClientsCursor.value=own.nextCursor??null;
  approvedDeveloper.value=developer?.currentApplication?.status==='approved';
  grantPage.value=0;clientPage.value=0;
 }catch{if(actionScope.current(ticket))error.value=copy.value.failure;}
 finally{if(actionScope.current(ticket))pending.value=false;}
}
async function grantRecords(first=false){
 if(pending.value||busy.value)return;
 const cursor=first?null:state.value?.nextCursor;if(!first&&!cursor)return;
 const ticket=actionScope.capture();pending.value=true;error.value='';
 try{const data=await api<State>('/api/account/developer/grants'+(cursor?'?before='+encodeURIComponent(cursor):''));if(!actionScope.current(ticket))return;state.value=data;grantPage.value=first?0:grantPage.value+1;await nextTick();grantHeading.value?.focus();}
 catch{if(actionScope.current(ticket))error.value=copy.value.failure;}finally{if(actionScope.current(ticket))pending.value=false;}
}
async function clientRecords(first=false){
 if(pending.value||busy.value)return;
 const cursor=first?null:ownClientsCursor.value;if(!first&&!cursor)return;
 const ticket=actionScope.capture();pending.value=true;error.value='';
 try{const own=await api<{clients:DeveloperClient[];hasMore:boolean;nextCursor?:string|null}>('/api/account/developer/clients'+(cursor?'?before='+encodeURIComponent(cursor):''));if(!actionScope.current(ticket))return;ownClients.value=own.clients;ownClientsHasMore.value=own.hasMore;ownClientsCursor.value=own.nextCursor??null;clientPage.value=first?0:clientPage.value+1;await nextTick();clientList.value?.focus();}
 catch{if(actionScope.current(ticket))error.value=copy.value.failure;}finally{if(actionScope.current(ticket))pending.value=false;}
}
function disable(client:DeveloperClient){if(!window.confirm(copy.value.disableConfirm+' '+client.displayName))return;void run(()=>api('/api/account/developer/clients/'+client.clientId,{method:'DELETE'}),copy.value.disabledSaved);}
async function run(task:()=>Promise<unknown>,message:string){
 if(busy.value||pending.value||!state.value)return;
 const ticket=actionScope.capture();busy.value=true;error.value='';notice.value='';
 try{await task();if(!actionScope.current(ticket))return;notice.value=message;await refresh();}
 catch{if(actionScope.current(ticket))error.value=copy.value.failure;}
 finally{if(actionScope.current(ticket))busy.value=false;}
}
function submit(){if(!canSubmit.value||!state.value)return;const data=state.value;void run(()=>api('/api/account/developer/grants',{method:'POST',body:{bindingId:bindingId.value,clientId:clientId.value,consent:true,consentVersion:data.consentVersion,audience:data.audience}}),copy.value.saved);}
function decline(){bindingId.value='';clientId.value='';if(consentPanel.value)consentPanel.value.open=false;}
function revoke(grantId:string){if(!state.value?.grants.some(g=>g.grantId===grantId&&!g.revokedAt))return;void run(()=>api('/api/account/developer/grants/'+grantId,{method:'DELETE'}),copy.value.removed);}
function register(){if(!clientName.value.trim())return;void run(()=>api('/api/account/developer/clients',{method:'POST',body:{displayName:clientName.value.trim()}}),copy.value.saved);}
const clientLabel=(id:string)=>state.value?.clients.find(c=>c.clientId===id)?.displayName||id;
const bindingLabel=(id:string)=>state.value?.bindings.find(b=>b.bindingId===id)?.displayName||id;
const formatDate=(value:string)=>new Intl.DateTimeFormat(ja.value?'ja-JP':'zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const status=(g:ResourceGrant)=>g.revokedAt?copy.value.revoked:(g.expiresAt!==null&&Date.parse(g.expiresAt)<=Date.now())?copy.value.expired:copy.value.active;
onMounted(refresh);
</script>

<template>
 <!-- Slice E2: native markup only (no auto-imported components): the Linux consent / management checks compile this
      file on its own. The root keeps aria-busy (they wait on it); `data-grants-page` replaces the nested <main>. -->
 <div class="grant-page" data-grants-page :aria-busy="pending||busy">
  <header class="grant-head">
   <h1>{{copy.title}}</h1>
   <p class="permission-explainer">{{copy.intro}}</p>
   <p class="permission-explainer permission-explainer--secondary">{{copy.legacyNote}}</p>
  </header>
  <p v-if="error" role="alert" class="grant-alert error"><span>{{error}}</span> <button type="button" class="rw-btn rw-btn--sm" :disabled="pending||busy" @click="refresh">{{copy.refresh}}</button></p>
  <p role="status" aria-live="polite" class="grant-status" :class="{'is-empty':!(pending||notice)}">{{pending?copy.loading:notice}}</p>
  <p v-if="state && (state.hasMore.clients || state.hasMore.bindings)" role="status" class="grant-note">{{copy.limited}}</p>
  <section v-if="state" class="panel" :aria-label="copy.grantRecords">
   <h2 ref="grantHeading" class="panel-title" tabindex="-1">{{copy.grantRecords}}</h2>
   <p v-if="!state.grants.length" class="grant-empty">{{copy.empty}}</p>
   <article v-for="grant in state.grants" :key="grant.grantId" class="grant" :data-grant-id="grant.grantId">
    <div class="grant-body">
     <h3>{{clientLabel(grant.clientId)}}</h3>
     <p>{{copy.binding}} {{bindingLabel(grant.bindingId)}} · <span class="grant-state" :class="`is-${grant.revokedAt?'revoked':(grant.expiresAt!==null&&Date.parse(grant.expiresAt)<=Date.now())?'expired':'active'}`">{{status(grant)}}</span></p>
     <p v-if="grant.scopes.includes('account:read')">{{copy.allData}} · {{copy.untilRevoked}}</p>
     <p v-else>{{copy.legacy}} · {{grant.scopes.map(s=>s==='scores:read'?copy.scores:copy.profile).join('、')}}<template v-if="grant.expiresAt"> · {{formatDate(grant.expiresAt)}}</template></p>
    </div>
    <button v-if="!grant.revokedAt" type="button" class="rw-btn rw-btn--danger rw-btn--sm danger" :disabled="busy||pending" @click="revoke(grant.grantId)">{{copy.revoke}}</button>
   </article>
   <nav class="paging" :aria-label="copy.grantRecords"><button v-if="grantPage" type="button" class="rw-btn rw-btn--sm" :disabled="pending||busy" @click="grantRecords(true)">{{copy.first}}</button><button v-if="state.hasMore.grants" type="button" class="rw-btn rw-btn--sm" :disabled="pending||busy" @click="grantRecords()">{{copy.next}}</button></nav>
  </section>
  <details v-if="state" ref="consentPanel" class="panel disclosure">
   <summary>{{copy.grantNew}}</summary>
   <p class="permission-explainer">{{copy.grantHelp}}</p>
   <form class="grant-new-form" @submit.prevent="submit">
   <label for="grant-app">{{copy.app}}</label>
   <select id="grant-app" v-model="clientId" class="rw-select" required :disabled="busy"><option value="" disabled>{{copy.choose}}</option><option v-for="client in state.clients" :key="client.clientId" :value="client.clientId">{{client.displayName}}</option></select>
   <label for="grant-binding">{{copy.binding}}</label>
   <select id="grant-binding" v-model="bindingId" class="rw-select" required :disabled="busy"><option value="" disabled>{{copy.choose}}</option><option v-for="binding in state.bindings" :key="binding.bindingId" :value="binding.bindingId">{{binding.displayName||binding.bindingId}} · {{binding.source}}</option></select>
   <div class="consent-actions"><button type="button" class="rw-btn" :disabled="busy" @click="decline">{{copy.decline}}</button><button type="submit" class="rw-btn rw-btn--primary primary" :disabled="!canSubmit">{{copy.allow}}</button></div>
   </form>
  </details>
  <details v-if="approvedDeveloper" class="panel disclosure"><summary>{{copy.clientTitle}}</summary>
   <form class="client-form" @submit.prevent="register"><label for="client-name">{{copy.name}}</label><input id="client-name" v-model="clientName" class="rw-input" maxlength="80" required :disabled="busy"><button type="submit" class="rw-btn" :disabled="busy||!clientName.trim()">{{copy.register}}</button></form>
   <div ref="clientList" tabindex="-1" role="group" class="client-list" :aria-label="copy.clientTitle">
    <article v-for="client in ownClients" :key="client.clientId" class="grant" :data-client-id="client.clientId"><div class="grant-body"><p><strong>{{client.displayName}}</strong></p><p><code>{{client.clientId}}</code></p></div><button v-if="client.status==='active'" type="button" class="rw-btn rw-btn--danger rw-btn--sm danger" :disabled="pending||busy" @click="disable(client)">{{copy.disable}}</button><p v-else class="grant-state is-revoked">{{copy.disabled}}</p></article>
   </div>
   <nav class="paging" :aria-label="copy.clientTitle"><button v-if="clientPage" type="button" class="rw-btn rw-btn--sm" :disabled="pending||busy" @click="clientRecords(true)">{{copy.first}}</button><button v-if="ownClientsHasMore" type="button" class="rw-btn rw-btn--sm" :disabled="pending||busy" @click="clientRecords()">{{copy.next}}</button></nav>
  </details>
 </div>
</template>

<style scoped>
/* Self-contained on purpose (see the template comment). Element Plus variables only: on this page they carry the
   V1.3 mapping (route meta reworkElementPlus → html.rework-ep), and the isolated Linux host defines the same names. */
.grant-page{display:grid;gap:16px;width:100%;min-width:0;color:var(--el-text-color-primary);line-height:1.6}
.grant-head h1{margin:0;font-size:clamp(1.375rem,2.4vw,2rem);font-weight:800;line-height:1.25;overflow-wrap:anywhere}
.permission-explainer{margin:8px 0 0;line-height:1.7;color:var(--el-text-color-regular);overflow-wrap:anywhere}
.permission-explainer--secondary{font-size:13px}
.grant-alert{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0;padding:10px 14px;border:1px solid var(--el-color-danger);border-radius:8px;background:var(--el-color-danger-light-9)}
.grant-status,.grant-note{margin:0;font-size:14px;color:var(--el-text-color-regular)}
.grant-status.is-empty{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.panel{min-width:0;padding:16px 20px;border:1px solid var(--el-border-color);border-radius:16px;background:var(--el-bg-color)}
.panel-title{margin:0 0 4px;font-size:18px;font-weight:700}
.panel-title:focus{outline:none}
.panel-title:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:3px}
.grant-empty{margin:4px 0 0;color:var(--el-text-color-regular)}
.grant{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;padding:12px 0;border-bottom:1px solid var(--el-border-color-lighter)}
.grant:last-of-type{border-bottom:0}
.grant-body{flex:1 1 240px;min-width:0}
.grant-body h3{margin:0;font-size:16px;overflow-wrap:anywhere}
.grant-body p{margin:2px 0 0;font-size:14px;color:var(--el-text-color-regular);overflow-wrap:anywhere}
.grant-body strong{color:var(--el-text-color-primary)}
.grant-state{font-weight:600;color:var(--el-text-color-primary)}
.grant-state.is-revoked,.grant-state.is-expired{font-weight:400;color:var(--el-text-color-regular)}
.paging{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.paging:empty{display:none}
.disclosure>summary{display:flex;align-items:center;min-height:44px;font-weight:700;cursor:pointer;overflow-wrap:anywhere}
.disclosure[open]>summary{margin-bottom:8px}
form{min-width:0;display:grid;gap:10px}
.grant-new-form{margin-top:14px}
label{font-size:13px;font-weight:500;color:var(--el-text-color-regular)}
input,select,button{min-height:44px;min-width:0;max-width:100%;font:inherit}
select{width:100%}
.consent-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px}
.consent-actions button{flex:1}
.client-form{grid-template-columns:minmax(0,1fr) auto;align-items:end}
.client-form label{grid-column:1/-1}
.client-list{margin-top:12px}
.client-list:focus{outline:none}
.client-list:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:3px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow-wrap:anywhere}
summary:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:3px}
@media(max-width:480px){.panel{padding:14px 16px}.client-form{grid-template-columns:minmax(0,1fr)}}
</style>
