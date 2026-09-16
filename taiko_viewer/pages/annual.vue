<script setup lang="ts">
const {locale}=useI18n();const localePath=useLocalePath();const api=useViewerApiFetch();const beta=useAnnualBeta();const {fetchCurrentUser}=useAccountState();
const code=ref('');const busy=ref(false);const error=ref('');const state=ref('loading');
const copy=computed(()=>locale.value==='ja'?{title:'年間レポート限定テスト',intro:'招待コードを入力して続けてください。',label:'招待コード',submit:'確認して続ける',note:'今回のテストは招待された方のみ参加できます。',login:'ログイン',register:'新規登録',valid:'招待を確認しました。ログインして参加を完了してください。',binding:'ドンダー ID を連携してください',bind:'ID を連携する',sync:'プレイデータを準備してください',openSync:'データ同期へ',retry:'もう一度確認',failed:'招待コードを確認できませんでした。もう一度お試しください。'}:{title:'年度报告限时测试',intro:'本功能目前处于封闭测试阶段，请输入测试邀请码继续体验。',label:'邀请码',submit:'验证并继续',note:'还没有邀请码？本轮测试仅向受邀用户开放。',login:'登录',register:'注册账号',valid:'邀请码有效。请注册或登录，完成领取测试资格。',binding:'请先绑定鼓众 ID',bind:'绑定账号',sync:'请先准备游玩数据',openSync:'前往数据同步',retry:'重新检查',failed:'邀请码验证失败，请检查后重试。'});
definePageMeta({pageTitleKey:'account.versionSummary',mobileNav:false});
const continueEntry=async()=>{
 state.value='loading';error.value='';
 try{
  let s=await beta.refresh();
  if(s.authenticated&&s.pending&&!s.entitled){await api('/api/annual-beta/redeem',{method:'POST'});await fetchCurrentUser(true);s=await beta.refresh();}
  if(!s.entitled){state.value=s.pending&&!s.authenticated?'auth':'invite';if(state.value==='invite')beta.track('beta_invite_gate_view');return;}
  const bindings:any=await api('/api/account/bindings');
  if(!bindings.currentBinding){state.value='binding';beta.track('binding_entry_impression');return;}
  const sync:any=await api('/api/account/sync/targets');
  if(!sync.hasUserdata){state.value='sync';return;}
  beta.track('annual_entry_ready');await navigateTo(localePath('/account/version-summary'),{replace:true});
 }catch(e:any){error.value=e?.data?.statusMessage||copy.value.failed;state.value='error';}
};
const validate=async()=>{
 if(busy.value)return;busy.value=true;error.value='';beta.track('beta_invite_submit');
 try{await api('/api/annual-beta/validate',{method:'POST',body:{code:code.value}});code.value='';await continueEntry();}
 catch(e:any){error.value=e?.data?.statusMessage||copy.value.failed;}
 finally{busy.value=false;}
};
const authLink=(path:string)=>({path:localePath(path),query:{redirect:localePath('/annual')}});
onActivated(continueEntry);
</script>
<template><main class="beta-entry"><el-card class="panel-card"><h1>{{copy.title}}</h1><p v-if="state==='loading'" role="status">{{locale==='ja'?'確認中…':'正在检查…'}}</p>
<template v-else-if="state==='invite'"><p>{{copy.intro}}</p><form @submit.prevent="validate"><label for="beta-code">{{copy.label}}</label><el-input id="beta-code" v-model="code" :placeholder="copy.label" maxlength="48" autocomplete="off" :disabled="busy"/><el-button native-type="submit" type="primary" :loading="busy">{{copy.submit}}</el-button></form><small>{{copy.note}}</small></template>
<template v-else-if="state==='auth'"><p>{{copy.valid}}</p><div class="beta-actions"><NuxtLink :to="authLink('/account/register')" @click="beta.track('auth_start',{auth_method:'register'})">{{copy.register}}</NuxtLink><NuxtLink :to="authLink('/account/login')" @click="beta.track('auth_start',{auth_method:'login'})">{{copy.login}}</NuxtLink></div></template>
<template v-else-if="state==='binding'"><p>{{copy.binding}}</p><NuxtLink :to="{path:localePath('/account/profile'),query:{annual:'1'}}" @click="beta.track('binding_entry_click')">{{copy.bind}}</NuxtLink></template>
<template v-else-if="state==='sync'"><p>{{copy.sync}}</p><NuxtLink :to="{path:localePath('/account/sync'),query:{annual:'1'}}">{{copy.openSync}}</NuxtLink><el-button @click="continueEntry">{{copy.retry}}</el-button></template>
<el-button v-if="state==='error'" @click="continueEntry">{{copy.retry}}</el-button>
<p v-if="error" role="alert" class="beta-error">{{error}}</p></el-card></main></template>
<style scoped>.beta-entry{max-width:560px;margin:24px auto}.beta-entry h1{font-size:26px;margin:0 0 16px}.beta-entry p{line-height:1.7}.beta-entry form{display:grid;gap:12px;margin:20px 0}.beta-entry small{display:block;color:var(--el-text-color-secondary);line-height:1.6}.beta-actions{display:flex;gap:20px}.beta-entry a{display:inline-flex;align-items:center;min-height:44px}.beta-entry :deep(.el-button){min-height:44px}.beta-error{color:var(--el-color-danger)}</style>
