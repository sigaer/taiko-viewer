<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Icon from './Icon.vue'
import SyncPanel from './SyncPanel.vue'
import { store, L, syncStatus, reducedMotion, viewport } from '../store'
import { sync, startSync, openSyncPanel, closeSyncPanel } from '../sync'
import { focusables } from '../focusTrap'

// 同步入口。
// icon：手机顶栏的 44px 按钮，状态用角标表达（S2），点按打开底部抽屉里的同步面板。
// chip：平板 / 桌面顶栏的状态条（S4），浮层面板锚在它下方。
// force（规格页样张）：{ kind, phase?, still? } —— 只渲染手机按钮的某个状态，不读不写同步状态，不可交互。
//   kind：idle | need | running | fresh | partial | failed；still：同步中显示减少动效形态（静止 + 进度点）
const props = defineProps({ variant: { type: String, default: 'icon' }, force: { type: Object, default: null } })

const st = computed(() => (props.force ? { kind: props.force.kind || 'idle', label: '' } : syncStatus.value))
const running = computed(() => (props.force ? props.force.kind === 'running' : sync.state === 'running'))
const phase = computed(() => (props.force ? props.force.phase ?? 1 : sync.phase))
const still = computed(() => reducedMotion.value || !!props.force?.still)
// 角标（S2 / I15）：共用 .status-dot —— 默认 = 需要你做一步 / 部分成功（--status-attn），.fail = 失败（--status-fail）
const dot = computed(() => ({ need: 'attn', partial: 'attn', failed: 'fail' })[st.value.kind] || null)

/* ---------- 手机按钮 ---------- */
function onIcon() {
  if (sync.panelOpen) closeSyncPanel()
  else openSyncPanel()
}

/* ---------- 桌面状态条 + 浮层 ---------- */
const wrap = ref(null)
const chipBtn = ref(null)
const pop = ref(null)
const popOpen = computed(() => props.variant === 'chip' && sync.panelOpen && !viewport.phone)
const chipAsLink = computed(() => !running.value && sync.state === 'idle' && (store.auth === 'unbound' || store.auth === 'empty'))
function onChip() {
  const s = sync.state
  if (s === 'partial' || s === 'failed' || s === 'running') {
    if (sync.panelOpen) closeSyncPanel()
    else openSyncPanel()
    return
  }
  // 空闲（含刚刚成功）：直接开始同步
  startSync()
}
function closePop(restore) {
  closeSyncPanel()
  if (restore) nextTick(() => chipBtn.value?.focus?.({ preventScroll: true }))
}
function onDocPointer(e) {
  if (wrap.value && !wrap.value.contains(e.target)) closePop(false)
}
function onKey(e) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    closePop(true)
  }
}
let listening = false
function listen(on) {
  if (on === listening) return
  listening = on
  const fn = on ? document.addEventListener.bind(document) : document.removeEventListener.bind(document)
  fn('pointerdown', onDocPointer, true)
}
watch(
  popOpen,
  async (v) => {
    listen(v)
    if (v) {
      await nextTick()
      const first = focusables(pop.value)[0]
      ;(first || pop.value)?.focus({ preventScroll: true })
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => listen(false))
</script>

<template>
  <!-- 规格样张：与手机按钮同一套图标、角标与进度点，不可交互 -->
  <span v-if="force" class="icon-btn sbtn" :class="{ running }" aria-hidden="true">
    <Icon v-if="st.kind === 'fresh'" name="check" class="ok-ic" />
    <Icon v-else name="sync" :class="{ spin: running && !still }" />
    <span v-if="running && still" class="pdots">
      <i v-for="i in 3" :key="i" :class="{ on: i - 1 <= phase }" />
    </span>
    <i v-if="dot" class="status-dot sdot" :class="{ fail: dot === 'fail' }" />
  </span>

  <!-- 手机 -->
  <button
    v-else-if="variant === 'icon'"
    type="button"
    class="icon-btn sbtn"
    :class="{ running }"
    :aria-label="st.label"
    aria-haspopup="dialog"
    :aria-expanded="sync.panelOpen"
    @click="onIcon"
  >
    <Icon v-if="st.kind === 'fresh'" name="check" class="ok-ic" />
    <Icon v-else name="sync" :class="{ spin: running && !reducedMotion }" />
    <span v-if="running && reducedMotion" class="pdots" aria-hidden="true">
      <i v-for="i in 3" :key="i" :class="{ on: i - 1 <= sync.phase }" />
    </span>
    <i v-if="dot" class="status-dot sdot" :class="{ fail: dot === 'fail' }" aria-hidden="true" />
  </button>

  <!-- 平板 / 桌面 -->
  <div v-else ref="wrap" class="anchor">
    <RouterLink v-if="chipAsLink" :to="store.auth === 'unbound' ? '/bind' : '/account/sync'" class="syncchip warn" :aria-label="st.label">
      <Icon :name="store.auth === 'unbound' ? 'link' : 'sync'" :size="16" /><span class="txt">{{ st.chip }}</span>
    </RouterLink>
    <button
      v-else
      ref="chipBtn"
      type="button"
      class="syncchip"
      :class="{ busy: running, warn: st.kind === 'partial', fail: st.kind === 'failed', fresh: st.kind === 'fresh' }"
      :aria-label="st.label"
      :aria-haspopup="sync.state === 'partial' || sync.state === 'failed' || running ? 'dialog' : undefined"
      :aria-expanded="sync.state === 'partial' || sync.state === 'failed' || running ? popOpen : undefined"
      @click="onChip"
    >
      <Icon v-if="st.kind === 'fresh'" name="check" :size="16" />
      <Icon v-else :name="st.kind === 'failed' || st.kind === 'partial' ? 'warn' : 'sync'" :size="16" :class="{ spin: running && !reducedMotion }" />
      <span class="txt">{{ st.chip }}</span>
    </button>

    <div v-if="popOpen" ref="pop" class="pop" role="dialog" aria-labelledby="sync-pop-title" tabindex="-1" @keydown="onKey">
      <SyncPanel heading heading-id="sync-pop-title" @close="closePop(false)" />
    </div>
  </div>
</template>

<style scoped>
/* ---------- 手机按钮 ---------- */
.sbtn {
  position: relative;
  width: 44px;
  height: 44px;
}
.ok-ic {
  color: var(--ok);
}
.spin {
  animation: sb-spin 0.9s linear infinite;
}
@keyframes sb-spin {
  to {
    transform: rotate(360deg);
  }
}
.sdot {
  position: absolute;
  top: 9px;
  right: 9px;
}
.pdots {
  position: absolute;
  left: 50%;
  bottom: 6px;
  display: flex;
  gap: 3px;
  transform: translateX(-50%);
}
.pdots i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--ctl-border); /* 未到的阶段：非文字 ≥ 3:1 */
}
.pdots i.on {
  background: var(--link);
}

/* ---------- 状态条 ---------- */
.anchor {
  position: relative;
}
.syncchip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: var(--r-note);
  border: 1px solid transparent;
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-2);
  white-space: nowrap;
}
.syncchip:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.syncchip.busy {
  color: var(--link);
}
.syncchip.fresh {
  color: var(--ok);
}
.syncchip.warn {
  background: var(--roll-wash);
  color: var(--roll-ink);
  font-weight: 700;
}
.syncchip.fail {
  border-color: var(--danger);
  color: var(--danger);
  font-weight: 700;
}
.syncchip.fail:hover {
  background: var(--surface);
}
.pop {
  position: absolute;
  z-index: 6;
  right: 0;
  top: calc(100% + 10px);
  width: 340px;
  max-width: calc(100vw - 32px);
  padding: var(--overlay-pad);
  background: var(--surface);
  border-radius: var(--overlay-radius);
  box-shadow: var(--overlay-shadow);
}
.pop:focus {
  outline: none;
}
@media (max-width: 1099px) {
  .syncchip .txt {
    display: none;
  }
  .syncchip {
    width: 38px;
    padding: 0;
    justify-content: center;
  }
}
</style>
