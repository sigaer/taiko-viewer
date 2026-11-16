<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '../components/Icon.vue'
import Radar from '../components/Radar.vue'
import Lane from '../components/Lane.vue'
import Crown from '../components/Crown.vue'
import ThreadRow from '../components/ThreadRow.vue'
import SongCell from '../components/SongCell.vue'
import Diff from '../components/Diff.vue'
import Rank from '../components/Rank.vue'
import { player, users, DIMS, laneDays, threads, bestList, songById, fmt } from '../mock/data'
import { L, toast } from '../store'

// 个人主页（对外）。旧版只有论坛里的头像徽章和「我的小咚 / 称号展示」，没有一张完整的玩家名片。
// 这是 Design V1 的新增提案：是否公开成绩由玩家自己决定，默认只公开社区身份。
const route = useRoute()
const key = computed(() => (users[route.params.name] ? route.params.name : 'mochidon'))
const u = computed(() => users[key.value])
const self = computed(() => key.value === 'mochidon')
const pub = ref(true)
const following = ref(false)
const tab = ref('scores')
const axes = computed(() => DIMS.map((d) => ({ key: d.key, label: L(d.zh, d.ja), value: player.dims[d.key] })))
const posts = computed(() => threads.filter((t) => t.author === key.value).concat(threads.slice(0, 2)).slice(0, 3))
const sel = ref(0)
</script>

<template>
  <div class="page pf">
    <header class="hero">
      <div class="don" :style="{ '--hue': u.hue }"><span>{{ u.name[0] }}</span></div>
      <div class="grow">
        <div class="row-wrap">
          <h1 class="t-h1">{{ u.name }}</h1>
          <span v-if="u.role !== 'user'" class="role" :class="u.role">{{ u.role === 'admin' ? L('站务', '運営') : L('版主', 'モデレーター') }}</span>
        </div>
        <p class="row-wrap t-small" style="margin-top: 8px">
          <span class="tag tag-roll">{{ u.title }}</span><span>{{ u.dan }}</span><span class="faint">{{ L('上海', '上海') }} · {{ L('2024 年 3 月加入', '2024年3月登録') }}</span>
        </p>
      </div>
      <div class="acts">
        <template v-if="self">
          <RouterLink to="/account" class="btn">{{ L('编辑资料', 'プロフィール編集') }}</RouterLink>
          <button class="btn" @click="toast(L('主页链接已复制', 'リンクをコピーしました'))"><Icon name="link" :size="16" />{{ L('分享', '共有') }}</button>
        </template>
        <template v-else>
          <button class="btn" :class="following ? '' : 'btn-ink'" @click="following = !following">{{ following ? L('已关注', 'フォロー中') : L('关注', 'フォロー') }}</button>
          <button class="icon-btn" :aria-label="L('更多', 'その他')"><Icon name="more" /></button>
        </template>
      </div>
    </header>

    <div v-if="self" class="privacy">
      <Icon name="eye" :size="18" />
      <span class="grow">{{ pub ? L('别人可以看到你的 Rating、六维和最好成绩。', 'Rating・6 つの力・ベスト記録が公開されています。') : L('别人只能看到你的社区身份和帖子。', 'コミュニティでの情報と投稿のみ公開されています。') }}</span>
      <div class="seg"><button :aria-pressed="pub" @click="pub = true">{{ L('公开成绩', '成績を公開') }}</button><button :aria-pressed="!pub" @click="pub = false">{{ L('只公开社区身份', '投稿のみ公開') }}</button></div>
    </div>

    <template v-if="pub">
      <div class="stats">
        <div class="stat"><div class="v">{{ player.rating.toFixed(2) }}</div><div class="k">Rating</div></div>
        <div class="stat"><div class="v">{{ player.percentile.replace('Top ', '') }}</div><div class="k">{{ L('全站前', '上位') }}</div></div>
        <div class="stat"><div class="v"><Crown :v="2" />{{ player.crownCounts.dfc }}</div><div class="k">{{ L('全良', '全良') }}</div></div>
        <div class="stat"><div class="v"><Crown :v="1" />{{ player.crownCounts.fc }}</div><div class="k">{{ L('全连', 'フルコンボ') }}</div></div>
        <div class="stat"><div class="v">{{ player.rankCounts[6] }}</div><div class="k">{{ L('极', '極') }}</div></div>
        <div class="stat"><div class="v">{{ fmt(player.plays) }}</div><div class="k">{{ L('游玩次数', 'プレイ回数') }}</div></div>
      </div>

      <div class="cols">
        <div>
          <div class="tabs" role="tablist">
            <button role="tab" :aria-selected="tab === 'scores'" @click="tab = 'scores'">{{ L('最好成绩', 'ベスト') }}</button>
            <button role="tab" :aria-selected="tab === 'recent'" @click="tab = 'recent'">{{ L('最近', '最近') }}</button>
            <button role="tab" :aria-selected="tab === 'posts'" @click="tab = 'posts'">{{ L('帖子', '投稿') }}</button>
          </div>
          <ol v-if="tab === 'scores'" class="best">
            <li v-for="(s, i) in bestList.slice(0, 8)" :key="i">
              <span class="num pos">{{ i + 1 }}</span>
              <RouterLink :to="`/songs/${s.songId}?d=${s.d}`" class="grow"><SongCell :song="songById[s.songId]" /></RouterLink>
              <Diff :d="s.d" :star="s.star" :constant="s.constant" short class="only-desktop" />
              <Crown :v="s.crown" /><Rank :v="s.rank" />
              <b class="num sc">{{ fmt(s.score) }}</b>
            </li>
          </ol>
          <div v-else-if="tab === 'recent'" class="recent"><Lane v-model="sel" :days="laneDays" /><p class="t-small">{{ L('最近 21 天有 14 天在练。', '直近 21 日のうち 14 日プレイ。') }}</p></div>
          <div v-else><ThreadRow v-for="t in posts" :key="t.id" :thread="t" compact /></div>
        </div>
        <aside class="panel radarp">
          <h2 class="t-h3">{{ L('六维', '6 つの力') }}</h2>
          <Radar :axes="axes" :size="290" />
        </aside>
      </div>
    </template>
    <template v-else>
      <div class="section"><div class="section-head"><h2 class="t-h2">{{ L('帖子', '投稿') }}</h2></div><ThreadRow v-for="t in posts" :key="t.id" :thread="t" compact /></div>
    </template>
  </div>
</template>

<style scoped>
.pf {
  max-width: 1180px;
}
.hero {
  display: flex;
  align-items: center;
  gap: 24px;
}
/* 我的小咚：鼓面头像 */
.don {
  display: grid;
  place-items: center;
  width: 104px;
  height: 104px;
  border-radius: 50%;
  background: var(--ka);
  flex: none;
}
.don span {
  display: grid;
  place-items: center;
  width: 74px;
  height: 74px;
  border-radius: 50%;
  background: hsl(var(--hue) 62% 50%);
  border: 4px solid #fff;
  color: #fff;
  font-size: var(--fs-36);
  font-weight: 900;
}
.acts {
  display: flex;
  gap: 8px;
}
.privacy {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
  padding: 10px 12px 10px 16px;
  border-radius: var(--r-panel);
  background: var(--ka-wash);
  color: var(--ka-ink);
  font-size: var(--fs-13);
  font-weight: 500;
}
.stats {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  margin: 28px 0 8px;
  padding: 20px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.stat .v {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-36);
}
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 40px;
  align-items: start;
  margin-top: 20px;
}
.best li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.pos {
  width: 18px;
  color: var(--ink-3);
}
.sc {
  width: 92px;
  text-align: right;
  font-size: var(--fs-18);
}
.recent {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
}
.radarp {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 16px;
}
.radarp h2 {
  align-self: flex-start;
}
@media (max-width: 1099px) {
  .cols {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .hero {
    flex-wrap: wrap;
    gap: 14px;
  }
  .don {
    width: 76px;
    height: 76px;
  }
  .don span {
    width: 54px;
    height: 54px;
    font-size: var(--fs-22);
    border-width: 3px;
  }
  .acts {
    width: 100%;
  }
  .acts .btn {
    flex: 1;
  }
  .privacy {
    flex-wrap: wrap;
  }
  .stats {
    grid-template-columns: repeat(3, 1fr);
    row-gap: 18px;
  }
  .stat .v {
    font-size: var(--fs-28);
  }
  .sc {
    width: auto;
  }
}
</style>
