<script setup lang="ts">
// "My score" panel of the song detail page. Shows the signed-in player's records from /api/account/songs/:id
// (fetched by the page) for the selected difficulty: crown with its name, rank with its name, score, judge bar and
// the counts the API returns; the other difficulties with a record are listed below and select that difficulty.
// Signed out → the sign-in prompt (ReworkGate) in the same card, first in the right column (first after the difficulty
// tiles below 1100 px). Accuracy, per-song RT and score history are not in the API and are not shown.
import type { PropType } from "vue";
import type { AccountSongScore } from "~/types/account-song";
import { crownFromCounts } from "~/utils/ds/crown";

const props = defineProps({
  items: { type: Array as PropType<AccountSongScore[]>, required: true },
  difficulty: { type: Number, required: true },
  star: { type: [Number, String] as PropType<number | string | null>, default: null },
  constant: { type: [Number, String] as PropType<number | string | null>, default: null },
  signedIn: { type: Boolean, required: true },
  pending: { type: Boolean, default: false },
  unavailable: { type: Boolean, default: false },
  /** login redirect for the sign-in prompt */
  redirect: { type: String, default: "" }
});
const emit = defineEmits<{ select: [difficulty: number] }>();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const selected = computed(() => props.items.filter((item) => item.level === props.difficulty));
const others = computed(() =>
  props.items.filter((item) => item.level !== props.difficulty).sort((a, b) => a.level - b.level)
);
const numberFormat = computed(() => new Intl.NumberFormat(locale.value));
const formatNumber = (value: unknown) => numberFormat.value.format(Number(value || 0));
const formatDate = (value: string) => {
  if (!value) return "—";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : value;
};
</script>

<template>
  <ReworkPanel class="mine" :class="{ 'is-guest': !signedIn }" :title="t('rework.songDetail.mine.title')">
    <template #actions>
      <DsDiff :difficulty="difficulty" :star="star" :constant="constant" />
    </template>
    <ReworkGate v-if="!signedIn" need="login" compact :title="t('rework.songDetail.mine.signIn')" :redirect="redirect" :register="false" />
    <ReworkState v-else-if="pending" kind="loading" compact :lines="3" />
    <template v-else>
      <ReworkState v-if="!selected.length" kind="empty" compact :title="unavailable ? t('rework.songDetail.mine.unavailable') : t('rework.songDetail.mine.empty')" />
      <article v-for="item in selected" :key="`${item.level}-${item.songNo}`" class="record" :data-level="item.level">
        <div class="marks">
          <DsCrown :state="crownFromCounts(item)" size="lg" text="full" />
          <DsRank :value="item.bestScoreRank" variant="detail" named />
        </div>
        <p class="score">
          <span class="rw-vh">{{ t("rework.songDetail.mine.score") }}</span><b class="num">{{ formatNumber(item.highScore) }}</b>
        </p>
        <DsJudgeBar :good="item.goodCnt" :ok="item.okCnt" :ng="item.ngCnt" />
        <dl class="tiles">
          <div><dt>{{ t("rework.songDetail.mine.plays") }}</dt><dd class="num">{{ formatNumber(item.stageCnt) }}</dd></div>
          <div><dt>{{ t("rework.songDetail.mine.clears") }}</dt><dd class="num">{{ formatNumber(item.clearCnt) }}</dd></div>
          <div><dt>{{ t("rework.songDetail.mine.fullCombos") }}</dt><dd class="num">{{ formatNumber(item.fullComboCnt) }}</dd></div>
        </dl>
        <dl class="facts">
          <div><dt>{{ t("rework.songDetail.mine.combo") }}</dt><dd class="num">{{ formatNumber(item.comboCnt) }}</dd></div>
          <div><dt>{{ t("rework.songDetail.mine.drumroll") }}</dt><dd class="num">{{ formatNumber(item.poundCnt) }}</dd></div>
          <div><dt>{{ t("rework.songDetail.mine.updated") }}</dt><dd class="num">{{ formatDate(item.highscoreDatetime || item.updateDatetime) }}</dd></div>
        </dl>
      </article>
      <ul v-if="others.length" class="others" :aria-label="t('rework.songDetail.mine.others')">
        <li v-for="item in others" :key="`${item.level}-${item.songNo}`">
          <button type="button" class="other" @click="emit('select', item.level)">
            <DsDiff :difficulty="item.level" :star="item.starLevel" :show-constant="false" />
            <DsCrown :state="crownFromCounts(item)" size="sm" text="short" />
            <DsRank :value="item.bestScoreRank" variant="compact" />
            <b class="num">{{ formatNumber(item.highScore) }}</b>
          </button>
        </li>
      </ul>
      <NuxtLink class="rw-link all" :to="localePath('/account/songs')">{{ t("rework.songDetail.mine.all") }}</NuxtLink>
    </template>
    <slot />
  </ReworkPanel>
</template>

<style scoped>
.record {
  display: grid;
  gap: var(--sp-3);
}
.record + .record {
  margin-top: var(--sp-4);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--line);
}
.marks {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-4);
}
.marks :deep(.ds-crown__text),
.marks :deep(.ds-rank__name) {
  font-size: var(--fs-14);
  font-weight: 600;
  color: var(--ink);
}
.score {
  margin: 0;
}
.record .score b {
  font-family: var(--font-display, var(--font-ui));
  font-size: var(--fs-36);
  line-height: 1.1;
  font-weight: 800;
  color: var(--emph-num);
}
.tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-2);
  margin: 0;
  text-align: center;
}
.tiles > div {
  display: flex;
  flex-direction: column-reverse;
  min-width: 0;
  padding: 9px 4px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.tiles dt {
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.tiles dd {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 800;
  color: var(--ink);
}
.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: var(--sp-3) var(--sp-4);
  margin: 0;
  padding-top: var(--sp-3);
  border-top: 1px solid var(--line);
}
.facts > div {
  display: flex;
  flex-direction: column-reverse;
  min-width: 0;
}
.facts dt {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.facts dd {
  margin: 0;
  font-size: var(--fs-16);
  line-height: 1.35;
  color: var(--ink);
}
.others {
  margin: var(--sp-4) 0 0;
  padding: var(--sp-2) 0 0;
  list-style: none;
  border-top: 1px solid var(--line);
}
.other {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  min-height: var(--hit);
  padding: 0 var(--sp-2);
  border: 0;
  border-radius: var(--r-ctl);
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-14);
  text-align: left;
  cursor: pointer;
}
.other:hover {
  background: var(--bg-sunk);
}
.other:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
.other b {
  margin-left: auto;
}
:slotted(*) {
  margin-top: var(--sp-3);
}
.all {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  margin-top: var(--sp-2);
  font-size: var(--fs-14);
}
</style>
