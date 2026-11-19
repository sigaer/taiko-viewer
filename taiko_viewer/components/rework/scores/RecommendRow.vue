<script setup lang="ts">
// One recommended chart (/tools/recommend): the song (cover, title, difficulty with star) links to its detail page
// with the link the page builds; `tags` beside the difficulty, the reason in the default slot, the goal action in
// `actions` (outside the link). Ordinary recommendations pass `fit` (the API's reason fields) and get the fit scale.
import { computed, type PropType } from "vue";
import { FIT_SCALE, deviationText, fitPercent, fitPosition } from "~/utils/rework/scores";

const props = defineProps({
  songId: { type: Number, required: true },
  title: { type: String, required: true },
  level: { type: Number, required: true },
  star: { type: [Number, String] as PropType<number | string | null>, default: null },
  to: { type: [String, Object] as PropType<string | Record<string, unknown>>, required: true },
  fit: {
    type: Object as PropType<{ candidate: number; reference: number; deviation: number; inRange: boolean } | null>,
    default: null
  }
});
const { t } = useI18n();
const percent = computed(() => (props.fit ? fitPercent(props.fit.deviation) : null));
const pin = computed(() => fitPosition(percent.value));
const band = {
  left: `${fitPosition(FIT_SCALE.bandFrom)}%`,
  width: `${(fitPosition(FIT_SCALE.bandTo) ?? 0) - (fitPosition(FIT_SCALE.bandFrom) ?? 0)}%`
};
const indicator = (value: number) => (Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "—");
const starValue = computed(() => (props.star === null || props.star === "" ? null : props.star));
</script>

<template>
  <article class="rr" :data-song-id="songId" :data-difficulty="level">
    <NuxtLink :to="to" class="rr-song">
      <DsSongCell :song-id="songId" :title="title" title-lang="zh-CN" cover-size="md" />
    </NuxtLink>
    <div class="rr-meta">
      <DsDiff :difficulty="level" :star="starValue" :show-constant="false" />
      <slot name="tags" />
    </div>
    <div v-if="fit" class="rr-fit">
      <span class="rr-scale" aria-hidden="true">
        <i class="rr-band" :style="band" />
        <i v-if="pin !== null" class="rr-pin" :style="{ left: `${pin}%` }" />
      </span>
      <span class="rr-fit-text">
        <b class="num">{{ deviationText(fit.deviation) }}</b>
        <span>{{ t("rework.recommendTool.candidate") }} <span class="num">{{ indicator(fit.candidate) }}</span></span>
        <span>{{ t("rework.recommendTool.reference") }} <span class="num">{{ indicator(fit.reference) }}</span></span>
        <span v-if="fit.inRange" class="rr-in">{{ t("rework.recommendTool.inRange") }}</span>
      </span>
    </div>
    <div v-if="$slots.default" class="rr-body"><slot /></div>
    <div v-if="$slots.actions" class="rr-actions"><slot name="actions" /></div>
  </article>
</template>

<style scoped>
.rr {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "song actions"
    "meta actions"
    "fit actions"
    "body actions";
  align-items: center;
  gap: var(--sp-2) var(--sp-4);
  min-width: 0;
  padding: var(--sp-4) 0;
  border-bottom: 1px solid var(--line);
  font-family: var(--font-ui);
  color: var(--ink);
}
.rr:last-child {
  border-bottom: 0;
}
.rr-song {
  grid-area: song;
  display: block;
  min-width: 0;
  color: inherit;
  text-decoration: none;
  border-radius: var(--r-ctl);
}
.rr-song:hover :deep(.ds-songcell__title) {
  color: var(--link);
}
.rr-song:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.rr-meta {
  grid-area: meta;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  padding-left: 56px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.rr-meta :slotted(.tag) {
  padding: 0 6px;
  border-radius: var(--tag-radius);
  background: var(--tag-info-bg);
  color: var(--tag-info-ink);
  font-size: var(--fs-12);
  line-height: 20px;
}
.rr-fit {
  grid-area: fit;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2) var(--sp-3);
  padding-left: 56px;
}
.rr-scale {
  position: relative;
  flex: 0 0 120px;
  height: 8px;
  border-radius: 4px;
  background: var(--bg-sunk);
}
.rr-band {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 4px;
  background: var(--series-band-bg);
  box-shadow: inset 0 0 0 1px var(--series-band-line);
}
.rr-pin {
  position: absolute;
  top: -3px;
  width: 4px;
  height: 14px;
  margin-left: -2px;
  border-radius: 2px;
  background: var(--series);
}
.rr-fit-text {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px var(--sp-3);
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.rr-fit-text b {
  font-size: var(--fs-14);
  color: var(--ink);
}
.rr-in {
  color: var(--ok);
}
.rr-body {
  grid-area: body;
  min-width: 0;
  padding-left: 56px;
}
.rr-actions {
  grid-area: actions;
  justify-self: end;
  max-width: 100%;
  min-width: 0;
  font-size: var(--fs-14);
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .rr {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "song"
      "meta"
      "fit"
      "body"
      "actions";
  }
  .rr-actions {
    justify-self: start;
    padding-left: 56px;
  }
}
</style>
