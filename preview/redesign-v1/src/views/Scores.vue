<script setup>
import { computed, reactive, ref } from 'vue'
import Icon from '../components/Icon.vue'
import SongCell from '../components/SongCell.vue'
import Cover from '../components/Cover.vue'
import Diff from '../components/Diff.vue'
import Crown from '../components/Crown.vue'
import Rank from '../components/Rank.vue'
import Sheet from '../components/Sheet.vue'
import Gate from '../components/Gate.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { scores as allScores, songById, player, CROWNS, fmt } from '../mock/data'
import { L, isReady, songTitle, toast } from '../store'

// 全部成绩（旧版 /account/songs「歌曲数据 / 成绩管理 / 本地歌曲数据」三个名字，统一叫「全部成绩」）。
// 管理动作（手动补录、导入、锁定、删除）收进行内菜单和右侧抽屉，表格本身只负责读。
const scores = reactive(allScores.map((s) => ({ ...s })))
const q = ref('')
const crown = ref('all')
const diff = ref('all')
const sort = reactive({ key: 'date', dir: 1 })
const binding = ref(1)
const editing = ref(null)
const importOpen = ref(false)
const confirmDel = ref(null)

const rows = computed(() => {
  const term = q.value.trim().toLowerCase()
  let list = scores
  if (term) list = list.filter((s) => `${songById[s.songId].ja} ${songById[s.songId].zh}`.toLowerCase().includes(term))
  if (crown.value !== 'all') list = list.filter((s) => String(s.crown) === crown.value)
  if (diff.value !== 'all') list = list.filter((s) => String(s.d) === diff.value)
  const val = (s) => ({ date: s.daysAgo, score: -s.score, ng: s.ng, plays: -s.plays, const: -(s.constant ?? 0) })[sort.key]
  return [...list].sort((a, b) => (val(a) - val(b)) * sort.dir)
})
function sortBy(k) {
  if (sort.key === k) sort.dir *= -1
  else Object.assign(sort, { key: k, dir: 1 })
}
const when = (n) => (n === 0 ? L('今天', '今日') : n === 1 ? L('昨天', '昨日') : L(`${n} 天前`, `${n} 日前`))
function save() {
  editing.value = null
  toast(L('成绩已保存', '記録を保存しました'))
}
function remove() {
  const i = scores.indexOf(confirmDel.value)
  if (i >= 0) scores.splice(i, 1)
  confirmDel.value = null
  toast(L('已删除这条成绩', '記録を削除しました'), 'info')
}
const totals = { n: 874, clear: player.crownCounts.clear, fc: player.crownCounts.fc, dfc: player.crownCounts.dfc }
</script>

<template>
  <div class="page">
    <Gate v-if="!isReady" :what="L('全部成绩', '全成績')" />
    <template v-else>
      <div class="summary">
        <label class="bind">
          <span class="t-caption">{{ L('当前账号', '現在のアカウント') }}</span>
          <select v-model="binding" class="select">
            <option v-for="b in player.bindings" :key="b.id" :value="b.id">{{ b.region }} · {{ b.name }} · {{ b.taikoId }}</option>
          </select>
        </label>
        <div class="stat"><div class="v">{{ totals.n }}</div><div class="k">{{ L('有成绩的谱面', '記録のある譜面') }}</div></div>
        <div class="stat"><div class="v">{{ totals.clear }}</div><div class="k">{{ L('通关', 'クリア') }}</div></div>
        <div class="stat"><div class="v">{{ totals.fc }}</div><div class="k">{{ L('全连', 'フルコンボ') }}</div></div>
        <div class="stat"><div class="v">{{ totals.dfc }}</div><div class="k">{{ L('全良', '全良') }}</div></div>
        <div class="acts">
          <button class="btn" @click="importOpen = true"><Icon name="upload" :size="16" />{{ L('导入成绩', 'インポート') }}</button>
          <button class="btn btn-ink" @click="editing = { new: true, songId: 615, d: 4, score: '', good: '', ok: '', ng: '' }"><Icon name="plus" :size="16" />{{ L('补录一条', '手動で追加') }}</button>
        </div>
      </div>

      <div class="toolbar">
        <label class="search">
          <Icon name="search" :size="18" />
          <input v-model="q" class="sinput" :placeholder="L('按曲名筛选', '曲名で絞り込み')" />
        </label>
        <div class="chips">
          <button class="chip" :aria-pressed="diff === 'all'" @click="diff = 'all'">{{ L('全部难度', '全難易度') }}</button>
          <button class="chip" :aria-pressed="diff === '4'" @click="diff = '4'">{{ L('魔王', 'おに') }}</button>
          <button class="chip" :aria-pressed="diff === '5'" @click="diff = '5'">{{ L('里', '裏') }}</button>
          <span class="sep" />
          <button class="chip" :aria-pressed="crown === 'all'" @click="crown = 'all'">{{ L('全部王冠', '全王冠') }}</button>
          <button v-for="c in ['2', '1', '0', '-1']" :key="c" class="chip" :aria-pressed="crown === c" @click="crown = c"><Crown :v="Number(c)" size="sm" />{{ L(CROWNS[c].zh, CROWNS[c].ja) }}</button>
        </div>
      </div>

      <div v-if="!rows.length" class="panel">
        <EmptyLane :title="L('没有符合条件的成绩', '条件に合う記録がありません')">
          <button class="btn" @click="(q = ''), (crown = 'all'), (diff = 'all')">{{ L('清除筛选', '絞り込みをクリア') }}</button>
        </EmptyLane>
      </div>

      <div v-else class="panel only-desktop">
        <table class="dt dt-compact">
          <thead>
            <tr>
              <th>{{ L('歌曲', '楽曲') }}</th>
              <th :aria-sort="sort.key === 'const' ? 'descending' : undefined"><button @click="sortBy('const')">{{ L('难度 · 定数', '難易度 · 定数') }}</button></th>
              <th class="r" :aria-sort="sort.key === 'score' ? 'descending' : undefined"><button @click="sortBy('score')">{{ L('最好成绩', '自己ベスト') }}</button></th>
              <th class="r">{{ L('良', '良') }}</th>
              <th class="r">{{ L('可', '可') }}</th>
              <th class="r" :aria-sort="sort.key === 'ng' ? 'ascending' : undefined"><button @click="sortBy('ng')">{{ L('不可', '不可') }}</button></th>
              <th class="r">{{ L('连击', 'コンボ') }}</th>
              <th class="c">{{ L('王冠', '王冠') }}</th>
              <th class="c">{{ L('评价', '評価') }}</th>
              <th class="r" :aria-sort="sort.key === 'plays' ? 'descending' : undefined"><button @click="sortBy('plays')">{{ L('次数', '回数') }}</button></th>
              <th class="r" :aria-sort="sort.key === 'date' ? 'descending' : undefined"><button @click="sortBy('date')">{{ L('更新', '更新') }}</button></th>
              <th style="width: 84px" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in rows" :key="s.songId + '-' + s.d">
              <td class="tcell"><RouterLink :to="`/songs/${s.songId}?d=${s.d}`"><SongCell :song="songById[s.songId]" size="sm" /></RouterLink></td>
              <td><Diff :d="s.d" :star="s.star" :constant="s.constant" short /></td>
              <td class="r num sc">{{ fmt(s.score) }}</td>
              <td class="r num">{{ s.good }}</td>
              <td class="r num">{{ s.ok }}</td>
              <td class="r num" :class="{ zero: s.ng === 0 }">{{ s.ng }}</td>
              <td class="r num">{{ s.combo }}</td>
              <td class="c"><Crown :v="s.crown" /></td>
              <td class="c"><Rank :v="s.rank" /></td>
              <td class="r num">{{ s.plays }}</td>
              <td class="r faint">{{ when(s.daysAgo) }}</td>
              <td class="r ops">
                <button class="icon-btn sm" :class="{ locked: s.locked }" :aria-pressed="s.locked" :title="s.locked ? L('已锁定，同步不会覆盖', 'ロック中：同期で上書きされません') : L('锁定这条成绩', 'この記録をロック')" @click="s.locked = !s.locked"><Icon name="lock" :size="16" /></button>
                <button class="icon-btn sm" :title="L('修改', '編集')" @click="editing = { ...s }"><Icon name="edit" :size="16" /></button>
                <button class="icon-btn sm" :title="L('删除', '削除')" @click="confirmDel = s"><Icon name="trash" :size="16" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="rows.length" class="more-row"><span class="t-small">{{ L(`已显示 ${rows.length} / ${totals.n} 条`, `${rows.length} / ${totals.n} 件を表示`) }}</span><button class="btn btn-sm">{{ L('再加载 50 条', 'さらに 50 件') }}</button></p>

      <ul v-if="rows.length" class="mlist only-mobile">
        <li v-for="s in rows" :key="s.songId + '-' + s.d">
          <button class="mrow" @click="editing = { ...s }">
            <Cover :song="songById[s.songId]" />
            <span class="grow">
              <b class="truncate mt">{{ songTitle(songById[s.songId]) }}</b>
              <span class="row" style="gap: 8px; margin-top: 4px">
                <Diff :d="s.d" :star="s.star" short />
                <span class="t-caption num">{{ s.good }} / {{ s.ok }} / {{ s.ng }}</span>
                <Icon v-if="s.locked" name="lock" :size="12" />
              </span>
            </span>
            <span class="mright">
              <b class="num">{{ fmt(s.score) }}</b>
              <span class="row" style="gap: 6px"><Crown :v="s.crown" size="sm" /><Rank :v="s.rank" /></span>
            </span>
          </button>
        </li>
      </ul>
    </template>

    <Sheet :open="!!editing" :title="editing?.new ? L('补录一条成绩', '記録を手動で追加') : L('修改成绩', '記録を編集')" :width="460" @close="editing = null">
      <form v-if="editing" class="col" style="gap: 14px" @submit.prevent="save">
        <div class="esong"><Cover :song="songById[editing.songId]" /><b class="grow truncate">{{ songTitle(songById[editing.songId]) }}</b><Diff :d="editing.d" short /></div>
        <div class="field"><label for="e-score">{{ L('成绩', 'スコア') }}</label><input id="e-score" v-model="editing.score" class="input num" inputmode="numeric" /></div>
        <div class="tri">
          <div class="field"><label for="e-g">{{ L('良', '良') }}</label><input id="e-g" v-model="editing.good" class="input num" inputmode="numeric" /></div>
          <div class="field"><label for="e-o">{{ L('可', '可') }}</label><input id="e-o" v-model="editing.ok" class="input num" inputmode="numeric" /></div>
          <div class="field"><label for="e-n">{{ L('不可', '不可') }}</label><input id="e-n" v-model="editing.ng" class="input num" inputmode="numeric" /></div>
        </div>
        <p class="field-hint">{{ L('手动修改的成绩会被标记，并且不会进入全站排名。锁定后，之后的同步不会覆盖它。', '手動で編集した記録にはマークが付き、全体ランキングには含まれません。') }}</p>
      </form>
      <template #foot>
        <button v-if="editing && !editing.new" class="btn btn-ghost only-mobile" style="color: var(--danger)" @click="(confirmDel = rows.find((r) => r.songId === editing.songId && r.d === editing.d)), (editing = null)">{{ L('删除', '削除') }}</button>
        <button class="btn" @click="editing = null">{{ L('取消', 'キャンセル') }}</button>
        <button class="btn btn-primary" @click="save">{{ L('保存修改', '変更を保存') }}</button>
      </template>
    </Sheet>

    <Sheet :open="importOpen" :title="L('导入成绩', '成績をインポート')" :width="480" @close="importOpen = false">
      <div class="drop">
        <Icon name="upload" :size="28" />
        <b>{{ L('把成绩文件拖到这里', 'ここにファイルをドロップ') }}</b>
        <span class="t-small">{{ L('支持 Donder Hiroba 导出的 JSON、菌菌控制台导出的 CSV', 'Donder Hiroba の JSON、Kinoko の CSV に対応') }}</span>
        <button class="btn btn-sm">{{ L('选择文件', 'ファイルを選択') }}</button>
      </div>
      <label class="check"><input type="checkbox" checked />{{ L('只在新成绩更高时覆盖', 'スコアが高い場合のみ上書き') }}</label>
      <template #foot><button class="btn" @click="importOpen = false">{{ L('取消', 'キャンセル') }}</button><button class="btn btn-primary" disabled>{{ L('开始导入', 'インポート開始') }}</button></template>
    </Sheet>

    <Sheet :open="!!confirmDel" :title="L('删除这条成绩？', 'この記録を削除しますか？')" :width="420" @close="confirmDel = null">
      <p v-if="confirmDel">{{ L(`「${songTitle(songById[confirmDel.songId])}」的最好成绩 ${fmt(confirmDel.score)} 会从 Viewer 移除。游戏里的成绩不受影响，下次同步会重新写入。`, `「${songTitle(songById[confirmDel.songId])}」の記録 ${fmt(confirmDel.score)} を Viewer から削除します。ゲーム内の記録には影響しません。`) }}</p>
      <template #foot><button class="btn" @click="confirmDel = null">{{ L('保留', '残す') }}</button><button class="btn btn-danger" @click="remove">{{ L('删除成绩', '記録を削除') }}</button></template>
    </Sheet>
  </div>
</template>

<style scoped>
.summary {
  display: flex;
  align-items: flex-end;
  gap: 36px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.bind {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 300px;
}
.acts {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
.toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 14px;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 260px;
  height: 38px;
  padding: 0 12px;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-note);
  color: var(--ink-3);
  flex: none;
}
.search:focus-within {
  border-color: var(--ka);
  box-shadow: var(--focus);
}
.sinput {
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  height: 100%;
  color: var(--ink);
}
.sinput:focus-visible {
  box-shadow: none;
}
.chips {
  display: flex;
  gap: 8px;
  align-items: center;
  overflow-x: auto;
  scrollbar-width: none;
}
.sep {
  width: 1px;
  height: 20px;
  background: var(--line-strong);
  flex: none;
}
.dt th {
  top: var(--bar-h);
}
.dt th:first-child {
  border-top-left-radius: var(--r-panel);
}
.dt th:last-child {
  border-top-right-radius: var(--r-panel);
}
.tcell {
  max-width: 0;
  width: 26%;
}
.sc {
  font-size: var(--fs-16);
  font-weight: 700;
}
.zero {
  color: var(--ink-3);
}
.ops {
  white-space: nowrap;
  padding-right: 6px !important;
}
.icon-btn.sm {
  width: 26px;
  height: 26px;
  display: inline-grid;
  color: var(--ink-3);
  opacity: 0;
}
tr:hover .icon-btn.sm,
.icon-btn.sm:focus-visible,
.icon-btn.sm.locked {
  opacity: 1;
}
.icon-btn.sm.locked {
  color: var(--roll-ink);
}
.more-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 16px;
}
.esong {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}
.tri {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.input.num {
  font-size: var(--fs-18);
}
.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 20px;
  border: 2px dashed var(--line-strong);
  border-radius: var(--r-panel);
  text-align: center;
  color: var(--ink-2);
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  font-size: var(--fs-13);
}
.check input {
  width: 16px;
  height: 16px;
  accent-color: var(--don);
}
@media (max-width: 767px) {
  .summary {
    gap: 16px 24px;
  }
  .bind {
    width: 100%;
  }
  .acts {
    width: 100%;
    margin: 0;
  }
  .acts .btn {
    flex: 1;
  }
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .search {
    width: 100%;
    height: 44px;
  }
  .sinput {
    font-size: 16px;
  }
  .chips {
    margin: 0 calc(var(--gutter) * -1);
    padding: 0 var(--gutter);
  }
  .mlist {
    display: block !important;
    border-top: 1px solid var(--line-strong);
  }
  .mrow {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
    text-align: left;
  }
  .mt {
    display: block;
    line-height: 1.3;
  }
  .mright {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }
  .mright b {
    font-size: var(--fs-18);
  }
}
</style>
