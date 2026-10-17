<script setup lang="ts">
import {ref,computed,onMounted,watch,nextTick} from 'vue';
import type {ResourceGrant,DeveloperClient} from '@sakura-taiko/contract';
definePageMeta({middleware:'account-auth',pageTitleKey:'account.developer',hidePageDescription:true,navKey:'/account/profile'});
const {accountUser,fetchCurrentUser}=useAccountState();
await fetchCurrentUser(true);
if(accountUser.value?.developerApiV1Access!==true)throw createError({statusCode:404,statusMessage:'Not found'});
const api=useViewerApiFetch();
const {locale}=useI18n();
const ja=computed(()=>locale.value==='ja');
const copy=computed(()=>ja.value?{title:'外部アプリのアクセス管理',intro:'この画面は、あなたが明示的に許可した Developer API v1 のアプリアクセスのみを管理します。通常の Viewer や Bot の利用には設定不要です。',legacyNote:'管理者が承認した Developer Token の他ユーザーの現在スコア読み取りは別の仕組みです。ここでの許可・取り消しは、その独立した権限には影響しません。',grantNew:'新しいアプリにアクセスを許可（任意）',grantHelp:'特定のアプリに自分の連携アカウントのプロフィールやベストスコアへの v1 アクセスを許す場合だけ使用してください。許可後は上の一覧から取り消せます。',clientHelp:'承認済みの開発者だけが使う機能です。一般プレイヤーがアプリを登録する必要はありません。',app:'アプリ',binding:'連携アカウント',permission:'許可するデータ',profile:'プロフィール',scores:'ベスト記録',days:'有効期間',agree:'選択したアプリに、このアカウントの選択したデータへのアクセスを許可します。',allow:'アクセスを許可',revoke:'許可を取り消す',active:'許可中',revoked:'取り消し済み',expired:'期限切れ',empty:'あなたが自分で許可した v1 アプリはまだありません。特に操作は不要です。',choose:'選択してください',loading:'読み込み中…',refresh:'再読み込み',failure:'操作できませんでした。ログイン状態と入力を確認してください。',clientTitle:'開発者専用：v1 アプリの登録と管理',name:'アプリ名',register:'アプリを登録',saved:'許可を保存しました',removed:'許可を取り消しました',limited:'表示されていないアプリや連携アカウントはサポートにお問い合わせください。',grantRecords:'アクセス許可の記録',next:'次へ',first:'最初に戻る',disable:'アプリを無効にする',disabled:'無効',disabledSaved:'アプリを無効にしました',disableConfirm:'このアプリを無効にしますか？'}:{title:'第三方应用权限管理',intro:'这里只管理你主动授予第三方应用的 Developer API v1 访问权限。正常使用 Viewer 或 Bot，无需在这里进行任何操作。',legacyNote:'平台另外批准的 Developer Token 跨用户当前成绩只读属于独立权限；这里的授权或撤销不会影响那套 Token 权限。',grantNew:'授权新的第三方应用（可选）',grantHelp:'只有明确希望某个应用通过 v1 接口读取你指定绑定的资料或最佳成绩时，才需要在这里授权。之后可在上方随时撤销。',clientHelp:'此区域仅供已通过审核的开发者创建和管理 v1 应用，普通玩家不需要注册。',app:'应用',binding:'绑定账号',permission:'允许读取',profile:'个人资料',scores:'最佳成绩',days:'有效期',agree:'允许所选应用读取此绑定账号的所选数据。',allow:'同意授权',revoke:'撤销授权',active:'已授权',revoked:'已撤销',expired:'已过期',empty:'目前没有你主动授予的 v1 应用权限，无需进行任何操作。',choose:'请选择',loading:'加载中…',refresh:'重新加载',failure:'操作未完成，请检查登录状态和填写内容。',clientTitle:'开发者专用：注册与管理 v1 应用',name:'应用名称',register:'注册应用',saved:'授权已保存',removed:'授权已撤销',limited:'未显示的应用或绑定账号请联系支持。',grantRecords:'授权记录',next:'下一页',first:'返回首页',disable:'停用应用',disabled:'已停用',disabledSaved:'应用已停用',disableConfirm:'确定停用此应用？'});
type State={consentVersion:string;audience:string;clients:DeveloperClient[];bindings:Array<{bindingId:string;source:string;displayName:string|null}>;grants:ResourceGrant[];hasMore:{clients:boolean;bindings:boolean;grants:boolean};nextCursor?:string|null};
const state=ref<State|null>(null),ownClients=ref<DeveloperClient[]>([]),pending=ref(true),busy=ref(false),error=ref(''),notice=ref(''),ownClientsHasMore=ref(false),ownClientsCursor=ref<string|null>(null),grantPage=ref(0),clientPage=ref(0);
const grantHeading=ref<HTMLElement|null>(null),clientList=ref<HTMLElement|null>(null);
const approvedDeveloper=ref(false);
const bindingId=ref(''),clientId=ref(''),scopes=ref<string[]>([]),days=ref(30),consent=ref(false),clientName=ref('');
watch([bindingId,clientId,scopes,days],()=>{consent.value=false;},{deep:true});
const canSubmit=computed(()=>!!state.value&&!!bindingId.value&&!!clientId.value&&scopes.value.length>0&&consent.value&&!busy.value&&!pending.value);
async function refresh(){
 pending.value=true;error.value='';
 try{
  const [grants,own,developer]=await Promise.all([
   api<State>('/api/account/developer/grants'),
   api<{clients:DeveloperClient[];hasMore:boolean;nextCursor?:string|null}>('/api/account/developer/clients'),
   api<{currentApplication:{status:string}|null}>('/api/account/developer').catch(()=>null)
  ]);
  state.value=grants;
  ownClients.value=own.clients;
  ownClientsHasMore.value=own.hasMore;
  ownClientsCursor.value=own.nextCursor??null;
  approvedDeveloper.value=developer?.currentApplication?.status==='approved';
  grantPage.value=0;clientPage.value=0;
 }catch{error.value=copy.value.failure;}
 finally{pending.value=false;}
}
async function grantRecords(first=false){
 if(pending.value||busy.value)return;
 const cursor=first?null:state.value?.nextCursor;if(!first&&!cursor)return;
 pending.value=true;error.value='';
 try{state.value=await api<State>('/api/account/developer/grants'+(cursor?'?before='+encodeURIComponent(cursor):''));grantPage.value=first?0:grantPage.value+1;await nextTick();grantHeading.value?.focus();}
 catch{error.value=copy.value.failure;}finally{pending.value=false;}
}
async function clientRecords(first=false){
 if(pending.value||busy.value)return;
 const cursor=first?null:ownClientsCursor.value;if(!first&&!cursor)return;
 pending.value=true;error.value='';
 try{const own=await api<{clients:DeveloperClient[];hasMore:boolean;nextCursor?:string|null}>('/api/account/developer/clients'+(cursor?'?before='+encodeURIComponent(cursor):''));ownClients.value=own.clients;ownClientsHasMore.value=own.hasMore;ownClientsCursor.value=own.nextCursor??null;clientPage.value=first?0:clientPage.value+1;await nextTick();clientList.value?.focus();}
 catch{error.value=copy.value.failure;}finally{pending.value=false;}
}
function disable(client:DeveloperClient){if(!window.confirm(copy.value.disableConfirm+' '+client.displayName))return;void run(()=>api('/api/account/developer/clients/'+client.clientId,{method:'DELETE'}),copy.value.disabledSaved);}
async function run(task:()=>Promise<unknown>,message:string){busy.value=true;error.value='';notice.value='';try{await task();notice.value=message;consent.value=false;await refresh();}catch{error.value=copy.value.failure;}finally{busy.value=false;}}
function submit(){if(!canSubmit.value||!state.value)return;const data=state.value;void run(()=>api('/api/account/developer/grants',{method:'POST',body:{bindingId:bindingId.value,clientId:clientId.value,scopes:scopes.value,expiresInDays:days.value,consent:true,consentVersion:data.consentVersion,audience:data.audience}}),copy.value.saved);}
function revoke(grantId:string){void run(()=>api('/api/account/developer/grants/'+grantId,{method:'DELETE'}),copy.value.removed);}
function register(){if(!clientName.value.trim())return;void run(()=>api('/api/account/developer/clients',{method:'POST',body:{displayName:clientName.value.trim()}}),copy.value.saved);}
const clientLabel=(id:string)=>state.value?.clients.find(c=>c.clientId===id)?.displayName||id;
const formatDate=(value:string)=>new Intl.DateTimeFormat(ja.value?'ja-JP':'zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const status=(g:ResourceGrant)=>g.revokedAt?copy.value.revoked:Date.parse(g.expiresAt)<=Date.now()?copy.value.expired:copy.value.active;
onMounted(refresh);
</script>

<template>
 <main class="grant-page" :aria-busy="pending||busy">
  <h1>{{copy.title}}</h1>
  <p class="permission-explainer">{{copy.intro}}</p>
  <p class="permission-explainer permission-explainer--secondary">{{copy.legacyNote}}</p>
  <p v-if="error" role="alert" class="error">{{error}} <button type="button" :disabled="pending||busy" @click="refresh">{{copy.refresh}}</button></p>
  <p role="status" aria-live="polite">{{pending?copy.loading:notice}}</p>
  <p v-if="state && (state.hasMore.clients || state.hasMore.bindings)" role="status">{{copy.limited}}</p>
  <section v-if="state" class="panel" :aria-label="copy.grantRecords">
   <h2 ref="grantHeading" tabindex="-1">{{copy.grantRecords}}</h2>
   <p v-if="!state.grants.length">{{copy.empty}}</p>
   <article v-for="grant in state.grants" :key="grant.grantId" class="grant" :data-grant-id="grant.grantId">
    <h2>{{clientLabel(grant.clientId)}}</h2><p>{{copy.binding}} {{grant.bindingId}} · {{status(grant)}}</p>
    <p>{{grant.scopes.map(s=>s==='scores:read'?copy.scores:copy.profile).join('、')}} · {{formatDate(grant.expiresAt)}}</p>
    <button v-if="!grant.revokedAt" type="button" :disabled="busy||pending" @click="revoke(grant.grantId)">{{copy.revoke}}</button>
   </article>
   <nav class="paging" :aria-label="copy.grantRecords"><button v-if="grantPage" type="button" :disabled="pending||busy" @click="grantRecords(true)">{{copy.first}}</button><button v-if="state.hasMore.grants" type="button" :disabled="pending||busy" @click="grantRecords()">{{copy.next}}</button></nav>
  </section>
  <details v-if="state" class="panel">
   <summary>{{copy.grantNew}}</summary>
   <p class="permission-explainer">{{copy.grantHelp}}</p>
   <form class="grant-new-form" @submit.prevent="submit">
   <label for="grant-app">{{copy.app}}</label>
   <select id="grant-app" v-model="clientId" required :disabled="busy"><option value="" disabled>{{copy.choose}}</option><option v-for="client in state.clients" :key="client.clientId" :value="client.clientId">{{client.displayName}} · {{client.clientId}}</option></select>
   <label for="grant-binding">{{copy.binding}}</label>
   <select id="grant-binding" v-model="bindingId" required :disabled="busy"><option value="" disabled>{{copy.choose}}</option><option v-for="binding in state.bindings" :key="binding.bindingId" :value="binding.bindingId">{{binding.displayName||binding.source}} · {{binding.bindingId}}</option></select>
   <fieldset :disabled="busy"><legend>{{copy.permission}}</legend><label class="check"><input v-model="scopes" type="checkbox" value="profile:read">{{copy.profile}}</label><label class="check"><input v-model="scopes" type="checkbox" value="scores:read">{{copy.scores}}</label></fieldset>
   <label for="grant-days">{{copy.days}}</label><select id="grant-days" v-model.number="days" :disabled="busy"><option :value="7">7 {{ja?'日':'天'}}</option><option :value="30">30 {{ja?'日':'天'}}</option><option :value="90">90 {{ja?'日':'天'}}</option></select>
   <label class="check"><input v-model="consent" type="checkbox" :disabled="busy">{{copy.agree}}</label>
   <button type="submit" class="primary" :disabled="!canSubmit">{{copy.allow}}</button>
   </form>
  </details>
  <details v-if="approvedDeveloper" class="panel"><summary>{{copy.clientTitle}}</summary>
   <p class="permission-explainer">{{copy.clientHelp}}</p>
   <form @submit.prevent="register"><label for="client-name">{{copy.name}}</label><input id="client-name" v-model="clientName" maxlength="80" required :disabled="busy"><button type="submit" :disabled="busy||!clientName.trim()">{{copy.register}}</button></form>
   <div ref="clientList" tabindex="-1" role="group" :aria-label="copy.clientTitle">
    <article v-for="client in ownClients" :key="client.clientId" class="grant" :data-client-id="client.clientId"><p>{{client.displayName}} · <code>{{client.clientId}}</code></p><button v-if="client.status==='active'" type="button" :disabled="pending||busy" @click="disable(client)">{{copy.disable}}</button><p v-else>{{copy.disabled}}</p></article>
   </div>
   <nav class="paging" :aria-label="copy.clientTitle"><button v-if="clientPage" type="button" :disabled="pending||busy" @click="clientRecords(true)">{{copy.first}}</button><button v-if="ownClientsHasMore" type="button" :disabled="pending||busy" @click="clientRecords()">{{copy.next}}</button></nav>
  </details>
 </main>
</template>

<style scoped>
.grant-new-form{margin-top:14px}.permission-explainer{margin:10px 0 14px;line-height:1.7;color:var(--el-text-color-regular);overflow-wrap:anywhere}.permission-explainer--secondary{font-size:13px;color:var(--el-text-color-secondary)}.grant-page{max-width:780px;margin:auto;padding:24px 16px 48px;color:var(--el-text-color-primary);line-height:1.6}.grant-page h1{font-size:1.6rem}.panel{margin:20px 0;padding:20px;border:1px solid var(--el-border-color);border-radius:16px;background:var(--el-bg-color)}form{min-width:0;display:grid;gap:12px}input:not([type=checkbox]),select,button{min-height:44px;min-width:0;max-width:100%;font:inherit;color:inherit;border:1px solid var(--el-border-color);border-radius:8px;padding:8px 12px;background:var(--el-fill-color-blank)}select{width:100%}.paging{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}button.primary{color:var(--el-color-primary);border-color:var(--el-color-primary)}:is(button,input,select,summary):focus-visible{outline:3px solid var(--el-color-primary);outline-offset:3px}.check{display:flex;align-items:center;gap:10px;min-height:44px}.check input{width:20px;height:20px;flex-shrink:0}fieldset{min-width:0;border:1px solid var(--el-border-color);border-radius:8px}.grant{padding:12px 0;border-bottom:1px solid var(--el-border-color)}.grant h2{overflow-wrap:anywhere;font-size:1.1rem;margin:0}.grant p{overflow-wrap:anywhere}summary{cursor:pointer;min-height:44px}code{overflow-wrap:anywhere}.error{color:var(--el-color-danger)}@media(max-width:480px){.panel{padding:16px}.grant-page{padding:16px 12px 32px}}
</style>
