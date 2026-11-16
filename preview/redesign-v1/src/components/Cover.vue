<script setup>
import { useAuthentic } from './assets'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { GENRES } from '../mock/data'
import { L } from '../store'
import Icon from './Icon.vue'
import { whenNear, COVER_BASE, COVER_V } from './lazy'

/**
 * Cover —— 封面。
 * size: '' 44px（默认）| 'sm' 32px | 'lg' 72px | 'tile' 96px（头条、代表成绩）| 'xl' 168px | 'fill' 撑满容器
 * 圆角与尺寸阶梯见 domain.css 的 .cover（D3）。
 *
 * 版本 A（data-assets="generated"）：生成式封面（流派色 + 曲名首字），即 V1.2。
 * 版本 B、C（authentic，docs/16 A1）：
 *   - 只有白名单曲目（song.coverOk）请求真实曲绘：缩略图 cover/thumb/{200|400}/{id}.webp（srcset）→ 原图 cover/{id}.png → 缺失占位；
 *     不使用正式站的 fallbackSongId（会把别的歌的曲绘配到这首上）。
 *   - 其余曲目显示「示例」占位（斜纹），不请求图片。
 *   - 固定宽高，加载前是 --bg-sunk 底；进入视口前 320px 才加载（priority 时立即加载）；换歌时先回到底色。
 * priority: 首屏主封面（歌曲详情）立即加载并提高优先级。
 */
const props = defineProps({
  song: { type: Object, required: true },
  size: { type: String, default: '', validator: (v) => ['', 'sm', 'lg', 'tile', 'xl', 'fill'].includes(v) },
  priority: { type: Boolean, default: false },
  base: { type: String, default: '' }, // 只给素材页的「强制失败」示例用：换成一个不存在的本地路径，走完整的降级链
})
const authentic = useAuthentic()
// 取曲名第一个有意义的字作为封面字形（版本 A）
const glyph = computed(() => {
  const m = props.song.ja.replace(/[＊*\s「」\-]/g, '')
  return [...m][0] || '♪'
})

/* ---------- 真实曲绘 ---------- */
const PX = { '': 44, sm: 32, lg: 72, tile: 96, xl: 168, fill: 168 }
const el = ref(null)
const near = ref(false)
const width = ref(PX[props.size])
const stage = ref(0) // 0 缩略图 · 1 原图 · 2 失败
const shown = ref(false)
let stop = null

const kind = computed(() => (!props.song.coverOk ? 'sample' : stage.value >= 2 ? 'missing' : 'real'))
const id = computed(() => props.song.id)
const B = computed(() => props.base || COVER_BASE)
const src = computed(() => (stage.value === 0 ? `${B.value}thumb/200/${id.value}.webp?v=${COVER_V}` : `${B.value}${id.value}.png`))
const srcset = computed(() => (stage.value === 0 ? `${B.value}thumb/200/${id.value}.webp?v=${COVER_V} 200w, ${B.value}thumb/400/${id.value}.webp?v=${COVER_V} 400w` : undefined))
const sizes = computed(() => (stage.value === 0 ? `${Math.max(1, Math.round(width.value))}px` : undefined))
const phName = computed(() => (kind.value === 'sample' ? L('示例曲目', 'サンプル楽曲') : L('没有曲绘', 'ジャケットなし')))

function observe() {
  if (stop) stop()
  stop = null
  if (!authentic.value || !props.song.coverOk || !el.value) return
  if (props.priority) {
    near.value = true
    return
  }
  stop = whenNear(el.value, (w) => {
    stop = null
    if (w) width.value = w
    near.value = true
  })
}
function onLoad() {
  shown.value = true
}
function onError() {
  shown.value = false
  stage.value++
}
// 换歌：回到底色，重新排队
watch(
  () => props.song.id,
  () => {
    stage.value = 0
    shown.value = false
    near.value = false
    observe()
  },
)
watch([el, authentic], observe, { flush: 'post' })
onBeforeUnmount(() => stop && stop())
</script>

<template>
  <span
    v-if="authentic"
    ref="el"
    class="cover acov"
    :class="[size, kind]"
    :role="kind === 'real' ? undefined : 'img'"
    :aria-label="kind === 'real' ? undefined : phName"
    :aria-hidden="kind === 'real' ? 'true' : undefined"
  >
    <img
      v-if="kind === 'real' && near"
      :key="id + '-' + stage"
      class="acov-img"
      :class="{ on: shown }"
      :src="src"
      :srcset="srcset"
      :sizes="sizes"
      alt=""
      decoding="async"
      :fetchpriority="priority ? 'high' : undefined"
      @load="onLoad"
      @error="onError"
    />
    <template v-else-if="kind !== 'real'">
      <Icon name="music" class="acov-ico" :size="16" />
      <small v-if="kind === 'sample'" class="acov-lbl" aria-hidden="true">{{ L('示例', 'サンプル') }}</small>
    </template>
  </span>
  <span v-else class="cover" :class="[size, 'v' + (song.id % 3)]" :style="{ '--g': GENRES[song.genre].color, '--h': ((song.id * 37) % 44) - 22 + 'deg' }" lang="ja" aria-hidden="true"><b>{{ glyph }}</b></span>
</template>
