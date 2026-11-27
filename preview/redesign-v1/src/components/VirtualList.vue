<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

/**
 * VirtualList —— 跟随窗口滚动的定高行虚拟列表（M6：曲库、成绩等长列表挂载行数 ≤ 60）。
 *
 * props:
 *   items      Array    全部数据
 *   rowHeight  number   每行高度 px（必须与实际行高一致；表格行请把 td 的高度写死）
 *   overscan   number   可视区上下各多渲染的行数（默认 8）
 *   tag        string   外层元素（默认 'div'；表格模式用 'tbody'）
 *   rowTag     string   每行元素（默认 'div'；表格模式用 'tr'）
 *   keyField   string   行的 key 字段（默认用下标）
 *   colspan    number   表格模式下占位行 td 的 colspan（默认 99）
 *   rowClass   string | (item, index) => string|array|object
 *              加在每个行元素（rowTag）上的 class，两种模式都生效；用它表达选中、当前、链接行等行状态，
 *              不要在每个单元格里各自判断（I5）
 *   rowAttrs   (item, index) => object
 *              绑定到每个行元素上的属性（如 aria-selected、data-*、title、onClick），两种模式都生效；
 *              会覆盖同名的默认属性（aria-rowindex 除外）
 * slot default: { item, index } —— 行的内容（渲染在 rowTag 元素内部；表格模式里放 <td>）
 * expose: scrollToIndex(i, align = 'start')
 *
 * 总高度恒等于 items.length × rowHeight（上下占位元素补足），所以首帧就能还原滚动位置（R3）。
 * 列表不在页面顶部也可以：用自身到文档顶部的距离计算可视范围；滚动、缩放时用 rAF 节流更新。
 *
 * 例（表格）：
 *   <table class="dt"><thead>…</thead>
 *     <VirtualList tag="tbody" row-tag="tr" :items="rows" :row-height="52" key-field="id"
 *       :row-class="(r) => ({ 'is-sel': r.id === sel })" :row-attrs="(r) => ({ 'aria-selected': r.id === sel })" v-slot="{ item }">
 *       <td>…</td><td>…</td>
 *     </VirtualList>
 *   </table>
 */
const props = defineProps({
  items: { type: Array, required: true },
  rowHeight: { type: Number, required: true },
  overscan: { type: Number, default: 8 },
  tag: { type: String, default: 'div' },
  rowTag: { type: String, default: 'div' },
  keyField: { type: String, default: '' },
  colspan: { type: Number, default: 99 },
  rowClass: { type: [String, Array, Object, Function], default: '' },
  rowAttrs: { type: Function, default: null },
})

const root = ref(null)
const range = shallowRef({ start: 0, end: Math.min(props.items.length, 40) })
const isTable = computed(() => props.tag === 'tbody')
let raf = 0

function docTop() {
  const el = root.value
  if (!el) return 0
  return el.getBoundingClientRect().top + window.scrollY
}
function measure() {
  raf = 0
  const el = root.value
  if (!el) return
  const n = props.items.length
  const h = props.rowHeight
  const top = docTop()
  const viewTop = window.scrollY - top
  const viewBottom = viewTop + window.innerHeight
  let start = Math.floor(viewTop / h) - props.overscan
  let end = Math.ceil(viewBottom / h) + props.overscan
  start = Math.max(0, Math.min(n, start))
  end = Math.max(start, Math.min(n, end))
  const r = range.value
  if (r.start !== start || r.end !== end) range.value = { start, end }
}
function schedule() {
  if (!raf) raf = requestAnimationFrame(measure)
}

const visible = computed(() => {
  const { start, end } = range.value
  const out = []
  for (let i = start; i < end && i < props.items.length; i++) out.push({ item: props.items[i], index: i })
  return out
})
const padTop = computed(() => Math.min(range.value.start, props.items.length) * props.rowHeight)
const padBottom = computed(() => Math.max(0, props.items.length - Math.min(range.value.end, props.items.length)) * props.rowHeight)
const keyOf = (v) => (props.keyField ? v.item[props.keyField] : v.index)
const clsOf = (v) => (typeof props.rowClass === 'function' ? props.rowClass(v.item, v.index) : props.rowClass)
const attrsOf = (v) => (props.rowAttrs ? props.rowAttrs(v.item, v.index) || {} : {})

watch(
  () => [props.items, props.items.length, props.rowHeight],
  () => {
    measure()
  },
)

/** 把第 i 行滚到可视区（align: 'start' | 'center' | 'nearest'）。滚动即时，不平滑。 */
function scrollToIndex(i, align = 'start') {
  const n = props.items.length
  if (!n) return
  const idx = Math.max(0, Math.min(n - 1, i))
  const rowTop = docTop() + idx * props.rowHeight
  let y = rowTop
  if (align === 'center') y = rowTop - (window.innerHeight - props.rowHeight) / 2
  else if (align === 'nearest') {
    const vt = window.scrollY
    const vb = vt + window.innerHeight
    if (rowTop >= vt && rowTop + props.rowHeight <= vb) return
    y = rowTop < vt ? rowTop : rowTop + props.rowHeight - window.innerHeight
  }
  window.scrollTo({ top: Math.max(0, y), behavior: 'auto' })
  measure()
}
defineExpose({ scrollToIndex })

onMounted(() => {
  measure()
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  // 布局在首帧之后才稳定（字体、上方内容）时再量一次
  nextTick(schedule)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', schedule)
  if (raf) cancelAnimationFrame(raf)
  raf = 0
})
</script>

<template>
  <component :is="tag" ref="root" class="vlist">
    <template v-if="isTable">
      <tr v-if="padTop" class="vl-pad" aria-hidden="true"><td :colspan="colspan" :style="{ height: padTop + 'px' }" /></tr>
      <component :is="rowTag" v-for="v in visible" :key="keyOf(v)" v-bind="attrsOf(v)" :class="clsOf(v)" :aria-rowindex="v.index + 1">
        <slot :item="v.item" :index="v.index" />
      </component>
      <tr v-if="padBottom" class="vl-pad" aria-hidden="true"><td :colspan="colspan" :style="{ height: padBottom + 'px' }" /></tr>
    </template>
    <template v-else>
      <div v-if="padTop" class="vl-pad" aria-hidden="true" :style="{ height: padTop + 'px' }" />
      <component :is="rowTag" v-for="v in visible" :key="keyOf(v)" v-bind="attrsOf(v)" class="vl-row" :class="clsOf(v)" :style="{ height: rowHeight + 'px' }">
        <slot :item="v.item" :index="v.index" />
      </component>
      <div v-if="padBottom" class="vl-pad" aria-hidden="true" :style="{ height: padBottom + 'px' }" />
    </template>
  </component>
</template>

<style scoped>
.vl-pad,
.vl-pad td {
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
}
.vl-row {
  overflow: hidden;
}
</style>
