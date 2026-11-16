<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import Cover from '../components/Cover.vue'
import Diff from '../components/Diff.vue'
import Sheet from '../components/Sheet.vue'
import SongCell from '../components/SongCell.vue'
import Gate from '../components/Gate.vue'
import { sections, songs, songById, chartOf, sectionBySlug, THREAD_TYPES, DIFFS } from '../mock/data'
import { L, isAuthed, songTitle, toast } from '../store'

// 发帖。桌面：左边写、右边实时预览帖子在列表里的样子。
// 手机：全屏编辑，顶部「取消 / 发布」，底部工具条紧贴键盘。
const router = useRouter()
const form = reactive({
  section: 'score-guides',
  type: 'guide',
  title: '',
  summary: '',
  tags: ['手法'],
  song: { id: 615, d: 4 },
  blocks: [{ kind: 'p', text: '' }],
})
const tagDraft = ref('')
const tried = ref(false)
const songSheet = ref(false)
const sq = ref('')
const errors = computed(() => ({
  title: !form.title.trim() ? L('写一个标题，别人才知道这帖在聊什么。', 'タイトルを入力してください。') : form.title.length > 120 ? L('标题最多 120 个字。', 'タイトルは 120 文字までです。') : '',
  body: !form.blocks.some((b) => b.kind === 'p' && b.text.trim()) ? L('正文还是空的。', '本文が空です。') : '',
}))
const sec = computed(() => sectionBySlug[form.section])
const song = computed(() => (form.song ? songById[form.song.id] : null))
const found = computed(() => songs.filter((s) => `${s.ja} ${s.zh}`.toLowerCase().includes(sq.value.toLowerCase())).slice(0, 8))
function addTag() {
  const t = tagDraft.value.trim()
  if (t && !form.tags.includes(t) && form.tags.length < 5) form.tags.push(t)
  tagDraft.value = ''
}
function publish() {
  tried.value = true
  if (errors.value.title || errors.value.body) return
  toast(L('已发布', '投稿しました'))
  router.push('/community')
}
function saveDraft() {
  toast(L('草稿已保存在这台设备上', '下書きをこの端末に保存しました'), 'info')
}
</script>

<template>
  <div class="page cp">
    <Gate v-if="!isAuthed" :what="L('并发布帖子', '投稿')" />
    <template v-else>
      <!-- 手机顶部操作 -->
      <div class="mtop only-mobile">
        <RouterLink to="/community" class="btn btn-ghost btn-sm">{{ L('取消', 'キャンセル') }}</RouterLink>
        <button class="btn btn-ghost btn-sm" @click="saveDraft">{{ L('存草稿', '下書き保存') }}</button>
        <button class="btn btn-primary" @click="publish">{{ L('发布', '投稿する') }}</button>
      </div>

      <div class="cols">
        <form class="editor" @submit.prevent="publish">
          <div class="field">
            <span class="field-label">{{ L('发到哪个版块', 'カテゴリ') }}</span>
            <div class="secs">
              <button v-for="s in sections.filter((x) => x.slug !== 'official')" :key="s.slug" type="button" class="chip" :aria-pressed="form.section === s.slug" @click="form.section = s.slug"><i class="dot" :style="{ color: s.color }" />{{ L(s.zh, s.ja) }}</button>
            </div>
          </div>
          <div class="field">
            <span class="field-label">{{ L('类型', '種類') }}</span>
            <div class="seg" role="group">
              <button v-for="t in ['discussion', 'guide', 'achievement']" :key="t" type="button" :aria-pressed="form.type === t" @click="form.type = t">{{ L(THREAD_TYPES[t].zh, THREAD_TYPES[t].ja) }}</button>
            </div>
          </div>

          <div class="field">
            <label for="cp-title" class="sr-only">{{ L('标题', 'タイトル') }}</label>
            <input id="cp-title" v-model="form.title" class="title-in" :class="{ bad: tried && errors.title }" maxlength="140" :placeholder="L('标题', 'タイトル')" :aria-invalid="tried && !!errors.title" />
            <div class="spread"><span class="field-error">{{ tried ? errors.title : '' }}</span><span class="t-caption num">{{ form.title.length }} / 120</span></div>
          </div>

          <!-- 关联谱面 -->
          <div class="linkrow">
            <template v-if="song">
              <Cover :song="song" />
              <span class="grow"><b class="truncate">{{ songTitle(song) }}</b>
                <span class="dsel">
                  <button v-for="c in song.charts.filter((x) => x.d >= 3)" :key="c.d" type="button" class="chip" :aria-pressed="form.song.d === c.d" @click="form.song.d = c.d">{{ L(DIFFS[c.d].short, DIFFS[c.d].shortJa) }} ★{{ c.star }}</button>
                </span>
              </span>
              <button type="button" class="btn btn-sm" @click="songSheet = true">{{ L('换一首', '変更') }}</button>
              <button type="button" class="icon-btn" :aria-label="L('移除关联谱面', '譜面の関連付けを外す')" @click="form.song = null"><Icon name="close" :size="16" /></button>
            </template>
            <button v-else type="button" class="btn" @click="songSheet = true"><Icon name="music" :size="16" />{{ L('关联一张谱面', '譜面を関連付ける') }}</button>
          </div>

          <!-- 正文：段落块 + 图片块 -->
          <div class="blocks">
            <div v-for="(b, i) in form.blocks" :key="i" class="block">
              <textarea v-if="b.kind === 'p'" v-model="b.text" class="para" rows="3" :placeholder="i === 0 ? L('正文。可以分成几段来写。', '本文。段落に分けて書けます。') : L('下一段', '次の段落')" />
              <div v-else class="imgblock"><Icon name="image" :size="24" /><span>{{ L('图片 · 点击选择或拖进来', '画像 · クリックまたはドロップ') }}</span></div>
              <button v-if="form.blocks.length > 1" type="button" class="icon-btn rm" :aria-label="L('删除这一块', 'このブロックを削除')" @click="form.blocks.splice(i, 1)"><Icon name="close" :size="14" /></button>
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
              <span v-for="(t, i) in form.tags" :key="t" class="chip">{{ t }}<button type="button" :aria-label="L('移除标签', 'タグを削除')" @click="form.tags.splice(i, 1)"><Icon name="close" :size="12" /></button></span>
              <input id="cp-tag" v-model="tagDraft" class="tagin" :placeholder="form.tags.length < 5 ? L('输入后回车', '入力して Enter') : L('最多 5 个', '5 個まで')" :disabled="form.tags.length >= 5" @keydown.enter.prevent="addTag" />
            </div>
          </div>

          <div class="foot only-desktop">
            <button type="button" class="btn" @click="saveDraft">{{ L('存为草稿', '下書き保存') }}</button>
            <button class="btn btn-primary btn-lg">{{ L('发布帖子', '投稿する') }}</button>
          </div>
        </form>

        <aside class="preview only-desktop">
          <h2 class="t-h3">{{ L('在列表里的样子', '一覧での見え方') }}</h2>
          <div class="panel pv">
            <div class="row" style="gap: 8px">
              <span class="pvsec"><i class="dot" :style="{ color: sec.color }" />{{ L(sec.zh, sec.ja) }}</span>
              <span v-if="form.type !== 'discussion'" class="tag">{{ L(THREAD_TYPES[form.type].zh, THREAD_TYPES[form.type].ja) }}</span>
            </div>
            <div class="row" style="align-items: flex-start; gap: 14px">
              <div class="grow">
                <b class="pvt" :class="{ ph: !form.title }">{{ form.title || L('标题会显示在这里', 'タイトルがここに表示されます') }}</b>
                <p class="t-small pvs">{{ form.summary || form.blocks.find((b) => b.kind === 'p')?.text || L('摘要或正文的前两行', '概要または本文の冒頭') }}</p>
                <div class="row-wrap" style="margin-top: 8px"><span v-for="t in form.tags" :key="t" class="tag">{{ t }}</span></div>
              </div>
              <div v-if="song" class="pvsong"><Cover :song="song" size="lg" /><Diff :d="form.song.d" :star="chartOf(song.id, form.song.d).star" short /></div>
            </div>
          </div>
          <ul class="rules t-small">
            <li>{{ L('攻略帖关联谱面后，会出现在那首歌的详情页里。', '譜面を関連付けた攻略は、その楽曲のページにも表示されます。') }}</li>
            <li>{{ L('每帖最多 9 张图，单张不超过 5 MB。', '画像は 1 投稿 9 枚まで、1 枚 5 MB まで。') }}</li>
          </ul>
        </aside>
      </div>

      <!-- 手机底部工具条 -->
      <div class="mtools only-mobile">
        <button class="icon-btn" :aria-label="L('加一段', '段落を追加')" @click="form.blocks.push({ kind: 'p', text: '' })"><Icon name="plus" /></button>
        <button class="icon-btn" :aria-label="L('加一张图', '画像を追加')" @click="form.blocks.push({ kind: 'img' })"><Icon name="image" /></button>
        <button class="icon-btn" :aria-label="L('关联谱面', '譜面を関連付ける')" @click="songSheet = true"><Icon name="music" /></button>
        <span class="grow" />
        <span class="t-caption num">{{ form.blocks.reduce((n, b) => n + (b.text?.length || 0), 0) }} {{ L('字', '文字') }}</span>
      </div>
    </template>

    <Sheet :open="songSheet" :title="L('关联一张谱面', '譜面を関連付ける')" :width="480" @close="songSheet = false">
      <input v-model="sq" class="input" :placeholder="L('搜索曲名', '曲名で検索')" />
      <ul class="slist">
        <li v-for="s in found" :key="s.id">
          <button @click="(form.song = { id: s.id, d: s.charts.at(-1).d >= 4 ? 4 : s.charts.at(-1).d }), (songSheet = false)"><SongCell :song="s" /></button>
        </li>
      </ul>
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
  border-bottom: 2px solid var(--line-strong);
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
  border-bottom-color: var(--ink);
  border-radius: 0;
}
.title-in.bad {
  border-bottom-color: var(--danger);
}
.linkrow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
}
.linkrow b {
  display: block;
}
.dsel {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.dsel .chip {
  height: 26px;
  padding: 0 9px;
  font-size: var(--fs-12);
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
  border-radius: 0;
  border-left-color: var(--ka);
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
  color: var(--ink-3);
  font-size: var(--fs-13);
}
.rm {
  position: absolute;
  right: 0;
  top: 4px;
  width: 28px;
  height: 28px;
  color: var(--ink-3);
}
.addrow {
  display: flex;
  gap: 8px;
}
.tagbox {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 6px 8px;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-ctl);
}
.tagbox:focus-within {
  border-color: var(--ka);
  box-shadow: var(--focus);
}
.tagbox .chip button {
  display: grid;
  place-items: center;
  margin-right: -4px;
  color: var(--ink-3);
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
}
.foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.preview {
  position: sticky;
  top: calc(var(--bar-h) + 24px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pv {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}
.pvsec {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-12);
  font-weight: 500;
  color: var(--ink-2);
}
.pvt {
  display: block;
  font-size: var(--fs-16);
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.pvt.ph {
  color: var(--ink-3);
  font-weight: 500;
}
.pvs {
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.pvsong {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
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
}
.slist button {
  width: 100%;
  padding: 8px 4px;
  border-radius: var(--r-ctl);
  text-align: left;
}
.slist button:hover {
  background: var(--bg-sunk);
}
@media (max-width: 1099px) {
  .cols {
    grid-template-columns: minmax(0, 720px);
  }
}
@media (max-width: 767px) {
  .cp {
    padding-top: 0;
    padding-bottom: 80px;
  }
  .mtop {
    position: sticky;
    top: 52px;
    z-index: 5;
    display: flex !important;
    align-items: center;
    gap: 4px;
    margin: 0 calc(var(--gutter) * -1) 12px;
    padding: 6px 8px;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
  }
  .mtop > :first-child {
    margin-right: auto;
  }
  .secs {
    flex-wrap: nowrap;
    overflow-x: auto;
    margin: 0 calc(var(--gutter) * -1);
    padding: 0 var(--gutter);
    scrollbar-width: none;
  }
  .title-in {
    font-size: var(--fs-22);
  }
  .para {
    font-size: 16px;
  }
  .linkrow {
    flex-wrap: wrap;
  }
  .mtools {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-bar);
    display: flex !important;
    align-items: center;
    padding: 4px 12px calc(4px + env(safe-area-inset-bottom)) 4px;
    background: var(--surface);
    border-top: 1px solid var(--line);
  }
}
</style>
