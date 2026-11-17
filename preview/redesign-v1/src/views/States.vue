<script setup>
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import EmptyLane from '../components/EmptyLane.vue'
import Sheet from '../components/Sheet.vue'
import SongCell from '../components/SongCell.vue'
import Cover from '../components/Cover.vue'
import Diff from '../components/Diff.vue'
import SyncPanel from '../components/SyncPanel.vue'
import { songs, songById, chartOf, EDGE } from '../mock/data'
import { store, L, toast, runSync, songTitle, songSub, subLang } from '../store'

// 状态页样例：全站的加载 / 空 / 引导 / 错误 / 反馈 / 边界数据形态。
const SPEC_COUNT = 24

// 边界曲目（M2）：优先取 EDGE 桶；demo 数据集里没有时退回一首可用的歌，样例仍然成立
const pick = (k) => songById[EDGE[k]?.[0]] || null
const longest = () => songs.reduce((a, b) => (b.ja.length > a.ja.length ? b : a), songs[0])
const noConstSong = pick('noConstant') || songs[0]
const noImageSong = pick('noChartImage') || songs[1] || songs[0]
const noAudioSong = pick('noAudio') || songs[2] || songs[0]
const unlistedSong = pick('unlisted') || songs[0]
const longSong = pick('longJa') || longest()
const specialSong = pick('special') || songs[0]
const longConst = computed(() => chartOf(longSong.id, 4)?.constant ?? null)
const songLink = (s) => ({ path: `/songs/${s.id}`, query: { from: 'states' } })
const draftGone = ref(false)
const idDemo = ref('4829 1735 0662')
const idError = computed(() => {
  const v = idDemo.value.trim()
  if (!v) return L('请输入鼓众广场 ID。', '鼓衆広場 ID を入力してください。')
  if (/\D/.test(v)) return L('ID 只包含数字，请去掉空格和其他字符。', 'ID は数字のみです。空白や記号を取り除いてください。')
  if (v.length !== 12) return L(`鼓众广场 ID 是 12 位数字，现在是 ${v.length} 位。`, `鼓衆広場 ID は 12 桁です（現在 ${v.length} 桁）。`)
  return ''
})

const confirmOpen = ref(false)
const deleted = ref(false)
function doDelete() {
  confirmOpen.value = false
  deleted.value = true
  toast(L('已删除 1 条手动成绩', '手動記録を 1 件削除しました'))
}
const retried = (zh, ja) => toast(L(zh, ja), 'info')
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1 class="t-h1">{{ L('状态页样例', '状態パターン一覧') }}</h1>
      <span class="t-small"><span class="num">{{ SPEC_COUNT }}</span> {{ L('种', '種類') }}</span>
    </header>

    <div class="grid">
      <!-- 1 加载：骨架屏 -->
      <figure class="spec">
        <div class="panel frame top" aria-busy="true">
          <ul class="sk-list">
            <li v-for="i in 4" :key="i">
              <i class="sk sk-cover" />
              <span class="grow"><i class="sk" :style="{ width: `${[62, 78, 48, 70][i - 1]}%` }" /><i class="sk sk-sub" :style="{ width: `${[34, 42, 30, 38][i - 1]}%` }" /></span>
              <i class="sk sk-diff" />
            </li>
          </ul>
        </div>
        <figcaption class="t-caption">{{ L('加载（骨架屏）', '読み込み（スケルトン）') }}</figcaption>
      </figure>

      <!-- 2 加载：谱面流 -->
      <figure class="spec">
        <div class="panel frame">
          <EmptyLane tone="loading" compact :title="L('正在读取成绩…', '成績を読み込み中…')" />
        </div>
        <figcaption class="t-caption">{{ L('加载（谱面流）', '読み込み（譜面フロー）') }}</figcaption>
      </figure>

      <!-- 3 空：没有成绩 -->
      <figure class="spec">
        <div class="panel frame">
          <EmptyLane compact :title="L('还没有成绩', 'まだ成績がありません')" :text="L('同步一次，鼓众广场上的成绩就会出现在这里。', '一度同期すると、鼓衆広場の成績がここに表示されます。')">
            <button type="button" class="btn btn-primary" :disabled="store.syncing" @click="runSync"><Icon name="sync" :size="16" />{{ store.syncing ? L('正在同步…', '同期中…') : L('同步成绩', '成績を同期') }}</button>
          </EmptyLane>
        </div>
        <figcaption class="t-caption">{{ L('空：没有成绩', '空：成績なし') }}</figcaption>
      </figure>

      <!-- 4 空：搜索无结果 -->
      <figure class="spec">
        <div class="panel frame">
          <EmptyLane compact :title="L('没有符合条件的歌曲', '条件に合う楽曲がありません')" :text="L('当前筛选：魔王（里）· 定数 14.5 以上 · 未全连。', '現在の条件：おに（裏）・定数 14.5 以上・未フルコンボ。')">
            <button type="button" class="btn" @click="toast(L('已清除 3 个筛选条件', '3 件の条件をクリアしました'))">{{ L('清除筛选', '条件をクリア') }}</button>
          </EmptyLane>
        </div>
        <figcaption class="t-caption">{{ L('空：搜索无结果', '空：検索結果なし') }}</figcaption>
      </figure>

      <!-- 5 未登录引导 -->
      <figure class="spec">
        <div class="panel frame">
          <EmptyLane compact :title="L('登录后查看自己的成绩', 'ログインして記録を見る')" :text="L('曲库、定数表和工具不用登录也能用。', '楽曲一覧・定数表・ツールはログインなしで使えます。')">
            <RouterLink to="/login" class="btn btn-primary">{{ L('登录', 'ログイン') }}</RouterLink>
            <RouterLink to="/login?mode=register" class="btn">{{ L('注册', '新規登録') }}</RouterLink>
          </EmptyLane>
        </div>
        <figcaption class="t-caption">{{ L('未登录引导', '未ログイン') }}</figcaption>
      </figure>

      <!-- 6 未绑定引导 -->
      <figure class="spec">
        <div class="panel frame">
          <EmptyLane compact :title="L('还没有绑定鼓众广场 ID', '鼓衆広場 ID が未連携です')" :text="L('绑定后才能同步成绩，大约需要 2 分钟。', '連携すると成績を同期できます。所要時間は約 2 分です。')">
            <RouterLink to="/bind" class="btn btn-primary"><Icon name="link" :size="16" />{{ L('去绑定', '連携する') }}</RouterLink>
          </EmptyLane>
        </div>
        <figcaption class="t-caption">{{ L('未绑定引导', '未連携') }}</figcaption>
      </figure>

      <!-- 7 错误：加载失败 -->
      <figure class="spec">
        <div class="panel frame">
          <EmptyLane tone="error" compact :title="L('这一页没有加载出来', 'このページを読み込めませんでした')" :text="L('网络可能不稳定。已保存的数据不受影响。', '通信が不安定な可能性があります。保存済みのデータに影響はありません。')">
            <button type="button" class="btn btn-ink" @click="retried('正在重新加载…', '再読み込み中…')">{{ L('重试', '再試行') }}</button>
          </EmptyLane>
        </div>
        <figcaption class="t-caption">{{ L('错误：加载失败', 'エラー：読み込み失敗') }}</figcaption>
      </figure>

      <!-- 8 错误：同步失败 -->
      <figure class="spec">
        <div class="panel frame">
          <EmptyLane tone="error" compact :title="L('同步没有完成', '同期が完了しませんでした')" :text="L('鼓众广场暂时没有响应。已有的成绩不受影响，过几分钟再试。', '鼓衆広場から応答がありません。既存の成績に影響はありません。数分後にもう一度お試しください。')">
            <button type="button" class="btn btn-ink" :disabled="store.syncing" @click="runSync">{{ store.syncing ? L('正在同步…', '同期中…') : L('重试', '再試行') }}</button>
            <RouterLink to="/account/sync" class="btn btn-ghost">{{ L('查看同步记录', '同期履歴を見る') }}</RouterLink>
          </EmptyLane>
        </div>
        <figcaption class="t-caption">{{ L('错误：同步失败', 'エラー：同期失敗') }}</figcaption>
      </figure>

      <!-- 9 404 -->
      <figure class="spec">
        <div class="panel frame">
          <EmptyLane compact :title="L('这里没有谱面', 'ここに譜面はありません')" :text="L('这个地址没有对应的页面。可以直接搜索曲名、帖子或工具。', 'このアドレスにページはありません。曲名・投稿・ツールを検索できます。')">
            <button type="button" class="btn btn-primary" @click="store.paletteOpen = true"><Icon name="search" :size="16" />{{ L('打开搜索', '検索を開く') }}</button>
            <RouterLink to="/" class="btn">{{ L('回到今日', '「今日」に戻る') }}</RouterLink>
          </EmptyLane>
        </div>
        <figcaption class="t-caption">404</figcaption>
      </figure>

      <!-- 10 离线 -->
      <figure class="spec">
        <div class="panel frame">
          <EmptyLane tone="error" compact :title="L('网络断开了', 'オフラインです')" :text="L('已经加载的内容仍然可以查看。恢复连接后会自动刷新。', '読み込み済みの内容は引き続き閲覧できます。接続が戻ると自動で更新します。')">
            <button type="button" class="btn" @click="retried('仍然没有网络连接', 'まだ接続できません')">{{ L('重新连接', '再接続') }}</button>
          </EmptyLane>
        </div>
        <figcaption class="t-caption">{{ L('离线', 'オフライン') }}</figcaption>
      </figure>

      <!-- 11 无权限 -->
      <figure class="spec">
        <div class="panel frame">
          <div class="gate">
            <span class="gate-ic"><Icon name="lock" :size="22" /></span>
            <h3 class="t-h2">{{ L('这一页需要开发者权限', 'このページには開発者権限が必要です') }}</h3>
            <p class="t-small">{{ L('你的账号还没有开通。提交工单申请，通常 1–2 个工作日内回复。', 'このアカウントではまだ有効になっていません。サポートから申請すると、通常 1〜2 営業日で返信します。') }}</p>
            <div class="row-wrap gate-acts">
              <RouterLink to="/account/support" class="btn btn-primary">{{ L('申请开发者权限', '開発者権限を申請') }}</RouterLink>
              <RouterLink to="/" class="btn">{{ L('回到今日', '「今日」に戻る') }}</RouterLink>
            </div>
          </div>
        </div>
        <figcaption class="t-caption">{{ L('无权限（需要开发者权限）', '権限なし（開発者権限が必要）') }}</figcaption>
      </figure>

      <!-- 12 表单校验 -->
      <figure class="spec">
        <div class="panel frame pad">
          <form class="col" novalidate @submit.prevent>
            <div class="field">
              <label for="st-id">{{ L('鼓众广场 ID', '鼓衆広場 ID') }}</label>
              <input id="st-id" v-model="idDemo" class="input num" :class="{ 'is-error': idError }" type="text" inputmode="numeric" autocomplete="off" maxlength="16" :aria-invalid="!!idError" :aria-describedby="idError ? 'st-id-err' : 'st-id-ok'" />
              <p v-if="idError" id="st-id-err" class="field-error">{{ idError }}</p>
              <p v-else id="st-id-ok" class="field-hint">{{ L('其他人看到的是', '他の人には次のように表示されます：') }} <b class="num">{{ idDemo.trim().slice(0, 4) }}••••{{ idDemo.trim().slice(-4) }}</b></p>
            </div>
            <button type="submit" class="btn btn-primary" :disabled="!!idError">{{ L('查找这个 ID', 'この ID を検索') }}</button>
          </form>
        </div>
        <figcaption class="t-caption">{{ L('表单校验', 'フォーム検証') }}</figcaption>
      </figure>

      <!-- 13 成功提示 -->
      <figure class="spec">
        <div class="panel frame pad center">
          <button type="button" class="btn btn-primary" @click="toast(L('设置已保存', '設定を保存しました'))">{{ L('保存设置', '設定を保存') }}</button>
          <button type="button" class="btn" @click="toast(L('链接已复制', 'リンクをコピーしました'), 'info')"><Icon name="copy" :size="16" />{{ L('复制链接', 'リンクをコピー') }}</button>
        </div>
        <figcaption class="t-caption">{{ L('成功提示', '完了トースト') }}</figcaption>
      </figure>

      <!-- 14 确认删除 -->
      <figure class="spec">
        <div class="panel frame pad">
          <div v-if="!deleted" class="del-row">
            <div class="grow">
              <b lang="ja">天狗囃子</b>
              <p class="t-caption">{{ L('手动成绩', '手動記録') }} · <span class="num">968,440</span></p>
            </div>
            <button type="button" class="btn btn-sm del-btn" @click="confirmOpen = true"><Icon name="trash" :size="16" />{{ L('删除这条成绩', 'この記録を削除') }}</button>
          </div>
          <div v-else class="del-row">
            <p class="t-small grow">{{ L('这条成绩已删除。', 'この記録は削除されました。') }}</p>
            <button type="button" class="btn btn-sm" @click="deleted = false">{{ L('恢复样例', 'サンプルを戻す') }}</button>
          </div>
        </div>
        <figcaption class="t-caption">{{ L('确认删除', '削除の確認') }}</figcaption>
      </figure>

      <!-- 15 同步中：真实的 SyncPanel，force 指定情形，不改全局同步状态（I7） -->
      <figure class="spec">
        <div class="panel frame stack pad top">
          <SyncPanel :force="{ state: 'running', phase: 1 }" />
        </div>
        <figcaption class="t-caption">{{ L('同步中', '同期中') }}</figcaption>
      </figure>

      <!-- 16 同步部分成功 -->
      <figure class="spec">
        <div class="panel frame stack pad top">
          <SyncPanel :force="{ state: 'partial' }" />
        </div>
        <figcaption class="t-caption">{{ L('同步部分成功', '同期：一部成功') }}</figcaption>
      </figure>

      <!-- 17 同步失败（面板） -->
      <figure class="spec">
        <div class="panel frame stack pad top">
          <SyncPanel :force="{ state: 'failed' }" />
        </div>
        <figcaption class="t-caption">{{ L('同步失败（同步面板）', '同期失敗（同期パネル）') }}</figcaption>
      </figure>

      <!-- 18 缺定数 -->
      <figure class="spec">
        <div class="panel frame stack pad">
          <div class="song-row">
            <RouterLink :to="songLink(noConstSong)" class="row-link"><SongCell :song="noConstSong" /></RouterLink>
            <Diff :d="4" :star="noConstSong.levels[3]" :constant="null" show-missing />
          </div>
          <p class="t-small note-line">{{ L('定数还没有算出来，Rating 不计入这张谱。', '定数が未算出のため、この譜面は Rating に含まれません。') }}</p>
        </div>
        <figcaption class="t-caption">{{ L('缺定数', '定数なし') }}</figcaption>
      </figure>

      <!-- 19 没有谱面图 -->
      <figure class="spec">
        <div class="panel frame stack pad">
          <div class="song-row">
            <RouterLink :to="songLink(noImageSong)" class="row-link"><SongCell :song="noImageSong" /></RouterLink>
          </div>
          <div class="no-chart">
            <Icon name="image" :size="20" />
            <b>{{ L('这张谱面还没有谱面图', 'この譜面の譜面画像はまだありません') }}</b>
            <span class="t-small">{{ L('物量、定数与我的成绩不受影响。', 'ノーツ数・定数・自分の成績は表示されます。') }}</span>
          </div>
        </div>
        <figcaption class="t-caption">{{ L('没有谱面图', '譜面画像なし') }}</figcaption>
      </figure>

      <!-- 20 没有试听 -->
      <figure class="spec">
        <div class="panel frame stack pad">
          <div class="song-row">
            <RouterLink :to="songLink(noAudioSong)" class="row-link"><SongCell :song="noAudioSong" /></RouterLink>
            <button type="button" class="btn btn-sm" disabled><Icon name="playTri" :size="14" />{{ L('暂无试听', '試聴なし') }}</button>
          </div>
        </div>
        <figcaption class="t-caption">{{ L('没有试听', '試聴なし') }}</figcaption>
      </figure>

      <!-- 21 长标题 -->
      <figure class="spec">
        <div class="panel frame stack pad top">
          <header class="long-head">
            <Cover :song="specialSong" size="lg" />
            <div class="grow">
              <h3 class="t-h2 title-wrap" :title="songTitle(specialSong)">{{ songTitle(specialSong) }}</h3>
              <p v-if="songSub(specialSong)" class="t-small title-wrap-2" :lang="subLang">{{ songSub(specialSong) }}</p>
            </div>
          </header>
          <div class="song-row">
            <RouterLink :to="songLink(longSong)" class="row-link"><SongCell :song="longSong" /></RouterLink>
            <Diff :d="4" :star="longSong.levels[3]" :constant="longConst" show-missing short />
          </div>
        </div>
        <figcaption class="t-caption">{{ L('长标题与特殊字符', '長いタイトル・特殊文字') }}</figcaption>
      </figure>

      <!-- 22 国行未上架 -->
      <figure class="spec">
        <div class="panel frame stack pad">
          <div class="song-row">
            <RouterLink :to="songLink(unlistedSong)" class="row-link"><SongCell :song="unlistedSong" /></RouterLink>
            <span class="tag"><i class="ring" aria-hidden="true" />{{ L('国行未上架', '中国版未収録') }}</span>
          </div>
          <p class="t-small note-line">{{ L('国行机台上还玩不到这首歌，成绩来自其他版本。', '中国版の筐体ではまだ遊べません。成績は他のバージョンのものです。') }}</p>
        </div>
        <figcaption class="t-caption">{{ L('国行未上架', '中国版未収録') }}</figcaption>
      </figure>

      <!-- 23 被屏蔽的楼层 -->
      <figure class="spec">
        <div class="panel frame stack pad">
          <div class="floor-hidden">
            <span class="num floor-n">#17</span>
            <Icon name="lock" :size="16" />
            <span>{{ L('这层楼已被站务屏蔽', 'この投稿は運営により非表示になりました') }}</span>
          </div>
          <p class="t-small note-line">{{ L('楼层编号保留，回复与楼中楼仍按原顺序显示。', '番号は残り、返信は元の順序で表示されます。') }}</p>
        </div>
        <figcaption class="t-caption">{{ L('被屏蔽的楼层', '非表示の投稿') }}</figcaption>
      </figure>

      <!-- 24 草稿已恢复 -->
      <figure class="spec">
        <div class="panel frame stack pad">
          <div v-if="!draftGone" class="draft" role="status">
            <span class="tag tag-info"><Icon name="history" :size="12" />{{ L('草稿已恢复', '下書きを復元') }}</span>
            <span class="t-small">{{ L('11-16 20:31 保存在这台设备上', '11-16 20:31 にこの端末へ保存') }}</span>
            <div class="row-wrap">
              <button type="button" class="btn btn-sm btn-primary" @click="retried('继续编辑草稿', '下書きの編集を続けます')">{{ L('继续编辑', '編集を続ける') }}</button>
              <button type="button" class="btn btn-sm btn-ghost quiet-danger" @click="draftGone = true">{{ L('丢弃草稿', '下書きを破棄') }}</button>
            </div>
          </div>
          <div v-else class="del-row">
            <p class="t-small grow">{{ L('草稿已丢弃。', '下書きを破棄しました。') }}</p>
            <button type="button" class="btn btn-sm" @click="draftGone = false">{{ L('恢复样例', 'サンプルを戻す') }}</button>
          </div>
        </div>
        <figcaption class="t-caption">{{ L('草稿已恢复', '下書きの復元') }}</figcaption>
      </figure>
    </div>

    <Sheet :open="confirmOpen" :title="L('删除这条手动成绩？', 'この手動記録を削除しますか？')" :width="440" @close="confirmOpen = false">
      <p>{{ L('天狗囃子 魔王 · 968,440 分。删除后无法恢复，Rating 会重新计算。', '天狗囃子 おに・968,440 点。削除すると元に戻せません。Rating は再計算されます。') }}</p>
      <template #foot>
        <button type="button" class="btn" @click="confirmOpen = false">{{ L('取消', 'キャンセル') }}</button>
        <button type="button" class="btn btn-danger" @click="doDelete">{{ L('删除成绩', '記録を削除') }}</button>
      </template>
    </Sheet>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
  gap: 24px 20px;
}
.spec {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.frame {
  flex: 1;
  display: grid;
  align-content: center;
  min-height: 248px;
  overflow: hidden;
}
.frame.top {
  align-content: start;
}
.frame.pad {
  padding: var(--sp-5);
}
.frame.center {
  grid-auto-flow: column;
  justify-content: center;
  gap: 8px;
}
.spec figcaption {
  padding-left: 2px;
}

/* 骨架屏：与歌曲列表同构（封面 · 两行文字 · 难度） */
.sk-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 20px;
  border-bottom: 1px solid var(--line);
}
.sk-list li:last-child {
  border-bottom: 0;
}
.sk-list .grow {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sk-list .sk {
  display: block;
  height: 14px;
}
.sk-list .sk-sub {
  height: 10px;
}
.sk-list .sk-cover {
  width: 44px;
  height: 44px;
  border-radius: var(--r-ctl);
  flex: none;
}
.sk-list .sk-diff {
  width: 56px;
  height: 22px;
  flex: none;
}

.gate {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 16px 28px;
  text-align: center;
}
.gate-ic {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-bottom: 8px;
  border-radius: 50%;
  background: var(--warn-wash);
  color: var(--warn);
}
.gate-acts {
  justify-content: center;
  margin-top: 10px;
}

.del-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.del-btn {
  color: var(--danger);
}
.field-hint b {
  color: var(--ink);
}

/* 边界数据 */
.song-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 8px 0;
}
.row-link {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  display: flex;
  align-items: center;
  border-radius: var(--r-ctl);
}
.row-link :deep(.songcell) {
  width: 100%;
}
.song-row > :not(.row-link) {
  flex: none;
}
.note-line {
  color: var(--ink-2);
}
.no-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 20px 12px;
  border: 1.5px dashed var(--ctl-border);
  border-radius: var(--r-ctl);
  text-align: center;
  color: var(--ink-2);
}
.no-chart b {
  color: var(--ink);
  font-size: var(--fs-14);
}
.long-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
  padding-bottom: 12px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--line);
}
.long-head .grow {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.long-head .t-small {
  color: var(--ink-2);
}
.ring {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px currentColor;
  flex: none;
}
.floor-hidden {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 12px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.floor-n {
  color: var(--ink);
  font-weight: 700;
}
.draft {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.draft .t-small {
  color: var(--ink-2);
}
.quiet-danger {
  color: var(--danger);
}
.frame.stack > * + * {
  margin-top: 8px;
}

@media (max-width: 767px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .frame {
    min-height: 0;
  }
  .frame.center {
    grid-auto-flow: row;
    justify-content: stretch;
  }
  .del-row {
    flex-wrap: wrap;
  }
}
</style>
