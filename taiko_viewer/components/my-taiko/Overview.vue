<script setup lang="ts">
import type { MyTaikoOverview } from '~/types/my-taiko';
const { locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { accountUser } = useAccountState();
const bindingGeneration = useState('account-binding-generation', () => 0);
const homeGeneration = useState('account-home-generation', () => 0);
const overview = shallowRef<MyTaikoOverview | null>(null);
const pending = ref(false), failure = ref<number | null>(null), selection = ref('');
let epoch = 0, controller: AbortController | undefined, mounted = false;
const copy = computed(() => locale.value === 'ja' ? {
 title:'マイデータ',binding:'連携 ID',refresh:'再読み込み',loading:'読み込み中…',scores:'スコア',charts:'譜面',scored:'スコアあり',cleared:'クリア確認済み',growth:'最近90日の成長',empty:'信頼できる成長記録がありません',unknown:'履歴の範囲を確認できません',partial:'一部の履歴',truncated:'履歴の読み込み上限に達しました',complete:'対象期間の履歴あり',more:'成長記録を見る',login:'ログインし直す',bind:'ID を連携',unbound:'鼓众 ID を連携してください',denied:'このデータにアクセスできません',changed:'連携が変更されました。再読み込みしてください',unavailable:'データを読み込めません。時間をおいて再試行してください',timeout:'読み込みがタイムアウトしました',observed:'確認',played:'プレイ',recommend:'おすすめツール',
 facts:{played:'プレイ', 'score-pb':'自己ベスト', 'ng-reduced':'不可減少', 'combo-improved':'コンボ更新',clear:'クリア',fc:'フルコンボ',df:'ドンダフルコンボ','rank-upgrade':'ランク更新','goal-completed':'目標達成'}
} : {
 title:'我的数据',binding:'当前绑定',refresh:'重新获取',loading:'正在读取…',scores:'当前成绩',charts:'谱面记录',scored:'有分数',cleared:'已确认通关',growth:'近 90 天成长',empty:'暂无可靠成长记录',unknown:'历史覆盖未知',partial:'部分历史',truncated:'历史读取已达上限',complete:'期间历史完整',more:'查看成长记录',login:'重新登录',bind:'绑定鼓众 ID',unbound:'请先绑定鼓众 ID',denied:'无法访问这份数据',changed:'绑定已变更，请重新获取',unavailable:'暂时无法读取，请稍后重试',timeout:'读取超时，请重试',observed:'观测',played:'游玩',recommend:'打开推荐工具',
 facts:{played:'游玩', 'score-pb':'分数新高', 'ng-reduced':'不可减少', 'combo-improved':'连击提升',clear:'通关',fc:'全连',df:'全良','rank-upgrade':'评级提升','goal-completed':'目标完成'}
});
const errorText = computed(() => {
 const c=copy.value;
 return failure.value===401?c.login:failure.value===400?c.unbound:failure.value===403?c.denied:failure.value===409?c.changed:failure.value===504?c.timeout:c.unavailable;
});
function clear(){epoch++;controller?.abort();overview.value=null;selection.value='';}
async function load(){
 clear();const request=epoch;failure.value=null;pending.value=true;
 const requestController=new AbortController();controller=requestController;let timedOut=false;
 const deadline=setTimeout(()=>{timedOut=true;requestController.abort();},15000);
 try{
  const data=await apiFetch<MyTaikoOverview>('/api/account/my-taiko/overview',{signal:requestController.signal,retry:0,cache:'no-store'});
  if(request===epoch){overview.value=data;selection.value=data.profile.bindingId;}
 }catch(error:any){if(request===epoch){overview.value=null;failure.value=timedOut?504:Number(error?.statusCode||error?.response?.status)||503;}}
 finally{clearTimeout(deadline);if(request===epoch)pending.value=false;}
}
async function switchBinding(){
 const target=selection.value;if(!target||target===overview.value?.profile.bindingId)return;
 clear();failure.value=null;pending.value=true;
 try{await apiFetch('/api/account/bindings/current',{method:'POST',body:{bindingId:Number(target)},retry:0,timeout:15000});}
 catch(error:any){failure.value=Number(error?.statusCode||error?.response?.status)||503;pending.value=false;return;}
}
function visible(){if(document.visibilityState==='hidden'){clear();pending.value=false;}else requestRefresh();}
function focus(){requestRefresh();}
const identity = computed(() => `${accountUser.value?.id}:${bindingGeneration.value}:${homeGeneration.value}`);
const requestRefresh = useAccountDataRefresh(identity, () => { clear(); pending.value=false; }, async () => { if(mounted) await load(); });
onActivated(()=>{mounted=true;if(!overview.value&&!pending.value&&!failure.value)requestRefresh();});
onDeactivated(()=>{mounted=false;});
onMounted(()=>{mounted=true;void load();document.addEventListener('visibilitychange',visible);window.addEventListener('focus',focus);});
onBeforeUnmount(()=>{mounted=false;clear();document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',focus);});
</script>

<template>
 <section class="my-overview panel-card" aria-labelledby="my-data-heading" data-testid="my-taiko-overview">
  <header><h2 id="my-data-heading">{{ copy.title }}</h2><button type="button" :disabled="pending" @click="load">{{ copy.refresh }}</button></header>
  <p v-if="pending" role="status">{{ copy.loading }}</p>
  <div v-else-if="failure" role="alert">
   <p>{{ errorText }}</p>
   <NuxtLink v-if="failure===401" :to="localePath('/account/login')">{{ copy.login }}</NuxtLink>
   <NuxtLink v-else-if="failure===400" :to="localePath('/account/profile')">{{ copy.bind }}</NuxtLink>
  </div>
  <template v-else-if="overview">
   <label class="my-binding">{{ copy.binding }}
    <select v-model="selection" @change="switchBinding" data-testid="my-binding-select">
     <option v-for="binding in overview.profile.bindings" :key="binding.bindingId" :value="binding.bindingId">{{ binding.label }}</option>
    </select>
   </label>
   <p class="my-title" data-testid="my-current-title">{{ overview.profile.currentTitle || overview.profile.taikoId }}</p>
   <h3>{{ copy.scores }}</h3>
   <dl class="my-stats">
    <div><dt>{{ copy.charts }}</dt><dd>{{ overview.scores.rows }}</dd></div>
    <div><dt>{{ copy.scored }}</dt><dd>{{ overview.scores.scored }}</dd></div>
    <div><dt>{{ copy.cleared }}</dt><dd>{{ overview.scores.cleared }}</dd></div>
   </dl>
   <h3>{{ copy.growth }}</h3>
   <p class="my-coverage" data-testid="my-coverage">{{ copy[overview.growth.coverage.scoreHistoryState] }}</p>
   <p class="my-range">{{ overview.growth.range.from }} — {{ overview.growth.range.to }}</p>
   <p v-if="!overview.growth.totalFacts">{{ copy.empty }}</p>
   <ul v-else class="my-facts">
    <li v-for="fact in overview.growth.recentFacts" :key="fact.factKey">
     <span>{{ fact.title }} · {{ copy.facts[fact.type] }}</span>
     <small>{{ fact.type==='played' && fact.temporal.precision==='instant'?copy.played:copy.observed }} · {{ fact.temporal.attributedDay || fact.temporal.observedAt?.slice(0,10) || '—' }}</small>
    </li>
   </ul>
   <div class="my-actions">
    <NuxtLink :to="localePath('/my/growth')">{{ copy.more }}</NuxtLink>
    <NuxtLink :to="localePath(overview.recommendation.href)">{{ copy.recommend }}</NuxtLink>
   </div>
  </template>
 </section>
</template>

<style scoped>
.my-overview{padding:20px;min-width:0;overflow-wrap:anywhere}.my-overview header{display:flex;align-items:center;justify-content:space-between;gap:12px}.my-overview h2{font-size:22px;margin:0}.my-overview h3{font-size:16px;margin:24px 0 12px}.my-overview button,.my-overview select{min-height:44px;border:1px solid var(--viewer-border);border-radius:10px;background:var(--viewer-surface);color:var(--viewer-text);padding:8px 12px;font:inherit}.my-overview button{cursor:pointer;flex-shrink:0}.my-overview button:disabled{opacity:.6;cursor:wait}.my-overview :is(button,select,a):focus-visible{outline:2px solid var(--viewer-accent-strong);outline-offset:3px}.my-binding{display:grid;gap:8px;margin-top:20px;font-size:14px}.my-binding select{width:100%;min-width:0;max-width:100%}.my-title{font-size:18px;font-weight:600}.my-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0}.my-stats div{padding:12px 8px;background:var(--viewer-bg);border-radius:12px;min-width:0}.my-stats dt{font-size:12px;color:var(--viewer-text-muted)}.my-stats dd{margin:8px 0 0;font-size:24px;font-weight:700}.my-range,.my-coverage,.my-facts small{font-size:13px;color:var(--viewer-text-muted)}.my-facts{list-style:none;margin:12px 0;padding:0}.my-facts li{display:grid;gap:4px;padding:12px 0;border-bottom:1px solid var(--viewer-border)}.my-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.my-actions a{display:inline-flex;align-items:center;min-height:44px;padding:8px 12px;border:1px solid var(--viewer-border);border-radius:10px;color:var(--viewer-text);text-decoration:none}.my-overview [role=alert] a{display:inline-flex;align-items:center;min-height:44px;color:var(--viewer-accent-strong)}
</style>
