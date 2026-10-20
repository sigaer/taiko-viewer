<script setup lang="ts">
import {ref,computed,onMounted,nextTick} from 'vue';
import type {ResourceGrant,DeveloperClient} from '@sakura-taiko/contract';
definePageMeta({
  contentLayout: "reading",middleware:'account-auth',pageTitleKey:'account.developer',hidePageDescription:true,navKey:'/account/profile'});
const {accountUser,fetchCurrentUser}=useAccountState();
await fetchCurrentUser(true);
if(accountUser.value?.developerApiV1Access!==true)throw createError({statusCode:404,statusMessage:'Not found'});
const api=useViewerApiFetch();
const {locale}=useI18n();
const ja=computed(()=>locale.value==='ja');
const copy=computed(()=>ja.value?{title:'外部アプリのアクセス管理',intro:'この画面は、あなたが明示的に許可した Developer API v1 のアプリアクセスのみを管理します。通常の Viewer や Bot の利用には設定不要です。',legacyNote:'管理者が承認した Developer Token の他ユーザーの現在スコア読み取りは別の仕組みです。ここでの許可・取り消しは、その独立した権限には影響しません。',grantNew:'新しいアプリにアクセスを許可（任意）',grantHelp:'アプリに、このアカウントのプロフィール・楽曲スコア・段位などの太鼓データの読み取りを許可します。自動では失効せず、いつでも取り消せます。',app:'アプリ',binding:'連携アカウント',profile:'プロフィール',scores:'ベスト記録',allData:'太鼓アカウント情報の読み取り',untilRevoked:'取り消すまで有効',legacy:'以前のアクセス許可',decline:'同意しない',allow:'同意する',revoke:'許可を取り消す',active:'許可中',revoked:'取り消し済み',expired:'期限切れ',empty:'あなたが自分で許可した v1 アプリはまだありません。特に操作は不要です。',choose:'選択してください',loading:'読み込み中…',refresh:'再読み込み',failure:'操作できませんでした。ログイン状態と入力を確認してください。',clientTitle:'開発者専用：v1 アプリの登録と管理',name:'アプリ名',register:'アプリを登録',saved:'許可を保存しました',removed:'許可を取り消しました',limited:'表示されていないアプリや連携アカウントはサポートにお問い合わせください。',grantRecords:'アクセス許可の記録',next:'次へ',first:'最初に戻る',disable:'アプリを無効にする',disabled:'無効',disabledSaved:'アプリを無効にしました',disableConfirm:'このアプリを無効にしますか？'}:{title:'第三方应用权限管理',intro:'这里只管理你主动授予第三方应用的 Developer API v1 访问权限。正常使用 Viewer 或 Bot，无需在这里进行任何操作。',legacyNote:'平台另外批准的 Developer Token 跨用户当前成绩只读属于独立权限；这里的授权或撤销不会影响那套 Token 权限。',grantNew:'授权新的第三方应用（可选）',grantHelp:'允许应用读取此账号的资料、歌曲成绩、段位等太鼓数据。授权持续有效，可随时撤销。',app:'应用',binding:'绑定账号',profile:'个人资料',scores:'最佳成绩',allData:'读取太鼓账号信息',untilRevoked:'持续有效，可随时撤销',legacy:'旧授权',decline:'不同意',allow:'同意',revoke:'撤销授权',active:'已授权',revoked:'已撤销',expired:'已过期',empty:'目前没有你主动授予的 v1 应用权限，无需进行任何操作。',choose:'请选择',loading:'加载中…',refresh:'重新加载',failure:'操作未完成，请检查登录状态和填写内容。',clientTitle:'开发者专用：注册与管理 v1 应用',name:'应用名称',register:'注册应用',saved:'授权已保存',removed:'授权已撤销',limited:'未显示的应用或绑定账号请联系支持。',grantRecords:'授权记录',next:'下一页',first:'返回首页',disable:'停用应用',disabled:'已停用',disabledSaved:'应用已停用',disableConfirm:'确定停用此应用？'});
type State={consentVersion:string;audience:string;clients:DeveloperClient[];bindings:Array<{bindingId:string;source:string;displayName:string|null}>;grants:ResourceGrant[];hasMore:{clients:boolean;bindings:boolean;grants:boolean};nextCursor?:string|null};
const state=ref<State|null>(null),ownClients=ref<DeveloperClient[]>([]),pending=ref(true),busy=ref(false),error=ref(''),notice=ref(''),ownClientsHasMore=ref(false),ownClientsCursor=ref<string|null>(null),grantPage=ref(0),clientPage=ref(0);
const grantHeading=ref<HTMLElement|null>(null),clientList=ref<HTMLElement|null>(null);
const approvedDeveloper=ref(false);
const bindingId=ref(''),clientId=ref(''),clientName=ref('');
const consentPanel=ref<HTMLDetailsElement|null>(null);
const canSubmit=computed(()=>!!state.value&&!!bindingId.value&&!!clientId.value&&!busy.value&&!pending.value);
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
async function run(task:()=>Promise<unknown>,message:string){busy.value=true;error.value='';notice.value='';try{await task();notice.value=message;await refresh();}catch{error.value=copy.value.failure;}finally{busy.value=false;}}
function submit(){if(!canSubmit.value||!state.value)return;const data=state.value;void run(()=>api('/api/account/developer/grants',{method:'POST',body:{bindingId:bindingId.value,clientId:clientId.value,consent:true,consentVersion:data.consentVersion,audience:data.audience}}),copy.value.saved);}
function decline(){bindingId.value='';clientId.value='';if(consentPanel.value)consentPanel.value.open=false;}
function revoke(grantId:string){void run(()=>api('/api/account/developer/grants/'+grantId,{method:'DELETE'}),copy.value.removed);}
function register(){if(!clientName.value.trim())return;void run(()=>api('/api/account/developer/clients',{method:'POST',body:{displayName:clientName.value.trim()}}),copy.value.saved);}
const clientLabel=(id:string)=>state.value?.clients.find(c=>c.clientId===id)?.displayName||id;
const bindingLabel=(id:string)=>state.value?.bindings.find(b=>b.bindingId===id)?.displayName||id;
const formatDate=(value:string)=>new Intl.DateTimeFormat(ja.value?'ja-JP':'zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const status=(g:ResourceGrant)=>g.revokedAt?copy.value.revoked:(g.expiresAt!==null&&Date.parse(g.expiresAt)<=Date.now())?copy.value.expired:copy.value.active;
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
    <h2>{{clientLabel(grant.clientId)}}</h2><p>{{copy.binding}} {{bindingLabel(grant.bindingId)}} · {{status(grant)}}</p>
    <p v-if="grant.scopes.includes('account:read')">{{copy.allData}} · {{copy.untilRevoked}}</p>
    <p v-else>{{copy.legacy}} · {{grant.scopes.map(s=>s==='scores:read'?copy.scores:copy.profile).join('、')}}<template v-if="grant.expiresAt"> · {{formatDate(grant.expiresAt)}}</template></p>
    <button v-if="!grant.revokedAt" type="button" :disabled="busy||pending" @click="revoke(grant.grantId)">{{copy.revoke}}</button>
   </article>
   <nav class="paging" :aria-label="copy.grantRecords"><button v-if="grantPage" type="button" :disabled="pending||busy" @click="grantRecords(true)">{{copy.first}}</button><button v-if="state.hasMore.grants" type="button" :disabled="pending||busy" @click="grantRecords()">{{copy.next}}</button></nav>
  </section>
  <details v-if="state" ref="consentPanel" class="panel">
   <summary>{{copy.grantNew}}</summary>
   <p class="permission-explainer">{{copy.grantHelp}}</p>
   <form class="grant-new-form" @submit.prevent="submit">
   <label for="grant-app">{{copy.app}}</label>
   <select id="grant-app" v-model="clientId" required :disabled="busy"><option value="" disabled>{{copy.choose}}</option><option v-for="client in state.clients" :key="client.clientId" :value="client.clientId">{{client.displayName}}</option></select>
   <label for="grant-binding">{{copy.binding}}</label>
   <select id="grant-binding" v-model="bindingId" required :disabled="busy"><option value="" disabled>{{copy.choose}}</option><option v-for="binding in state.bindings" :key="binding.bindingId" :value="binding.bindingId">{{binding.displayName||binding.bindingId}} · {{binding.source}}</option></select>
   <div class="consent-actions"><button type="button" :disabled="busy" @click="decline">{{copy.decline}}</button><button type="submit" class="primary" :disabled="!canSubmit">{{copy.allow}}</button></div>
   </form>
  </details>
  <details v-if="approvedDeveloper" class="panel"><summary>{{copy.clientTitle}}</summary>
   <form @submit.prevent="register"><label for="client-name">{{copy.name}}</label><input id="client-name" v-model="clientName" maxlength="80" required :disabled="busy"><button type="submit" :disabled="busy||!clientName.trim()">{{copy.register}}</button></form>
   <div ref="clientList" tabindex="-1" role="group" :aria-label="copy.clientTitle">
    <article v-for="client in ownClients" :key="client.clientId" class="grant" :data-client-id="client.clientId"><p>{{client.displayName}} · <code>{{client.clientId}}</code></p><button v-if="client.status==='active'" type="button" :disabled="pending||busy" @click="disable(client)">{{copy.disable}}</button><p v-else>{{copy.disabled}}</p></article>
   </div>
   <nav class="paging" :aria-label="copy.clientTitle"><button v-if="clientPage" type="button" :disabled="pending||busy" @click="clientRecords(true)">{{copy.first}}</button><button v-if="ownClientsHasMore" type="button" :disabled="pending||busy" @click="clientRecords()">{{copy.next}}</button></nav>
  </details>
 </main>
</template>

<style scoped>
.consent-actions{display:flex;flex-wrap:wrap;gap:12px}.consent-actions button{flex:1}.grant-new-form{margin-top:14px}.permission-explainer{margin:10px 0 14px;line-height:1.7;color:var(--el-text-color-regular);overflow-wrap:anywhere}.permission-explainer--secondary{font-size:13px;color:var(--el-text-color-regular)}.grant-page{width:100%;padding:24px 0 48px;color:var(--el-text-color-primary);line-height:1.6}.grant-page h1{font-size:1.6rem}.panel{margin:20px 0;padding:20px;border:1px solid var(--el-border-color);border-radius:16px;background:var(--el-bg-color)}form{min-width:0;display:grid;gap:12px}input,select,button{min-height:44px;min-width:0;max-width:100%;font:inherit;color:inherit;border:1px solid var(--el-border-color);border-radius:8px;padding:8px 12px;background:var(--el-fill-color-blank)}select{width:100%}.paging{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}button.primary{color:var(--el-color-primary);border-color:var(--el-color-primary)}:is(button,input,select,summary):focus-visible{outline:3px solid var(--el-color-primary);outline-offset:3px}.grant{padding:12px 0;border-bottom:1px solid var(--el-border-color)}.grant h2{overflow-wrap:anywhere;font-size:1.1rem;margin:0}.grant p{overflow-wrap:anywhere}summary{cursor:pointer;min-height:44px}code{overflow-wrap:anywhere}.error{color:var(--el-color-danger)}@media(max-width:480px){.panel{padding:16px}.grant-page{padding:16px 0 32px}}
:global(body.theme-dark .grant-page > h1),:global(body.theme-dark .grant-page > .permission-explainer){color:var(--viewer-text)}
</style>
