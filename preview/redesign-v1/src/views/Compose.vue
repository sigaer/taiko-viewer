<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, useId, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import Sheet from '../components/Sheet.vue'
import SongCell from '../components/SongCell.vue'
import ThreadRow from '../components/ThreadRow.vue'
import Gate from '../components/Gate.vue'
import { searchSongs } from '../search'
import { sections, songById, THREAD_TYPES, DIFFS } from '../mock/data'
import { store, L, isAuthed, toast, ensureSearch } from '../store'

// 发帖。桌面：左边写、右边是帖子在列表里的样子（真实的 ThreadRow）。
// 手机：全屏编辑，顶部「取消 / 存草稿 / 发布」，底部工具条。草稿自动存在这台设备上。
const router = useRouter()
const DRAFT_KEY = 'tv-design-v1-draft'
const blank = () => ({
  section: 'score-guides',
  type: 'guide',
  title: '',
  summary: '',
  tags: ['手法'],
  song: { id: 615, d: 4 },
  blocks: [{ kind: 'p', text: '' }],
})
const BLANK_JSON = JSON.stringify(blank())

function readDraft() {
  try {
    const v = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
    if (v && v.form && typeof v.form === 'object' && Array.isArray(v.form.blocks)) return v
  } catch {
    /* 存储不可用 */
  }
  return null
}
const restored = readDraft()
const form = reactive(blank())
if (restored) {
  const f = restored.form
  Object.assign(form, {
    section: sections.some((s) => s.slug === f.section) ? f.section : form.section,
    type: THREAD_TYPES[f.type] ? f.type : form.type,
    title: String(f.title || ''),
    summary: String(f.summary || ''),
    tags: Array.isArray(f.tags) ? f.tags.slice(0, 5).map(String) : [],
    song: f.song && songById[f.song.id] ? { id: f.song.id, d: Number(f.song.d) } : null,
    blocks: f.blocks.length ? f.blocks.map((b) => (b.kind === 'img' ? { kind: 'img' } : { kind: 'p', text: String(b.text || '') })) : [{ kind: 'p', text: '' }],
  })
}
const formJson = computed(() => JSON.stringify(form))
const savedAt = ref(restored?.at ? new Date(restored.at) : null)
// 「未保存的修改」：相对进入页面时（或上次手动存草稿时）的内容
let baseline = restored ? JSON.stringify(restored) : null
let baselineForm = restored ? formJson.value : BLANK_JSON
const dirty = computed(() => formJson.value !== baselineForm)
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

function writeDraft() {
  try {
    if (formJson.value === BLANK_JSON) {
      localStorage.removeItem(DRAFT_KEY)
      savedAt.value = null
      return
    }
    const at = Date.now()
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ form: JSON.parse(formJson.value), at }))
    savedAt.value = new Date(at)
  } catch {
    /* 隐私模式下忽略 */
  }
}
// 自动保存：停止输入 800ms 后写入
let saveTimer = null
watch(formJson, () => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(writeDraft, 800)
})
onBeforeUnmount(() => clearTimeout(saveTimer))

function saveDraft() {
  clearTimeout(saveTimer)
  writeDraft()
  baseline = localStorage.getItem(DRAFT_KEY)
  baselineForm = formJson.value
  toast(L('草稿已保存在这台设备上', '下書きをこの端末に保存しました'), 'info')
}

/* ---------- 校验与发布（规则不变） ---------- */
const tagDraft = ref('')
const tried = ref(false)
const errors = computed(() => ({
  title: !form.title.trim() ? L('写一个标题，别人才知道这帖在聊什么。', 'タイトルを入力してください。') : form.title.length > 120 ? L('标题最多 120 个字。', 'タイトルは 120 文字までです。') : '',
  body: !form.blocks.some((b) => b.kind === 'p' && b.text.trim()) ? L('正文还是空的。', '本文が空です。') : '',
}))
const song = computed(() => (form.song ? songById[form.song.id] : null))
const pickable = computed(() => (song.value ? song.value.charts.filter((c) => c.d >= 3) : []))
function addTag() {
  const t = tagDraft.value.trim()
  if (t && !form.tags.includes(t) && form.tags.length < 5) form.tags = [...form.tags, t]
  tagDraft.value = ''
}
let leaving = false
function publish() {
  tried.value = true
  if (errors.value.title || errors.value.body) return
  clearTimeout(saveTimer)
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
  leaving = true
  toast(L('已发布', '投稿しました'))
  router.push('/community')
}

/* ---------- 离开前确认 ---------- */
const leaveOpen = ref(false)
let pendingTo = null
onBeforeRouteLeave((to) => {
  if (leaving || !dirty.value) return true
  pendingTo = to.fullPath
  leaveOpen.value = true
  return false
})
function leaveWith(kind) {
  clearTimeout(saveTimer)
  if (kind === 'save') writeDraft()
  else {
    try {
      if (baseline) localStorage.setItem(DRAFT_KEY, baseline)
      else localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore */
    }
  }
  leaving = true
  leaveOpen.value = false
  if (pendingTo) router.push(pendingTo)
}

/* ---------- 关联谱面：歌曲搜索（与命令面板同一套匹配） ---------- */
ensureSearch()
const songSheet = ref(false)
const sq = ref('')
const active = ref(0)
const lbId = useId()
const found = computed(() => (sq.value.trim() ? searchSongs(sq.value, 8, { locale: store.locale }) : { items: [], total: 0 }))
watch(sq, () => (active.value = 0))
function openPicker() {
  sq.value = ''
  songSheet.value = true
}
function pick(item) {
  form.song = { id: item.song.id, d: item.d }
  songSheet.value = false
}
function onPickKey(e) {
  const n = found.value.items.length
  if (!n) return
  if (e.key === 'ArrowDown') active.value = (active.value + 1) % n
  else if (e.key === 'ArrowUp') active.value = (active.value - 1 + n) % n
  else if (e.key === 'Home') active.value = 0
  else if (e.key === 'End') active.value = n - 1
  else if (e.key === 'Enter') return (e.preventDefault(), pick(found.value.items[active.value]))
  else return
  e.preventDefault()
  nextTick(() => document.getElementById(`${lbId}-${active.value}`)?.scrollIntoView({ block: 'nearest' }))
}
function matchNote(m) {
  if (!m) return ''
  if (m.kind === 'alias') return L(`别名：${m.text}`, `別名：${m.text}`)
  if (m.kind === 'artist') return L('艺术家', 'アーティスト')
  return ''
}
function onDiffKey(e) {
  const list = pickable.value
  const i = list.findIndex((c) => c.d === form.song.d)
  let j
  if (e.key === 'ArrowRight') j = (i + 1) % list.length
  else if (e.key === 'ArrowLeft') j = (i - 1 + list.length) % list.length
  else return
  e.preventDefault()
  const box = e.currentTarget
  form.song.d = list[j].d
  nextTick(() => box?.querySelectorAll('[role="tab"]')[j]?.focus())
}

/* ---------- 预览：真实的 ThreadRow ---------- */
const preview = computed(() => ({
  id: 0,
  section: form.section,
  type: form.type,
  author: 'mochidon',
  ago: L('刚刚', 'たった今'),
  title: form.title || L('标题会显示在这里', 'タイトルがここに表示されます'),
  summary: form.summary || form.blocks.find((b) => b.kind === 'p' && b.text.trim())?.text || L('摘要或正文的前两行', '概要または本文の冒頭'),
  tags: form.tags,
  likes: 0,
  replies: 0,
  views: 0,
  ...(form.song ? { song: { id: form.song.id, d: form.song.d } } : {}),
}))
const chars = computed(() => form.blocks.reduce((n, b) => n + (b.text?.length || 0), 0))
</script>

<template>
  <div class="page cp">
    <Gate v-if="!isAuthed" :what="L('并发布帖子', '投稿')" />
    <template v-else>
      <!-- 手机顶部操作 -->
      <div class="mtop only-mobile">
        <RouterLink to="/community" class="btn btn-ghost btn-sm">{{ L('取消', 'キャンセル') }}</RouterLink>
        <span v-if="savedAt" class="saved t-caption" aria-live="polite">{{ L(`草稿已保存 ${hhmm(savedAt)}`, `下書き保存 ${hhmm(savedAt)}`) }}</span>
        <button type="button" class="btn btn-ghost btn-sm" @click="saveDraft">{{ L('存草稿', '下書き保存') }}</button>
        <button type="button" class="btn btn-primary" @click="publish">{{ L('发布', '投稿する') }}</button>
      </div>

      <div class="cols">
        <form class="editor" novalidate @submit.prevent="publish">
          <div class="field">
            <span id="cp-sec-l" class="field-label">{{ L('发到哪个版块', 'カテゴリ') }}</span>
            <div class="secs" role="group" aria-labelledby="cp-sec-l">
              <button v-for="s in sections.filter((x) => x.slug !== 'official')" :key="s.slug" type="button" class="chip" :aria-pressed="form.section === s.slug" @click="form.section = s.slug"><i class="dot" :style="{ color: s.color }" />{{ L(s.zh, s.ja) }}</button>
            </div>
          </div>
          <div class="field">
            <span id="cp-type-l" class="field-label">{{ L('类型', '種類') }}</span>
            <div class="seg" role="group" aria-labelledby="cp-type-l">
              <button v-for="t in ['discussion', 'guide', 'achievement']" :key="t" type="button" :aria-pressed="form.type === t" @click="form.type = t">{{ L(THREAD_TYPES[t].zh, THREAD_TYPES[t].ja) }}</button>
            </div>
          </div>

          <div class="field">
            <label for="cp-title" class="sr-only">{{ L('标题', 'タイトル') }}</label>
            <input id="cp-title" v-model="form.title" class="title-in" :class="{ bad: tried && errors.title }" maxlength="140" :placeholder="L('标题', 'タイトル')" :aria-invalid="tried && !!errors.title" aria-describedby="cp-title-err" />
            <div class="spread"><span id="cp-title-err" class="field-error">{{ tried ? errors.title : '' }}</span><span class="t-caption num">{{ form.title.length }} / 120</span></div>
          </div>

          <!-- 关联谱面 -->
          <div class="linkrow">
            <template v-if="song">
              <SongCell :song="song" class="grow" />
              <button type="button" class="btn btn-sm" @click="openPicker">{{ L('换一首', '変更') }}</button>
              <button type="button" class="icon-btn" :aria-label="L('移除关联谱面', '譜面の関連付けを外す')" @click="form.song = null"><Icon name="close" :size="16" /></button>
              <div class="dsel" role="tablist" :aria-label="L('关联的难度', '関連付ける難易度')" @keydown="onDiffKey">
                <button v-for="c in pickable" :key="c.d" type="button" role="tab" class="diff-tab" :class="DIFFS[c.d].key" :aria-selected="form.song.d === c.d" :tabindex="form.song.d === c.d ? 0 : -1" @click="form.song.d = c.d">
                  <span class="dn">{{ L(DIFFS[c.d].short, DIFFS[c.d].shortJa) }}</span><span class="ds num">★{{ c.star }}</span>
                </button>
              </div>
            </template>
            <button v-else type="button" class="btn" @click="openPicker"><Icon name="music" :size="16" />{{ L('关联一张谱面', '譜面を関連付ける') }}</button>
          </div>

          <!-- 正文：段落块 + 图片块 -->
          <div class="blocks">
            <div v-for="(b, i) in form.blocks" :key="i" class="block">
              <template v-if="b.kind === 'p'">
                <label :for="`cp-b${i}`" class="sr-only">{{ L(`正文第 ${i + 1} 段`, `本文 ${i + 1} 段落目`) }}</label>
                <textarea :id="`cp-b${i}`" v-model="b.text" class="para" rows="3" :placeholder="i === 0 ? L('正文。可以分成几段来写。', '本文。段落に分けて書けます。') : L('下一段', '次の段落')" />
              </template>
              <div v-else class="imgblock"><Icon name="image" :size="24" /><span>{{ L('图片 · 点击选择或拖进来', '画像 · クリックまたはドロップ') }}</span></div>
              <button v-if="form.blocks.length > 1" type="button" class="icon-btn rm" :aria-label="L(`删除第 ${i + 1} 块`, `${i + 1} 番目のブロックを削除`)" @click="form.blocks.splice(i, 1)"><Icon name="close" :size="14" /></button>
            </div>
            <span class="field-error">{{ tried ? errors.body : '' }}</span>
            <div class="addrow only-desktop">
              <button type="button" class="btn btn-sm" @click="form.blocks.push({ kind: 'p', text: '' })"><Icon name="plus" :size="14" />{{ L('加一段', '段落を追加') }}</button>
              <button type="button" class="btn btn-sm" @click="form.blocks.push({ kind: 'img' })"><Icon name="image" :size="14" />{{ L('加一张图', '画像を追加') }}</button>
            </div>
          </div>

          <div class="field">
            <label for="cp-sum">{{ L('摘要（可选，显示在列表里）', '概要（任意・一覧に表示）') }}</label>
            <textarea id="cp-sum" v-model="form.summary" class="textarea" rows="2" maxlength="280" />
          </div>
          <div class="field">
            <label for="cp-tag">{{ L('标签', 'タグ') }}</label>
            <div class="tagbox">
              <span v-for="(t, i) in form.tags" :key="t" class="chip">{{ t }}<button type="button" class="hit" :aria-label="L(`移除标签 ${t}`, `タグ「${t}」を削除`)" @click="form.tags.splice(i, 1)"><Icon name="close" :size="12" /></button></span>
              <input id="cp-tag" v-model="tagDraft" class="tagin" :placeholder="form.tags.length < 5 ? L('输入后回车', '入力して Enter') : L('最多 5 个', '5 個まで')" :disabled="form.tags.length >= 5" @keydown.enter.prevent="addTag" />
            </div>
          </div>

          <div class="foot only-desktop">
            <span v-if="savedAt" class="saved t-caption" aria-live="polite"><Icon name="check" :size="14" />{{ L(`草稿已保存 ${hhmm(savedAt)}`, `下書き保存 ${hhmm(savedAt)}`) }}</span>
            <span class="grow" />
            <button type="button" class="btn" @click="saveDraft">{{ L('存为草稿', '下書き保存') }}</button>
            <button type="submit" class="btn btn-primary btn-lg">{{ L('发布帖子', '投稿する') }}</button>
          </div>
        </form>

        <aside class="preview only-desktop">
          <h2 class="t-h3">{{ L('在列表里的样子', '一覧での見え方') }}</h2>
          <div class="pv">
            <ThreadRow :thread="preview" preview />
          </div>
          <ul class="rules t-small">
            <li>{{ L('攻略帖关联谱面后，会出现在那首歌的详情页里。', '譜面を関連付けた攻略は、その楽曲のページにも表示されます。') }}</li>
            <li>{{ L('每帖最多 9 张图，单张不超过 5 MB。', '画像は 1 投稿 9 枚まで、1 枚 5 MB まで。') }}</li>
          </ul>
        </aside>
      </div>

      <!-- 手机底部工具条 -->
      <div class="mtools only-mobile">
        <button type="button" class="icon-btn" :aria-label="L('加一段', '段落を追加')" @click="form.blocks.push({ kind: 'p', text: '' })"><Icon name="plus" /></button>
        <button type="button" class="icon-btn" :aria-label="L('加一张图', '画像を追加')" @click="form.blocks.push({ kind: 'img' })"><Icon name="image" /></button>
        <button type="button" class="icon-btn" :aria-label="L('关联谱面', '譜面を関連付ける')" @click="openPicker"><Icon name="music" /></button>
        <span class="grow" />
        <span class="t-caption num">{{ chars }} {{ L('字', '文字') }}</span>
      </div>
    </template>

    <Sheet :open="songSheet" :title="L('关联一张谱面', '譜面を関連付ける')" :width="520" @close="songSheet = false">
      <label :for="`${lbId}-in`" class="sr-only">{{ L('搜索歌曲', '楽曲を検索') }}</label>
      <input
        :id="`${lbId}-in`"
        v-model="sq"
        class="input"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="found.items.length > 0"
        :aria-controls="`${lbId}-lb`"
        :aria-activedescendant="found.items.length ? `${lbId}-${active}` : undefined"
        :placeholder="L('曲名、别名、艺术家或曲目 ID', '曲名・別名・アーティスト・曲 ID')"
        @keydown="onPickKey"
      />
      <ul v-show="found.items.length" :id="`${lbId}-lb`" class="slist" role="listbox" :aria-label="L('歌曲', '楽曲')">
        <li
          v-for="(it, i) in found.items"
          :id="`${lbId}-${i}`"
          :key="it.song.id"
          role="option"
          class="sopt"
          :class="{ on: i === active }"
          :aria-selected="i === active"
          @mousemove="active = i"
          @click="pick(it)"
        >
          <SongCell :song="it.song" :sub="matchNote(it.matched) || undefined" />
        </li>
      </ul>
      <p v-if="sq.trim() && !found.items.length" class="t-small empty">{{ L(`没有找到「${sq.trim()}」，换个写法或用别名试试。`, `「${sq.trim()}」は見つかりません。別名でも検索できます。`) }}</p>
      <p v-else-if="found.total > found.items.length" class="t-caption more">{{ L(`共 ${found.total} 首，只显示前 8 首`, `${found.total} 曲中、上位 8 曲を表示`) }}</p>
    </Sheet>

    <Sheet :open="leaveOpen" :title="L('离开前保存草稿？', '下書きを保存しますか？')" :width="440" @close="leaveOpen = false">
      <p class="t-small">{{ L('这篇帖子还没有发布。保存后，下次打开发帖页会接着写。', 'この投稿はまだ公開されていません。保存すると、次回この続きから書けます。') }}</p>
      <template #foot>
        <button type="button" class="btn btn-ghost" @click="leaveOpen = false">{{ L('继续编辑', '編集を続ける') }}</button>
        <button type="button" class="btn" @click="leaveWith('discard')">{{ L('放弃', '破棄') }}</button>
        <button type="button" class="btn btn-primary" @click="leaveWith('save')">{{ L('保存草稿', '下書き保存') }}</button>
      </template>
    </Sheet>
  </div>
</template>

<style scoped>
.cols {
  display: grid;
  grid-template-columns: minmax(0, 720px) 360px;
  justify-content: center;
  gap: 56px;
  align-items: start;
}
.editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}
.secs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.title-in {
  width: 100%;
  padding: 8px 0;
  border: 0;
  border-bottom: 2px solid var(--ctl-border);
  background: none;
  font-size: var(--fs-28);
  font-weight: 900;
  color: var(--ink);
}
.title-in::placeholder {
  color: var(--ink-3);
}
.title-in:focus-visible {
  box-shadow: none;
  outline: none;
  border-bottom-color: var(--ink);
  border-radius: 0;
}
.title-in.bad {
  border-bottom-color: var(--danger);
}
.linkrow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
}
.dsel {
  display: flex;
  gap: 8px;
  flex-basis: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}
.dsel .diff-tab {
  height: var(--ctl-h);
}
.blocks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.block {
  position: relative;
}
.para {
  width: 100%;
  padding: 10px 36px 10px 0;
  border: 0;
  border-left: 2px solid transparent;
  background: none;
  font-size: var(--fs-16);
  line-height: 1.8;
  resize: vertical;
  color: var(--ink);
}
.para:focus-visible {
  box-shadow: none;
  outline: none;
  border-radius: 0;
  border-left-color: var(--input-focus-line);
  padding-left: 12px;
}
.imgblock {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 120px;
  border: 2px dashed var(--line-strong);
  border-radius: var(--r-panel);
  color: var(--ink-2);
  font-size: var(--fs-13);
}
.rm {
  position: absolute;
  right: 0;
  top: 4px;
  width: 28px;
  height: 28px;
  color: var(--ink-2);
}
.addrow {
  display: flex;
  gap: 8px;
}
.tagbox {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 6px 8px;
  background: var(--surface);
  border: 1px solid var(--ctl-border);
  border-radius: var(--ctl-radius);
}
.tagbox:focus-within {
  border-color: var(--input-focus-line);
  box-shadow: var(--focus);
}
.tagbox .chip button {
  display: grid;
  place-items: center;
  margin-right: -4px;
  color: var(--ink-2);
}
.tagin {
  flex: 1;
  min-width: 100px;
  height: 28px;
  border: 0;
  background: none;
}
.tagin:focus-visible {
  box-shadow: none;
  outline: none;
}
.foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.saved {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ink-2);
  white-space: nowrap;
}
.preview {
  position: sticky;
  top: calc(var(--bar-h) + 24px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.pv {
  padding: 0 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
}
.rules {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 16px;
  list-style: disc;
}
.slist {
  margin-top: 8px;
  max-height: 420px;
  overflow-y: auto;
}
.sopt {
  padding: 8px;
  border-radius: var(--r-ctl);
  cursor: pointer;
}
.sopt.on {
  background: var(--bg-sunk);
  box-shadow: inset 3px 0 0 var(--row-sel-line);
}
.empty,
.more {
  padding: 12px 4px 0;
}
@media (max-width: 1099px) {
  .cols {
    grid-template-columns: minmax(0, 720px);
  }
}
@media (max-width: 767px) {
  .cp {
    padding-top: 0;
    padding-bottom: 88px;
  }
  .mtop {
    position: sticky;
    top: var(--bar-h-m);
    z-index: 5;
    display: flex !important;
    align-items: center;
    gap: 6px;
    margin: 0 calc(var(--gutter) * -1) 12px;
    padding: 6px 8px;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
  }
  .mtop > :first-child {
    margin-right: auto;
  }
  .mtop .saved {
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .secs {
    flex-wrap: nowrap;
    overflow-x: auto;
    margin: 0 calc(var(--gutter) * -1);
    padding: 4px var(--gutter);
    scrollbar-width: none;
  }
  .title-in {
    font-size: var(--fs-22);
  }
  .dsel .diff-tab {
    height: var(--hit);
  }
  .rm {
    width: var(--hit);
    height: var(--hit);
    top: 0;
  }
  .para {
    padding-right: 48px;
  }
  .sopt {
    min-height: var(--hit);
  }
  .mtools {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-bar);
    display: flex !important;
    align-items: center;
    gap: 6px;
    padding: 4px 12px calc(4px + env(safe-area-inset-bottom)) 4px;
    background: var(--surface);
    border-top: 1px solid var(--line);
  }
}
/* C10：表单控件没有豁免 —— 手机上标签输入与其他手机输入框同高（--ctl-h-lg） */
@media (max-width: 767px) {
  .tagin {
    height: var(--ctl-h-lg);
  }
}
</style>
