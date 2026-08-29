<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type {
  ChartDifficultyVoteValue,
  ChartUgcSummary,
  ViewerChartUgcState
} from "~/types/ugc";

const props = defineProps<{
  summary: ChartUgcSummary;
  viewerState: ViewerChartUgcState | null;
  difficultyLabel: string;
  authenticated: boolean;
  interactionPending: boolean;
  interactionUnavailable: boolean;
  difficultySaving: boolean;
  tagSaving: boolean;
  difficultyErrorKey: string | null;
  tagErrorKey: string | null;
}>();

const emit = defineEmits<{
  difficultyChange: [value: ChartDifficultyVoteValue | null];
  tagsChange: [slugs: string[]];
  login: [];
}>();

const { t } = useI18n();
const bucketValues = [-2, -1, 0, 1, 2] as const satisfies readonly ChartDifficultyVoteValue[];
const tagGroupOrder = ["rhythm", "technique", "stamina", "readability_speed", "structure"] as const;
const tagEditorOpen = ref(false);
const tagLimitReached = ref(false);

const distributionRows = computed(() => {
  const count = props.summary.difficulty.count;
  return bucketValues
    .map((value) => ({
      value,
      count: props.summary.difficulty.distribution[String(value) as keyof ChartUgcSummary["difficulty"]["distribution"]],
      percentage: count ? Math.round((props.summary.difficulty.distribution[String(value) as keyof ChartUgcSummary["difficulty"]["distribution"]] / count) * 100) : 0
    }))
    .filter((row) => count >= 3 || row.count > 0);
});
const summaryText = computed(() => t(`ugc.difficulty.summary.${props.summary.difficulty.summary}`));
const selectedTagSlugs = computed(() => props.viewerState?.tagSlugs || []);
const selectedTagSet = computed(() => new Set(selectedTagSlugs.value));
const activeSelectedTagSlugs = computed(() => selectedTagSlugs.value.filter((slug) =>
  props.summary.availableTags.some((tag) => tag.slug === slug)
));
const deprecatedSelections = computed(() =>
  (props.viewerState?.tagSelections || []).filter((tag) => tag.status === "deprecated")
);
const tagGroups = computed(() => tagGroupOrder.map((groupKey) => ({
  groupKey,
  tags: props.summary.availableTags.filter((tag) => tag.groupKey === groupKey)
})).filter((group) => group.tags.length));
const canWrite = computed(() => props.authenticated && Boolean(props.viewerState) && !props.interactionUnavailable);

watch(() => props.summary.chart.difficultyCode, () => {
  tagEditorOpen.value = false;
  tagLimitReached.value = false;
});

const chooseDifficulty = (value: ChartDifficultyVoteValue) => {
  if (!props.authenticated) return emit("login");
  if (!canWrite.value || props.viewerState?.difficultyVote === value) return;
  emit("difficultyChange", value);
};

const navigateDifficulty = (event: KeyboardEvent, value: ChartDifficultyVoteValue) => {
  const keyOffsets: Record<string, number> = {
    ArrowLeft: -1,
    ArrowUp: -1,
    ArrowRight: 1,
    ArrowDown: 1
  };
  const currentIndex = bucketValues.indexOf(value);
  let nextIndex = currentIndex;
  if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = bucketValues.length - 1;
  else if (event.key in keyOffsets) {
    nextIndex = (currentIndex + keyOffsets[event.key]! + bucketValues.length) % bucketValues.length;
  } else {
    return;
  }
  event.preventDefault();
  const nextValue = bucketValues[nextIndex]!;
  const choices = (event.currentTarget as HTMLElement).parentElement
    ?.querySelectorAll<HTMLButtonElement>("[role='radio']");
  choices?.[nextIndex]?.focus();
  chooseDifficulty(nextValue);
};

const clearDifficulty = () => {
  if (!canWrite.value || props.viewerState?.difficultyVote === null) return;
  emit("difficultyChange", null);
};

const openTagEditor = () => {
  if (!props.authenticated) return emit("login");
  if (!canWrite.value) return;
  tagEditorOpen.value = !tagEditorOpen.value;
  tagLimitReached.value = false;
};

const toggleTag = (slug: string) => {
  if (!canWrite.value) return;
  const next = new Set(selectedTagSlugs.value.filter((selected) =>
    props.summary.availableTags.some((tag) => tag.slug === selected)
  ));
  if (next.has(slug)) {
    next.delete(slug);
    tagLimitReached.value = false;
  } else {
    if (next.size >= 5) {
      tagLimitReached.value = true;
      return;
    }
    next.add(slug);
    tagLimitReached.value = false;
  }
  emit("tagsChange", [...next]);
};

const removeDeprecatedTag = (slug: string) => {
  if (!canWrite.value) return;
  emit("tagsChange", selectedTagSlugs.value.filter((selected) => selected !== slug));
};
</script>

<template>
  <section class="chart-ugc-section" aria-labelledby="chart-ugc-title">
    <header class="chart-ugc-head">
      <div>
        <span class="chart-ugc-eyebrow">PLAYER NOTES</span>
        <h3 id="chart-ugc-title">{{ t("ugc.sectionTitle") }}</h3>
      </div>
      <span class="chart-ugc-difficulty">{{ difficultyLabel }}</span>
    </header>

    <div class="chart-ugc-grid">
      <section class="ugc-panel ugc-panel--difficulty" aria-labelledby="chart-ugc-difficulty-title">
        <h4 id="chart-ugc-difficulty-title">{{ t("ugc.difficulty.title") }}</h4>
        <template v-if="summary.difficulty.count">
          <p class="ugc-summary-line">
            <strong>{{ summaryText }}</strong>
            <span>{{ t("ugc.difficulty.count", { count: summary.difficulty.count }) }}</span>
            <span v-if="summary.difficulty.verifiedCount">
              {{ t("ugc.difficulty.verifiedCount", { count: summary.difficulty.verifiedCount }) }}
            </span>
          </p>
          <ul class="ugc-distribution" :aria-label="t('ugc.difficulty.distributionLabel')">
            <li v-for="row in distributionRows" :key="row.value">
              <span class="ugc-distribution__label">{{ t(`ugc.difficulty.buckets.${row.value}`) }}</span>
              <span class="ugc-distribution__bar" aria-hidden="true">
                <span :style="{ width: `${row.percentage}%` }"></span>
              </span>
              <strong>{{ t("ugc.difficulty.votes", { count: row.count }) }}</strong>
            </li>
          </ul>
        </template>
        <p v-else class="ugc-cold-copy">{{ t("ugc.difficulty.empty") }}</p>

        <ClientOnly>
          <div class="ugc-contribution" :aria-busy="difficultySaving">
            <div
              class="ugc-difficulty-choices"
              role="radiogroup"
              :aria-label="t('ugc.difficulty.choose')"
              :aria-describedby="difficultyErrorKey ? 'ugc-difficulty-error' : undefined"
            >
              <button
                v-for="value in bucketValues"
                :key="value"
                type="button"
                role="radio"
                class="ugc-choice"
                :class="{ 'is-selected': viewerState?.difficultyVote === value }"
                :aria-checked="viewerState?.difficultyVote === value"
                :tabindex="viewerState?.difficultyVote === value || (viewerState?.difficultyVote == null && value === bucketValues[0]) ? 0 : -1"
                :disabled="authenticated && (!canWrite || interactionPending)"
                @click="chooseDifficulty(value)"
                @keydown="navigateDifficulty($event, value)"
              >
                <span v-if="viewerState?.difficultyVote === value" aria-hidden="true">✓</span>
                {{ t(`ugc.difficulty.buckets.${value}`) }}
              </button>
            </div>
            <div class="ugc-control-meta">
              <span v-if="difficultySaving" role="status">{{ t("ugc.saving") }}</span>
              <span v-else-if="interactionUnavailable">{{ t("ugc.interactionUnavailable") }}</span>
              <button
                v-if="viewerState?.difficultyVote !== null && viewerState"
                type="button"
                class="ugc-clear"
                :disabled="difficultySaving"
                @click="clearDifficulty"
              >
                {{ t("ugc.clear") }}
              </button>
            </div>
            <p v-if="difficultyErrorKey" id="ugc-difficulty-error" class="ugc-inline-error" role="alert">
              {{ t(difficultyErrorKey) }}
            </p>
          </div>
        </ClientOnly>
      </section>

      <section class="ugc-panel ugc-panel--tags" aria-labelledby="chart-ugc-tags-title">
        <h4 id="chart-ugc-tags-title">{{ t("ugc.tagsTitle") }}</h4>
        <ul v-if="summary.tags.length" class="ugc-tags ugc-tags--public">
          <li v-for="tag in summary.tags" :key="tag.slug">
            <span>{{ t(tag.labelKey) }}</span>
            <small>{{ t("ugc.tagVotes", { count: tag.count }) }}</small>
          </li>
        </ul>
        <p v-else class="ugc-cold-copy">{{ t("ugc.tagsEmpty") }}</p>

        <ClientOnly>
          <div class="ugc-contribution" :aria-busy="tagSaving">
            <button
              type="button"
              class="ugc-tag-editor-toggle"
              :aria-expanded="tagEditorOpen"
              aria-controls="ugc-tag-editor"
              :disabled="authenticated && (!canWrite || interactionPending)"
              @click="openTagEditor"
            >
              {{ selectedTagSlugs.length ? t("ugc.editTags") : t("ugc.addTags") }}
            </button>

            <div v-show="tagEditorOpen" id="ugc-tag-editor" class="ugc-tag-editor">
              <div v-for="group in tagGroups" :key="group.groupKey" class="ugc-tag-group">
                <h5>{{ t(`ugc.tagGroups.${group.groupKey}`) }}</h5>
                <div class="ugc-tag-options">
                  <button
                    v-for="tag in group.tags"
                    :key="tag.slug"
                    type="button"
                    class="ugc-tag-option"
                    :class="{ 'is-selected': selectedTagSet.has(tag.slug) }"
                    :aria-pressed="selectedTagSet.has(tag.slug)"
                    @click="toggleTag(tag.slug)"
                  >
                    <span v-if="selectedTagSet.has(tag.slug)" aria-hidden="true">✓</span>
                    {{ t(tag.labelKey) }}
                  </button>
                </div>
              </div>

              <div v-if="deprecatedSelections.length" class="ugc-deprecated-tags">
                <span>{{ t("ugc.deprecatedTags") }}</span>
                <button
                  v-for="tag in deprecatedSelections"
                  :key="tag.slug"
                  type="button"
                  @click="removeDeprecatedTag(tag.slug)"
                >
                  {{ t(tag.labelKey) }} · {{ t("ugc.remove") }}
                </button>
              </div>

              <div class="ugc-tag-editor__footer">
                <span>{{ t("ugc.selectedTags", { count: activeSelectedTagSlugs.length }) }}</span>
                <button type="button" class="ugc-tag-done" @click="tagEditorOpen = false">
                  {{ t("ugc.done") }}
                </button>
              </div>
              <p v-if="tagLimitReached" class="ugc-inline-error" role="status" aria-live="polite">
                {{ t("ugc.tagLimit") }}
              </p>
            </div>
            <div class="ugc-control-meta">
              <span v-if="tagSaving" role="status">{{ t("ugc.saving") }}</span>
              <span v-else-if="interactionUnavailable">{{ t("ugc.interactionUnavailable") }}</span>
            </div>
            <p v-if="tagErrorKey" class="ugc-inline-error" role="alert">{{ t(tagErrorKey) }}</p>
          </div>
        </ClientOnly>
      </section>

      <section v-if="summary.tips.length" class="ugc-panel ugc-panel--tips" aria-labelledby="chart-ugc-tips-title">
        <h4 id="chart-ugc-tips-title">{{ t("ugc.tipsTitle") }}</h4>
        <div class="ugc-tips">
          <article v-for="tip in summary.tips" :key="tip.tipId" class="ugc-tip">
            <p>{{ tip.body }}</p>
            <footer>
              <span class="ugc-tip__author">
                <img :src="tip.author.avatarUrl" alt="" width="24" height="24" />
                <span>{{ tip.author.isDeleted ? t("ugc.deletedUser") : tip.author.displayName }}</span>
              </span>
              <span v-if="tip.verifiedPlay" class="ugc-tip__verified">{{ t("ugc.verifiedPlay") }}</span>
              <span>{{ t("ugc.helpfulCount", { count: tip.helpfulCount }) }}</span>
            </footer>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.chart-ugc-section { margin-top: 28px; padding-top: 24px; border-top: 1px solid rgba(139, 107, 77, 0.2); }
.chart-ugc-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.chart-ugc-eyebrow { color: #9b7459; font-size: 10px; font-weight: 800; letter-spacing: 0.18em; }
.chart-ugc-head h3 { margin: 2px 0 0; color: #49382d; font-size: 21px; line-height: 1.25; }
.chart-ugc-difficulty { flex-shrink: 0; border-radius: 999px; padding: 5px 10px; color: #76533c; background: rgba(196, 164, 132, 0.16); font-size: 12px; font-weight: 750; }
.chart-ugc-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.ugc-panel { min-width: 0; border: 1px solid rgba(139, 107, 77, 0.16); border-radius: 15px; padding: 15px; background: rgba(250, 248, 244, 0.82); }
.ugc-panel--tips { grid-column: 1 / -1; }
.ugc-panel h4 { margin: 0 0 11px; color: #5a4435; font-size: 15px; }
.ugc-summary-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin: 0 0 12px; color: #776659; font-size: 12px; }
.ugc-summary-line strong { color: #4b382d; font-size: 14px; }
.ugc-cold-copy { margin: 0; color: #776659; font-size: 13px; line-height: 1.6; }
.ugc-distribution, .ugc-tags { margin: 0; padding: 0; list-style: none; }
.ugc-distribution { display: grid; gap: 8px; }
.ugc-distribution li { display: grid; grid-template-columns: minmax(72px, auto) minmax(54px, 1fr) auto; align-items: center; gap: 8px; color: #6f5d50; font-size: 11px; }
.ugc-distribution__bar { height: 6px; overflow: hidden; border-radius: 999px; background: rgba(139, 107, 77, 0.12); }
.ugc-distribution__bar span { display: block; min-width: 2px; height: 100%; border-radius: inherit; background: #bd7957; }
.ugc-distribution li strong { color: #59483d; font-variant-numeric: tabular-nums; }
.ugc-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.ugc-tags li { display: inline-flex; align-items: baseline; gap: 6px; border: 1px solid rgba(119, 88, 61, 0.16); border-radius: 999px; padding: 6px 9px; color: #5c4838; background: #fff; font-size: 12px; font-weight: 700; }
.ugc-tags small { color: #8b7767; font-size: 10px; font-weight: 600; }
.ugc-contribution { margin-top: 14px; padding-top: 13px; border-top: 1px dashed rgba(139, 107, 77, 0.18); }
.ugc-difficulty-choices { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.ugc-choice, .ugc-tag-option, .ugc-tag-editor-toggle, .ugc-tag-done, .ugc-deprecated-tags button { min-height: 44px; border: 1px solid rgba(119, 88, 61, 0.24); border-radius: 11px; color: #5c4838; background: #fff; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; touch-action: manipulation; transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease; }
.ugc-choice { padding: 7px 5px; font-size: 13px; }
.ugc-choice:hover, .ugc-tag-option:hover, .ugc-tag-editor-toggle:hover { border-color: rgba(180, 106, 70, 0.55); }
.ugc-choice:focus-visible, .ugc-tag-option:focus-visible, .ugc-tag-editor-toggle:focus-visible, .ugc-tag-done:focus-visible, .ugc-clear:focus-visible, .ugc-deprecated-tags button:focus-visible { outline: 3px solid rgba(56, 121, 191, 0.42); outline-offset: 2px; }
.ugc-choice.is-selected, .ugc-tag-option.is-selected { border-color: #a95837; color: #73351f; background: #f9dfd3; box-shadow: inset 0 0 0 1px rgba(169, 88, 55, 0.18); }
.ugc-choice:disabled, .ugc-tag-editor-toggle:disabled, .ugc-clear:disabled { cursor: not-allowed; opacity: 0.48; }
.ugc-control-meta { min-height: 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 7px; color: #806d5f; font-size: 11px; }
.ugc-clear { min-height: 44px; border: 0; padding: 4px 6px; color: #8a6651; background: transparent; cursor: pointer; font: inherit; font-size: 11px; text-decoration: underline; text-underline-offset: 3px; }
.ugc-inline-error { margin: 6px 0 0; color: #a33c32; font-size: 12px; line-height: 1.45; }
.ugc-tag-editor-toggle { width: 100%; padding: 8px 14px; }
.ugc-tag-editor { display: grid; gap: 12px; margin-top: 12px; }
.ugc-tag-group h5 { margin: 0 0 7px; color: #766052; font-size: 11px; }
.ugc-tag-options { display: flex; flex-wrap: wrap; gap: 8px; }
.ugc-tag-option { min-height: 44px; border-radius: 999px; padding: 6px 11px; }
.ugc-tag-editor__footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #776659; font-size: 12px; }
.ugc-tag-done { min-width: 88px; padding: 7px 14px; color: #fff; background: #8e5539; border-color: #8e5539; }
.ugc-deprecated-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: #806d5f; font-size: 11px; }
.ugc-deprecated-tags button { min-height: 36px; padding: 5px 9px; border-style: dashed; color: #806d5f; background: transparent; font-size: 11px; }
.ugc-tips { display: grid; gap: 9px; }
.ugc-tip { min-width: 0; border-left: 3px solid rgba(189, 121, 87, 0.46); padding: 9px 11px; background: rgba(255, 255, 255, 0.72); }
.ugc-tip p { margin: 0; color: #493a31; font-size: 13px; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.ugc-tip footer { display: flex; flex-wrap: wrap; align-items: center; gap: 7px 12px; margin-top: 8px; color: #7b695c; font-size: 11px; }
.ugc-tip__author { display: inline-flex; align-items: center; gap: 6px; color: #5d4b3e; font-weight: 700; }
.ugc-tip__author img { border-radius: 50%; object-fit: cover; }
.ugc-tip__verified { color: #5c7158; font-weight: 700; }
:global(body.theme-dark .chart-ugc-head h3), :global(body.theme-dark .ugc-panel h4), :global(body.theme-dark .ugc-summary-line strong), :global(body.theme-dark .ugc-tip p) { color: #f1e6dc; }
:global(body.theme-dark .ugc-panel) { border-color: rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.04); }
:global(body.theme-dark .ugc-tip), :global(body.theme-dark .ugc-tags li), :global(body.theme-dark .ugc-choice), :global(body.theme-dark .ugc-tag-option), :global(body.theme-dark .ugc-tag-editor-toggle) { color: #eadbcf; background: rgba(255, 255, 255, 0.065); }
:global(body.theme-dark .ugc-choice.is-selected), :global(body.theme-dark .ugc-tag-option.is-selected) { border-color: #e29a78; color: #fff4ec; background: #71402d; box-shadow: inset 0 0 0 1px rgba(255, 226, 210, 0.34); }
:global(body.theme-dark .ugc-summary-line), :global(body.theme-dark .ugc-cold-copy), :global(body.theme-dark .ugc-distribution li), :global(body.theme-dark .ugc-tip footer), :global(body.theme-dark .ugc-tip__author), :global(body.theme-dark .ugc-tags small), :global(body.theme-dark .ugc-control-meta), :global(body.theme-dark .ugc-tag-group h5), :global(body.theme-dark .ugc-tag-editor__footer) { color: #cbbbae; }
:global(body.theme-dark .ugc-inline-error) { color: #ffaaa1; }
:global(body.theme-dark .ugc-clear), :global(body.theme-dark .ugc-deprecated-tags), :global(body.theme-dark .ugc-deprecated-tags button) { color: #d8b8a6; }
:global(body.theme-dark .ugc-choice:disabled), :global(body.theme-dark .ugc-tag-editor-toggle:disabled), :global(body.theme-dark .ugc-clear:disabled) { opacity: 0.6; }
:global(body.theme-dark .ugc-tag-done) { color: #1e120d; background: #efb091; border-color: #efb091; }
@media (max-width: 700px) {
  .chart-ugc-section { margin-top: 22px; padding-top: 20px; }
  .chart-ugc-head { align-items: center; }
  .chart-ugc-grid { grid-template-columns: 1fr; }
  .ugc-panel--tips { grid-column: auto; }
  .ugc-distribution li { grid-template-columns: minmax(70px, auto) minmax(40px, 1fr) auto; }
  .ugc-difficulty-choices { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ugc-choice:last-child { grid-column: 1 / -1; }
}
@media (prefers-reduced-motion: reduce) {
  .ugc-choice, .ugc-tag-option, .ugc-tag-editor-toggle, .ugc-tag-done { transition: none; }
}
</style>
