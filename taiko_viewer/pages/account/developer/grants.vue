<script setup lang="ts">
import {ref,computed,onMounted,watch} from 'vue';
import type {ResourceGrant,DeveloperClient} from '@sakura-taiko/contract';
definePageMeta({middleware:'account-auth',pageTitleKey:'account.developer',hidePageDescription:true,navKey:'/account/profile'});
const config=useRuntimeConfig();
if(!config.public.developerApiV1)throw createError({statusCode:404,statusMessage:'Not found'});
const api=useViewerApiFetch();
const {locale}=useI18n();
const ja=computed(()=>locale.value==='ja');
const copy=computed(()=>ja.value?{title:'アプリへのアクセス許可',app:'アプリ',binding:'連携アカウント',permission:'許可するデータ',profile:'プロフィール',scores:'ベスト記録',days:'有効期間',agree:'選択したアプリに、このアカウントの選択したデータへのアクセスを許可します。',allow:'アクセスを許可',revoke:'許可を取り消す',active:'許可中',revoked:'取り消し済み',expired:'期限切れ',empty:'アクセスを許可したアプリはありません',choose:'選択してください',loading:'読み込み中…',refresh:'再読み込み',failure:'操作できませんでした。ログイン状態と入力を確認してください。',clientTitle:'開発者アプリ',name:'アプリ名',register:'アプリを登録',saved:'許可を保存しました',removed:'許可を取り消しました',limited:'先頭100件を表示しています。ほかの項目はサポートにお問い合わせください。'}:{title:'应用授权',app:'应用',binding:'绑定账号',permission:'允许读取',profile:'个人资料',scores:'最佳成绩',days:'有效期',agree:'允许所选应用读取此绑定账号的所选数据。',allow:'同意授权',revoke:'撤销授权',active:'已授权',revoked:'已撤销',expired:'已过期',empty:'暂无应用授权',choose:'请选择',loading:'加载中…',refresh:'重新加载',failure:'操作未完成，请检查登录状态和填写内容。',clientTitle:'开发者应用',name:'应用名称',register:'注册应用',saved:'授权已保存',removed:'授权已撤销',limited:'仅显示前100项，其他记录请联系支持。'});
type State={consentVersion:string;audience:string;clients:DeveloperClient[];bindings:Array<{bindingId:string;source:string;displayName:string|null}>;grants:ResourceGrant[];hasMore:{clients:boolean;bindings:boolean;grants:boolean}};
const state=ref<State|null>(null),ownClients=ref<DeveloperClient[]>([]),pending=ref(true),busy=ref(false),error=ref(''),notice=ref(''),ownClientsHasMore=ref(false);
const bindingId=ref(''),clientId=ref(''),scopes=ref<string[]>([]),days=ref(30),consent=ref(false),clientName=ref('');
watch([bindingId,clientId,scopes,days],()=>{consent.value=false;},{deep:true});
const canSubmit=computed(()=>!!state.value&&!!bindingId.value&&!!clientId.value&&scopes.value.length>0&&consent.value&&!busy.value&&!pending.value);
async function refresh(){pending.value=true;error.value='';try{state.value=await api<State>('/api/account/developer/grants');const own=await api<{clients:DeveloperClient[];hasMore:boolean}>('/api/account/developer/clients');ownClients.value=own.clients;ownClientsHasMore.value=own.hasMore;}catch{error.value=copy.value.failure;}finally{pending.value=false;}}
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
  <p v-if="error" role="alert" class="error">{{error}} <button type="button" :disabled="pending||busy" @click="refresh">{{copy.refresh}}</button></p>
  <p role="status" aria-live="polite">{{pending?copy.loading:notice}}</p>
  <p v-if="state && Object.values(state.hasMore).some(Boolean)" role="status">{{copy.limited}}</p>
  <form v-if="state" class="panel" @submit.prevent="submit">
   <label for="grant-app">{{copy.app}}</label>
   <select id="grant-app" v-model="clientId" required :disabled="busy"><option value="" disabled>{{copy.choose}}</option><option v-for="client in state.clients" :key="client.clientId" :value="client.clientId">{{client.displayName}} · {{client.clientId}}</option></select>
   <label for="grant-binding">{{copy.binding}}</label>
   <select id="grant-binding" v-model="bindingId" required :disabled="busy"><option value="" disabled>{{copy.choose}}</option><option v-for="binding in state.bindings" :key="binding.bindingId" :value="binding.bindingId">{{binding.displayName||binding.source}} · {{binding.bindingId}}</option></select>
   <fieldset :disabled="busy"><legend>{{copy.permission}}</legend><label class="check"><input v-model="scopes" type="checkbox" value="profile:read">{{copy.profile}}</label><label class="check"><input v-model="scopes" type="checkbox" value="scores:read">{{copy.scores}}</label></fieldset>
   <label for="grant-days">{{copy.days}}</label><select id="grant-days" v-model.number="days" :disabled="busy"><option :value="7">7 {{ja?'日':'天'}}</option><option :value="30">30 {{ja?'日':'天'}}</option><option :value="90">90 {{ja?'日':'天'}}</option></select>
   <label class="check"><input v-model="consent" type="checkbox" :disabled="busy">{{copy.agree}}</label>
   <button type="submit" class="primary" :disabled="!canSubmit">{{copy.allow}}</button>
  </form>
  <section v-if="state" class="panel" :aria-label="copy.title">
   <p v-if="!state.grants.length">{{copy.empty}}</p>
   <article v-for="grant in state.grants" :key="grant.grantId" class="grant" :data-grant-id="grant.grantId">
    <h2>{{clientLabel(grant.clientId)}}</h2><p>{{copy.binding}} {{grant.bindingId}} · {{status(grant)}}</p>
    <p>{{grant.scopes.map(s=>s==='scores:read'?copy.scores:copy.profile).join('、')}} · {{formatDate(grant.expiresAt)}}</p>
    <button v-if="!grant.revokedAt" type="button" :disabled="busy||pending" @click="revoke(grant.grantId)">{{copy.revoke}}</button>
   </article>
  </section>
  <details class="panel"><summary>{{copy.clientTitle}}</summary>
   <form @submit.prevent="register"><label for="client-name">{{copy.name}}</label><input id="client-name" v-model="clientName" maxlength="80" required :disabled="busy"><button type="submit" :disabled="busy||!clientName.trim()">{{copy.register}}</button></form>
   <p v-if="ownClientsHasMore" role="status">{{copy.limited}}</p>
   <p v-for="client in ownClients" :key="client.clientId">{{client.displayName}} · <code>{{client.clientId}}</code></p>
  </details>
 </main>
</template>

<style scoped>
.grant-page{max-width:780px;margin:auto;padding:24px 16px 48px;color:var(--el-text-color-primary);line-height:1.6}.grant-page h1{font-size:1.6rem}.panel{margin:20px 0;padding:20px;border:1px solid var(--el-border-color);border-radius:16px;background:var(--el-bg-color)}form{display:grid;gap:12px}input:not([type=checkbox]),select,button{min-height:44px;max-width:100%;font:inherit;color:inherit;border:1px solid var(--el-border-color);border-radius:8px;padding:8px 12px;background:var(--el-fill-color-blank)}select{width:100%}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}button.primary{color:var(--el-color-primary);border-color:var(--el-color-primary)}:is(button,input,select,summary):focus-visible{outline:3px solid var(--el-color-primary);outline-offset:3px}.check{display:flex;align-items:center;gap:10px;min-height:44px}.check input{width:20px;height:20px;flex-shrink:0}fieldset{border:1px solid var(--el-border-color);border-radius:8px}.grant{padding:12px 0;border-bottom:1px solid var(--el-border-color)}.grant h2{font-size:1.1rem;margin:0}.grant p{overflow-wrap:anywhere}summary{cursor:pointer;min-height:44px}code{overflow-wrap:anywhere}.error{color:var(--el-color-danger)}@media(max-width:480px){.panel{padding:16px}.grant-page{padding:16px 12px 32px}}
</style>
