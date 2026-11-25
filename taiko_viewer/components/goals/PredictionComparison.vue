<script setup lang="ts">
import type { Comparison, PredictionEvidenceEnvelope } from '~/utils/prediction-evidence/types';
const { locale } = useI18n();
const copy = computed(() => locale.value === 'ja' ? {
  title:'予測比較', sample:'合成データ', open:'比較を開く', close:'閉じる', state:'証拠の状態', available:'コホートあり', missing:'コホートなし', sparse:'少数サンプル', revision:'版の不一致',
  personal:'個人予測', cohort:'コホート参照', hybrid:'融合予測', unknown:'不明', insufficient:'証拠不足', loading:'読み込み中…', error:'読み込めませんでした',
  stable:'安定スコア', pb:'PB 推定', point:'スコア', quantiles:'Q25 / Q50 / Q75', players:'プレイヤー数', ess:'有効サンプル数（ESS）', evidence:'証拠の版',
  notice:'合成プロフィールの比較です。あなたの成績予測ではありません。', retained:'個人予測を維持', withheld:'実際の留出検証が完了するまで融合予測は利用できません。',
  uncalibrated:'分位点は未校正', snapshot:'ベストスコアのスナップショット', retry:'再試行'
} : {
  title:'预测对照', sample:'合成数据', open:'打开对照', close:'关闭', state:'证据状态', available:'群体样本充足', missing:'缺少群体数据', sparse:'群体样本不足', revision:'版本不匹配',
  personal:'个人预测', cohort:'群体参考', hybrid:'融合预测', unknown:'未知', insufficient:'证据不足', loading:'加载中…', error:'暂时无法加载',
  stable:'稳定分数', pb:'PB 估计', point:'分数', quantiles:'Q25 / Q50 / Q75', players:'独立玩家数', ess:'有效样本量（ESS）', evidence:'证据版本',
  notice:'此处使用合成画像，不代表你的成绩预测。', retained:'保留个人预测', withheld:'融合预测需通过真实留出验证后才可使用。',
  uncalibrated:'分位数尚未校准', snapshot:'最佳成绩快照', retry:'重试'
});
const expanded = ref(false), state = ref('available'), data = ref<Comparison|null>(null), pending = ref(false), failed = ref(false);
let generation = 0, controller: AbortController|null = null;
const cards = computed(() => data.value ? [
  { label: copy.value.personal, value: data.value.personal }, { label: copy.value.cohort, value: data.value.cohort }, { label: copy.value.hybrid, value: data.value.hybrid }
] : []);
const number = (value: number|null|undefined) => value == null ? copy.value.unknown : value.toLocaleString(locale.value === 'ja' ? 'ja-JP' : 'zh-CN', {maximumFractionDigits:2});
function status(value: PredictionEvidenceEnvelope) { return value.availability === 'available' ? number(value.point) : value.availability === 'insufficient' ? copy.value.insufficient : copy.value.unknown; }
async function load() {
  const request = ++generation;
  controller?.abort(); controller = new AbortController(); pending.value = true; failed.value = false; data.value = null;
  try {
    const result = await $fetch<Comparison>('/api/candidate/prediction-preview', { query: { state: state.value }, signal: controller.signal });
    if (request === generation) data.value = result;
  } catch { if (request === generation) failed.value = true; }
  finally { if (request === generation) pending.value = false; }
}
function toggle() { expanded.value = !expanded.value; if (expanded.value) void load(); else { generation++;controller?.abort();pending.value=false; } }
onBeforeUnmount(() => {generation++;controller?.abort();});
</script>
<template>
 <section class="prediction-comparison" :aria-label="copy.title">
  <button type="button" class="rw-btn" :aria-expanded="expanded" aria-controls="prediction-comparison-content" @click="toggle">{{ expanded ? copy.close : copy.open }} · {{ copy.title }}</button>
  <div v-if="expanded" id="prediction-comparison-content" class="prediction-content" :aria-busy="pending">
   <h3>{{ copy.title }} <span class="prediction-badge">{{ copy.sample }}</span></h3>
   <p>{{ copy.notice }}</p>
   <label>{{ copy.state }}<select v-model="state" @change="load"><option v-for="key in ['available','missing','sparse','revision']" :key="key" :value="key">{{ copy[key as 'available'|'missing'|'sparse'|'revision'] }}</option></select></label>
   <p v-if="pending" role="status">{{ copy.loading }}</p>
   <p v-if="failed" role="alert">{{ copy.error }} <button type="button" class="rw-btn" @click="load">{{ copy.retry }}</button></p>
   <template v-if="data">
    <p class="prediction-decision">{{ copy.retained }} · {{ copy.snapshot }}</p>
    <div class="prediction-cards">
     <article v-for="card in cards" :key="card.value.predictionType" :data-prediction-type="card.value.predictionType">
      <h4>{{ card.label }}</h4><p class="prediction-point">{{ status(card.value) }}</p>
      <dl v-if="card.value.personalScores"><dt>{{ copy.stable }}</dt><dd>{{ number(card.value.personalScores.stable) }}</dd><dt>{{ copy.pb }}</dt><dd>{{ number(card.value.personalScores.pb) }}</dd></dl>
      <p>{{ copy.quantiles }}</p><p>{{ card.value.distribution.kind === 'quantiles' ? [card.value.distribution.q25,card.value.distribution.q50,card.value.distribution.q75].map(number).join(' / ') : copy.unknown }}</p>
      <p v-if="card.value.predictionType==='personal'">{{ copy.uncalibrated }}</p>
      <p v-if="card.value.predictionType==='hybrid'">{{ copy.withheld }}</p>
     </article>
    </div>
    <dl><dt>{{ copy.players }}</dt><dd>{{ number(data.cohortSample?.distinctPlayerCount) }}</dd><dt>{{ copy.ess }}</dt><dd>{{ number(data.cohortSample?.effectiveSampleSize) }}</dd></dl>
    <details><summary>{{ copy.evidence }}</summary><dl><dt>Score</dt><dd>{{ data.scope.scoreRevision }}</dd><dt>Profile</dt><dd>{{ data.scope.playerProfileRevision }}</dd><dt>Catalog</dt><dd>{{ data.scope.catalogRevision }}</dd><dt>Chart</dt><dd>{{ data.scope.chartRevision }}</dd><dt>Cohort</dt><dd>{{ data.cohort.cohortRevision || copy.unknown }}</dd><dt>Model</dt><dd>{{ data.personal.modelVersion }}</dd></dl></details>
   </template>
  </div>
 </section>
</template>
<style scoped>
.prediction-comparison { min-width:0; }
.prediction-content { padding-block:16px; display:grid; gap:12px; }
h3,h4,p { margin:0; }
.prediction-badge { font-size:.875rem; font-weight:400; padding:4px 8px; border:1px solid var(--el-border-color); border-radius:8px; }
.prediction-cards { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
article { padding:16px; border:1px solid var(--el-border-color); border-radius:12px; display:grid; align-content:start; gap:12px; }
.prediction-point { font-size:1.4rem; font-weight:700; font-variant-numeric:tabular-nums; }
label { display:flex; align-items:center; flex-wrap:wrap; gap:12px; }
dl { margin:0; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,2fr); gap:8px 12px; overflow-wrap:anywhere; }
dd { margin:0; font-variant-numeric:tabular-nums; }
button,select,summary { min-height:44px; font:inherit; }
select { padding:8px; border:1px solid var(--el-border-color); background:var(--el-bg-color); color:var(--el-text-color-primary); border-radius:8px; max-width:100%; }
summary { cursor:pointer; padding-block:10px; }
button:focus-visible,select:focus-visible,summary:focus-visible { outline:3px solid var(--viewer-accent-strong); outline-offset:2px; }
@media(max-width:700px) { .prediction-cards { grid-template-columns:1fr; } }
</style>
