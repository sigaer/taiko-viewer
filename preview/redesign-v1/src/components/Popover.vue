<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { restoreFocus } from '../focusTrap'

/**
 * Popover —— 锚定在某个元素旁边的小浮层（成绩页「导出图片」菜单、规格页的显示选项等）。只用于桌面；手机请用 Sheet。
 * 注意：桌面同步面板不用它 —— SyncButton.vue 自带锚在状态条下的 .pop（需要跟随状态条的运行 / 结果状态与焦点规则）。
 *
 * props:
 *   open       boolean                 是否打开
 *   anchor     HTMLElement | string    锚点元素（模板 ref 的值）或 CSS 选择器
 *   placement  'bottom-end' | 'bottom-start' | 'bottom' | 'top-end' | 'top-start'（默认 'bottom-end'）
 *   width      number                  宽度 px（默认 320）
 *   offset     number                  与锚点的间距 px（默认 8）
 *   label      string                  浮层的读屏名称（role="dialog"）；用作菜单时由内容自己声明 role="menu"
 * slots: default（内容）
 * events: close —— Esc、点击浮层与锚点以外的地方时触发；关闭后焦点还给打开前的元素。
 *
 * 打开时焦点移到浮层内第一个可聚焦元素（没有则浮层本身）。位置随滚动、缩放更新；
 * 外观用浮层 token（--overlay-radius / --overlay-pad / --overlay-shadow）。
 *
 * 例：
 *   <button ref="btn" aria-haspopup="dialog" :aria-expanded="open" @click="open = !open">…</button>
 *   <Popover :open="open" :anchor="btn" :label="L('显示选项', '表示オプション')" @close="open = false">…</Popover>
 */
const props = defineProps({
  open: { type: Boolean, default: false },
  anchor: { type: [Object, String], default: null },
  placement: { type: String, default: 'bottom-end' },
  width: { type: Number, default: 320 },
  offset: { type: Number, default: 8 },
  label: { type: String, default: '' },
})
const emit = defineEmits(['close'])
const box = ref(null)
const pos = ref({ top: 0, left: 0 })
let opener = null
let raf = 0

function anchorEl() {
  const a = props.anchor
  if (!a) return null
  if (typeof a === 'string') return document.querySelector(a)
  return a.$el || a
}
function place() {
  raf = 0
  const a = anchorEl()
  if (!a || !box.value) return
  const r = a.getBoundingClientRect()
  const h = box.value.offsetHeight
  const w = Math.min(props.width, window.innerWidth - 16)
  const [side, align = 'center'] = props.placement.split('-')
  let top = side === 'top' ? r.top - h - props.offset : r.bottom + props.offset
  if (side !== 'top' && top + h > window.innerHeight - 8 && r.top - h - props.offset > 8) top = r.top - h - props.offset
  let left = align === 'end' ? r.right - w : align === 'start' ? r.left : r.left + r.width / 2 - w / 2
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
  pos.value = { top: Math.max(8, top), left }
}
function schedule() {
  if (!raf) raf = requestAnimationFrame(place)
}
function onKey(e) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
  }
}
function onDown(e) {
  const a = anchorEl()
  if (box.value?.contains(e.target) || a?.contains?.(e.target)) return
  emit('close')
}
function bind(on) {
  const m = on ? 'addEventListener' : 'removeEventListener'
  window[m]('keydown', onKey, true)
  window[m]('pointerdown', onDown, true)
  window[m]('scroll', schedule, true)
  window[m]('resize', schedule)
}
watch(
  () => props.open,
  async (v, old) => {
    if (!v && !old) return
    if (v) {
      opener = document.activeElement
      bind(true)
      await nextTick()
      place()
      const first = box.value?.querySelector('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')
      ;(first || box.value)?.focus({ preventScroll: true })
    } else {
      bind(false)
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      // 只有焦点还在浮层里（或已经丢失）时才还原，避免抢走用户点到别处的焦点
      const active = document.activeElement
      if (!active || active === document.body || box.value?.contains(active)) restoreFocus(opener)
      opener = null
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  bind(false)
  if (raf) cancelAnimationFrame(raf)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="pop">
      <div
        v-if="open"
        ref="box"
        class="popover"
        :role="label ? 'dialog' : undefined"
        :aria-label="label || undefined"
        tabindex="-1"
        :style="{ top: pos.top + 'px', left: pos.left + 'px', width: width + 'px' }"
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.popover {
  position: fixed;
  z-index: var(--z-sheet);
  max-width: calc(100vw - 16px);
  max-height: calc(100dvh - 16px);
  overflow-y: auto;
  padding: var(--overlay-pad);
  background: var(--overlay-bg);
  border: 1px solid var(--popover-line);
  border-radius: var(--overlay-radius);
  box-shadow: var(--overlay-shadow);
  color: var(--ink);
}
.popover:focus-visible {
  box-shadow: var(--overlay-shadow);
}
</style>
