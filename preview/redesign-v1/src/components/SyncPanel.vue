<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Icon from './Icon.vue'
import * as mock from '../mock/data'
import { store, L, reducedMotion } from '../store'
import { sync, startSync as realStartSync, failedTargets, sampleResult, SYNC_PHASES, SYNC_TARGETS } from '../sync'

// 同步面板（S3）：手机放进底部抽屉，桌面是顶栏状态条下方的浮层。内容只随「登录态 × 同步状态」变化。
// resultOnly：只渲染结果区（成功 / 部分成功 / 失败），给 /account/sync 页复用同一套结果展示；其他情形不渲染
// force（I7）：{ auth?, state?, phase?, result? } —— 按给定情形渲染，不读也不写全局同步状态与 store（规格页、状态样张用）。
//   auth：guest | unbound | empty | synced（默认 synced）；state：idle | running | success | partial | failed（默认 idle）；
//   phase：running 时 0..2（默认 0）；result：省略时按 state 生成示例结果。force 下按钮只渲染、不执行。
const props = defineProps({
  heading: { type: Boolean, default: false },
  headingId: { type: String, default: 'sync-panel-title' },
  resultOnly: { type: Boolean, default: false },
  force: { type: Object, default: null },
})
const emit = defineEmits(['close'])
const router = useRouter()

const authV = computed(() => (props.force ? props.force.auth || 'synced' : store.auth))
const stateV = computed(() => (props.force ? props.force.state || 'idle' : sync.state))
const phaseV = computed(() => (props.force ? props.force.phase ?? 0 : sync.phase))
const retryingV = computed(() => (props.force ? false : sync.retrying))
const resultV = computed(() => {
  if (!props.force) return sync.result
  if (props.force.result) return props.force.result
  return ['partial', 'failed'].includes(stateV.value) ? sampleResult(stateV.value) : sampleResult('success')
})

const situation = computed(() => {
  if (authV.value === 'guest') return 'guest'
  if (authV.value === 'unbound') return 'unbound'
  if (stateV.value !== 'idle') return stateV.value // running | success | partial | failed
  return authV.value === 'empty' ? 'empty' : 'idle'
})
const startSync = (opts) => (props.force ? undefined : realStartSync(opts))

const binding = computed(() => {
  try {
    return mock.player?.bindings?.find((b) => b.current) || null
  } catch {
    return null
  }
})

const last = computed(() => (props.force ? L('2 小时前', '2 時間前') : L(sync.lastSyncLabel.zh, sync.lastSyncLabel.ja)))
const result = computed(() => resultV.value || { records: 4, pb: 2, rank: 1, dfc: 1, fc: 0, targets: SYNC_TARGETS.map((t) => ({ ...t, ok: true })) })
const summary = computed(() => {
  const r = result.value
  if (r.outcome === 'failed') return L('上次没有同步成功，已有的数据没有变化', '前回は同期できませんでした。データは変わっていません')
  if (!r.records) return L('没有新进展', '新しい記録はありません')
  const parts = []
  if (r.pb) parts.push(L(`刷新成绩 ${r.pb}`, `自己ベスト ${r.pb}`))
  if (r.rank) parts.push(L(`评价升级 ${r.rank}`, `評価アップ ${r.rank}`))
  if (r.fc) parts.push(L(`新全连 ${r.fc}`, `フルコンボ ${r.fc}`))
  if (r.dfc) parts.push(L(`新全良 ${r.dfc}`, `全良 ${r.dfc}`))
  return L(`${r.records} 条新进展：`, `新しい記録 ${r.records} 件：`) + parts.join(L('、', '・'))
})
const failed = computed(() => failedTargets(resultV.value))

function go(to) {
  if (props.force) return
  emit('close')
  router.push(to)
}
</script>

<template>
  <div v-if="!resultOnly || ['success', 'partial', 'failed'].includes(situation)" class="sp" :class="{ bare: resultOnly }" :data-situation="situation" :data-forced="force ? '' : undefined">
    <h2 v-if="heading" :id="headingId" class="sp-title">{{ L('同步', '同期') }}</h2>

    <!-- 游客 -->
    <template v-if="situation === 'guest'">
      <p class="lead">{{ L('登录并绑定鼓众广场 ID 后，成绩、Rating 和成长记录会自动同步到 Viewer。', 'ログインして鼓衆広場 ID を連携すると、成績・Rating・成長記録が Viewer に同期されます。') }}</p>
      <div v-if="!resultOnly" class="acts">
        <button type="button" class="btn btn-primary" @click="go('/login')">{{ L('登录', 'ログイン') }}</button>
        <button type="button" class="btn" @click="go('/login?mode=register')">{{ L('注册', '新規登録') }}</button>
      </div>
    </template>

    <!-- 未绑定 -->
    <template v-else-if="situation === 'unbound'">
      <ol class="steps">
        <li class="done"><i class="mark"><Icon name="check" :size="14" /></i>{{ L('登录 Viewer', 'Viewer にログイン') }}</li>
        <li class="now" aria-current="step"><i class="mark">2</i>{{ L('绑定鼓众广场 ID', '鼓衆広場 ID を連携') }}</li>
        <li><i class="mark">3</i>{{ L('第一次同步', '最初の同期') }}</li>
      </ol>
      <div v-if="!resultOnly" class="acts">
        <button type="button" class="btn btn-primary" @click="go('/bind')">{{ L('去绑定', '連携する') }}</button>
      </div>
    </template>

    <!-- 已绑定、还没有成绩 -->
    <template v-else-if="situation === 'empty'">
      <div v-if="binding" class="acct">
        <span class="stamp">{{ binding.region }}</span>
        <span class="grow">
          <b>{{ binding.name }}</b>
          <span class="num t-caption">{{ binding.taikoId }}</span>
        </span>
      </div>
      <p class="lead">{{ L('第一次同步大约需要 10 秒。', '最初の同期は 10 秒ほどかかります。') }}</p>
      <div v-if="!resultOnly" class="acts">
        <button type="button" class="btn btn-primary" @click="startSync()"><Icon name="sync" :size="16" />{{ L('开始同步', '同期を開始') }}</button>
      </div>
    </template>

    <!-- 空闲 -->
    <template v-else-if="situation === 'idle'">
      <p class="lead">
        <b>{{ L(`上次同步：${last}`, `前回の同期：${last}`) }}</b>
        <span class="t-small">{{ summary }}</span>
      </p>
      <ul class="targets" :aria-label="L('同步目标', '連携先')">
        <li v-for="t in result.targets" :key="t.key">
          <span class="grow">{{ L(t.zh, t.ja) }}</span>
          <span v-if="t.ok === false" class="st bad"><i class="dot" />{{ L('没有成功', '失敗') }}</span>
          <span v-else-if="t.ok" class="st good"><Icon name="check" :size="14" />{{ L('已同步', '同期済み') }}</span>
          <span v-else class="st"><span class="na">—</span><span class="sr-only">{{ L('暂无结果', '結果なし') }}</span></span>
        </li>
      </ul>
      <div v-if="!resultOnly" class="acts">
        <button type="button" class="btn btn-primary" @click="startSync()"><Icon name="sync" :size="16" />{{ L('立即同步', '今すぐ同期') }}</button>
        <button type="button" class="btn btn-ghost" @click="go('/account/sync')">{{ L('同步设置', '同期設定') }}</button>
      </div>
    </template>

    <!-- 同步中 -->
    <template v-else-if="situation === 'running'">
      <ol class="phases" :aria-label="L('同步进度', '同期の進行状況')">
        <li v-for="(p, i) in SYNC_PHASES" :key="p.key" :class="{ done: i < phaseV, now: i === phaseV }" :aria-current="i === phaseV ? 'step' : undefined">
          <i class="mark" :class="{ spin: i === phaseV && !reducedMotion }">
            <Icon v-if="i < phaseV" name="check" :size="14" />
            <Icon v-else-if="i === phaseV" name="sync" :size="14" />
            <template v-else>{{ i + 1 }}</template>
          </i>
          <span>{{ L(p.zh, p.ja) }}</span>
          <span v-if="retryingV && i < 2" class="t-caption">{{ L('已完成', '完了') }}</span>
        </li>
      </ol>
      <p class="t-small hint">{{ L('可以关闭面板，同步会继续。', '閉じても同期は続きます。') }}</p>
      <div v-if="!resultOnly" class="acts">
        <button type="button" class="btn btn-primary" disabled>{{ L('正在同步…', '同期中…') }}</button>
      </div>
    </template>

    <!-- 成功 -->
    <template v-else-if="situation === 'success'">
      <p class="lead result ok" :role="force ? undefined : 'status'">
        <i class="mark"><Icon name="check" :size="16" /></i>
        <span>
          <b>{{ L(`同步完成：${result.records} 条新进展，${result.dfc} 个新全良`, `同期完了：新しい記録 ${result.records} 件、全良 ${result.dfc} 件`) }}</b>
          <span class="t-small">{{ summary }}</span>
        </span>
      </p>
      <div v-if="!resultOnly" class="acts">
        <button type="button" class="btn btn-primary" @click="go('/')">{{ L('看看有什么变化', '変化を見る') }}</button>
      </div>
    </template>

    <!-- 部分成功 -->
    <template v-else-if="situation === 'partial'">
      <p class="lead result warn" :role="force ? undefined : 'status'">
        <i class="mark"><Icon name="warn" :size="16" /></i>
        <b>{{ L(`成绩已更新到 Viewer，${failed.length} 个同步目标没有成功`, `成績は Viewer に反映されました。連携先 ${failed.length} 件に失敗しました`) }}</b>
      </p>
      <ul class="targets">
        <li v-for="t in failed" :key="t.key" class="fail">
          <b class="grow">{{ L(t.zh, t.ja) }}</b>
          <span class="reason">{{ L(t.reasonZh, t.reasonJa) }}</span>
        </li>
      </ul>
      <div v-if="!resultOnly" class="acts">
        <button type="button" class="btn btn-primary" @click="startSync({ retryTargets: true })">{{ L('重试失败的目标', '失敗した連携先を再試行') }}</button>
        <button type="button" class="btn btn-ghost" @click="go('/account/sync')">{{ L('同步设置', '同期設定') }}</button>
      </div>
    </template>

    <!-- 失败 -->
    <template v-else-if="situation === 'failed'">
      <p class="lead result bad" :role="force ? undefined : 'status'">
        <i class="mark"><Icon name="warn" :size="16" /></i>
        <b>{{ L('没有同步成功：鼓众广场暂时没有响应。已有的数据没有变化。', '同期できませんでした：鼓衆広場から応答がありません。データは変わっていません。') }}</b>
      </p>
      <div v-if="!resultOnly" class="acts">
        <button type="button" class="btn btn-primary" @click="startSync()">{{ L('重试', '再試行') }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sp {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sp-title {
  font-size: var(--fs-16);
  font-weight: 700;
}
.lead {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--fs-14);
  color: var(--ink);
}
.lead .t-small {
  color: var(--ink-2);
}
.result {
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
}
.result > span {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mark {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex: none;
  border-radius: 50%;
  background: var(--bg-sunk);
  color: var(--ink-2);
  font-style: normal;
  font-size: var(--fs-12);
  font-weight: 700;
}
.result.ok .mark {
  background: var(--ok-wash);
  color: var(--ok);
}
.result.warn .mark {
  background: var(--warn-wash);
  color: var(--warn);
}
.result.bad .mark {
  background: var(--surface);
  color: var(--danger);
  box-shadow: inset 0 0 0 1.5px var(--danger);
}
.steps,
.phases {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.steps li,
.phases li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.steps li.done .mark,
.phases li.done .mark {
  background: var(--ok-wash);
  color: var(--ok);
}
.steps li.now,
.phases li.now {
  color: var(--ink);
  font-weight: 700;
}
.steps li.now .mark,
.phases li.now .mark {
  background: var(--info-wash);
  color: var(--info-ink);
  box-shadow: inset 0 0 0 1.5px var(--info-line);
}
.spin :deep(svg) {
  animation: sp-spin 0.9s linear infinite;
}
@keyframes sp-spin {
  to {
    transform: rotate(360deg);
  }
}
.hint {
  color: var(--ink-2);
}
.acct {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
}
.acct .grow {
  display: flex;
  flex-direction: column;
}
.stamp {
  display: grid;
  place-items: center;
  min-width: 36px;
  height: 24px;
  padding: 0 6px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
  font-size: var(--fs-12);
  font-weight: 700;
}
.targets {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--line);
}
.targets li {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
  min-height: 40px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-14);
}
.targets li.fail {
  flex-direction: column;
  align-items: flex-start;
}
.reason {
  font-size: var(--fs-13);
  color: var(--danger);
}
.st {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.st.good {
  color: var(--ok);
}
.st.bad {
  color: var(--danger);
}
.acts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 767px) {
  .acts .btn {
    flex: 1;
    min-height: 44px;
  }
}
</style>
