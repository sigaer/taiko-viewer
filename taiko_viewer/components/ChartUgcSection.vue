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
  tipSaving: boolean;
  tipErrorKey: string | null;
  helpfulSavingById: Record<string, boolean>;
  helpfulErrorById: Record<string, string | null>;
  reportSavingById: Record<string, boolean>;
  reportErrorById: Record<string, string | null>;
  reportSuccessById: Record<string, boolean>;
  appearance?: "song-detail";
}>();

const emit = defineEmits<{
  difficultyChange: [value: ChartDifficultyVoteValue | null];
  tagsChange: [slugs: string[]];
  login: [];
  tipSave: [body: string];
  tipDelete: [];
  helpfulChange: [tipId: string, enabled: boolean];
  report: [tipId: string, reason: string];
}>();

const { t } = useI18n();
const bucketValues = [-2, -1, 0, 1, 2] as const satisfies readonly ChartDifficultyVoteValue[];
const tagGroupOrder = ["rhythm", "technique", "stamina", "readability_speed", "structure"] as const;
const tagEditorOpen = ref(false);
const tagLimitReached = ref(false);
const tipEditorOpen = ref(false);
const tipBody = ref("");
const reportTipId = ref<string | null>(null);
const reportReason = ref("other");
const tipBodyLength = computed(() => Array.from(tipBody.value).length);
const myTip = computed(() => props.viewerState?.tip || null);
const helpfulSet = computed(() => new Set(props.viewerState?.helpfulTipIds || []));
const canTipWrite = computed(() => props.authenticated && Boolean(props.viewerState) && !props.interactionUnavailable);

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
  tipEditorOpen.value = false;
});
watch(() => myTip.value?.body, (body) => {
  if (body && tipEditorOpen.value && body === tipBody.value && !props.tipSaving) tipEditorOpen.value = false;
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

const openTipEditor = () => {
  if (!props.authenticated) return emit("login");
  if (!canTipWrite.value || myTip.value?.status === "hidden") return;
  tipBody.value = myTip.value?.body || "";
  tipEditorOpen.value = true;
};
const cancelTipEditor = () => { tipEditorOpen.value = false; };
const saveTip = () => {
  if (!tipBody.value.trim() || tipBodyLength.value > 120 || props.tipSaving) return;
  emit("tipSave", tipBody.value);
};
const deleteTip = () => {
  if (typeof window !== "undefined" && !window.confirm(t("ugc.tip.deleteConfirm"))) return;
  emit("tipDelete");
};
const toggleHelpful = (tipId: string) => {
  if (!props.authenticated) return emit("login");
  emit("helpfulChange", tipId, !helpfulSet.value.has(tipId));
};
const openReport = (tipId: string) => {
  if (!props.authenticated) return emit("login");
  reportTipId.value = tipId;
};
const submitReport = () => {
  if (!reportTipId.value) return;
  emit("report", reportTipId.value, reportReason.value);
};
watch(() => reportTipId.value ? props.reportSuccessById[reportTipId.value] : false, (success) => {
  if (success) reportTipId.value = null;
});
</script>

<template>
  <section id="chart-ugc" class="chart-ugc-section" :class="{ 'chart-ugc-section--song-detail': appearance === 'song-detail' }" aria-labelledby="chart-ugc-title">
    <header class="chart-ugc-head">
      <div>
        <span v-if="appearance !== 'song-detail'" class="chart-ugc-eyebrow">PLAYER NOTES</span>
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

      <section class="ugc-panel ugc-panel--tips" aria-labelledby="chart-ugc-tips-title">
        <h4 id="chart-ugc-tips-title">{{ t("ugc.tipsTitle") }}</h4>
        <p v-if="!summary.tips.length" class="ugc-cold-copy">{{ t("ugc.tipsEmpty") }}</p>
        <div v-else class="ugc-tips">
          <article v-for="tip in summary.tips" :key="tip.tipId" class="ugc-tip">
            <p>{{ tip.body }}</p>
            <footer>
              <span class="ugc-tip__author">
                <img :src="tip.author.avatarUrl" alt="" width="24" height="24" />
                <span>{{ tip.author.isDeleted ? t("ugc.deletedUser") : tip.author.displayName }}</span>
              </span>
              <span v-if="tip.verifiedPlay" class="ugc-tip__verified">{{ t("ugc.verifiedPlay") }}</span>
              <button type="button" class="ugc-helpful" :class="{ 'is-selected': helpfulSet.has(tip.tipId) }" :aria-pressed="helpfulSet.has(tip.tipId)" :disabled="Boolean(props.helpfulSavingById[tip.tipId])" @click="toggleHelpful(tip.tipId)">
                <span aria-hidden="true">{{ helpfulSet.has(tip.tipId) ? "✓" : "♡" }}</span>
                {{ t("ugc.helpfulCount", { count: tip.helpfulCount }) }}
              </button>
              <span v-if="props.helpfulErrorById[tip.tipId]" class="ugc-inline-error">{{ t(props.helpfulErrorById[tip.tipId] || "ugc.helpfulError") }}</span>
              <button type="button" class="ugc-report-trigger" @click="openReport(tip.tipId)">{{ t("ugc.report") }}</button>
            </footer>
          </article>
        </div>
        <div class="ugc-tip-actions">
          <button type="button" class="ugc-tip-primary" :disabled="myTip?.status === 'hidden' || (authenticated && (!canTipWrite || interactionPending))" @click="openTipEditor">
            {{ myTip?.status === "active" || myTip?.status === "hidden" ? t("ugc.editTip") : t("ugc.leaveTip") }}
          </button>
          <button v-if="myTip?.status === 'active'" type="button" class="ugc-tip-delete" :disabled="tipSaving" @click="deleteTip">{{ t("ugc.deleteTip") }}</button>
        </div>
        <p v-if="myTip?.status === 'hidden'" class="ugc-tip-status">{{ t("ugc.tip.hidden") }}</p>
        <div v-if="tipEditorOpen" class="ugc-tip-editor">
          <label for="ugc-tip-body">{{ t("ugc.tip.label") }}</label>
          <textarea id="ugc-tip-body" v-model="tipBody" rows="3" maxlength="120" :aria-describedby="tipErrorKey ? 'ugc-tip-error' : 'ugc-tip-count'"></textarea>
          <div id="ugc-tip-count" class="ugc-tip-editor__meta"><span>{{ t("ugc.tip.remaining", { count: Math.max(0, 120 - tipBodyLength) }) }}</span><span>{{ tipBodyLength }} / 120</span></div>
          <div class="ugc-tip-editor__actions">
            <button type="button" class="ugc-tip-primary" :disabled="tipSaving || !tipBody.trim() || tipBodyLength > 120" @click="saveTip">{{ t("ugc.save") }}</button>
            <button type="button" class="ugc-tip-secondary" :disabled="tipSaving" @click="cancelTipEditor">{{ t("ugc.cancel") }}</button>
          </div>
          <p v-if="tipErrorKey" id="ugc-tip-error" class="ugc-inline-error" role="alert">{{ t(tipErrorKey) }}</p>
        </div>
        <div v-if="reportTipId" class="ugc-report-editor">
          <label for="ugc-report-reason">{{ t("ugc.reportReason") }}</label>
          <select id="ugc-report-reason" v-model="reportReason">
            <option value="spam">{{ t("ugc.reportReasons.spam") }}</option><option value="abuse">{{ t("ugc.reportReasons.abuse") }}</option><option value="advertising">{{ t("ugc.reportReasons.advertising") }}</option><option value="link">{{ t("ugc.reportReasons.link") }}</option><option value="duplicate">{{ t("ugc.reportReasons.duplicate") }}</option><option value="other">{{ t("ugc.reportReasons.other") }}</option>
          </select>
          <div class="ugc-tip-editor__actions"><button type="button" class="ugc-tip-primary" :disabled="Boolean(props.reportSavingById[reportTipId])" @click="submitReport">{{ t("ugc.submitReport") }}</button><button type="button" class="ugc-tip-secondary" @click="reportTipId = null">{{ t("ugc.cancel") }}</button></div>
          <p v-if="props.reportErrorById[reportTipId]" class="ugc-inline-error" role="alert">{{ t(props.reportErrorById[reportTipId] || "ugc.reportError") }}</p>
        </div>
        <p v-if="Object.values(props.reportSuccessById).some(Boolean)" class="ugc-report-success" role="status">{{ t("ugc.reportSuccess") }}</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.chart-ugc-section { margin-top: 28px; padding-top: 24px; border-top: 1px solid var(--viewer-border); }
.chart-ugc-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.chart-ugc-eyebrow { color:var(--viewer-text-muted); font-size: 10px; font-weight: 800; letter-spacing: 0.18em; }
.chart-ugc-head h3 { margin: 2px 0 0; color:var(--viewer-text); font-size: 21px; line-height: 1.25; }
.chart-ugc-difficulty { flex-shrink: 0; border-radius: 999px; padding: 5px 10px; color:var(--viewer-text-muted); background:var(--viewer-surface-subtle); font-size: 12px; font-weight: 750; }
.chart-ugc-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.ugc-panel { min-width: 0; border: 1px solid var(--viewer-border); border-radius: 15px; padding: 15px; background:var(--viewer-surface-subtle); }
.ugc-panel--tips { grid-column: 1 / -1; }
.ugc-panel h4 { margin: 0 0 11px; color:var(--viewer-text); font-size: 15px; }
.ugc-summary-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin: 0 0 12px; color:var(--viewer-text-muted); font-size: 12px; }
.ugc-summary-line strong { color:var(--viewer-text); font-size: 14px; }
.ugc-cold-copy { margin: 0; color:var(--viewer-text-muted); font-size: 13px; line-height: 1.6; }
.ugc-distribution, .ugc-tags { margin: 0; padding: 0; list-style: none; }
.ugc-distribution { display: grid; gap: 8px; }
.ugc-distribution li { display: grid; grid-template-columns: minmax(72px, auto) minmax(54px, 1fr) auto; align-items: center; gap: 8px; color:var(--viewer-text-muted); font-size: 11px; }
.ugc-distribution__bar { height: 6px; overflow: hidden; border-radius: 999px; background:var(--viewer-border); }
.ugc-distribution__bar span { display: block; min-width: 2px; height: 100%; border-radius: inherit; background:var(--viewer-primary); }
.ugc-distribution li strong { color:var(--viewer-text); font-variant-numeric: tabular-nums; }
.ugc-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.ugc-tags li { display: inline-flex; align-items: baseline; gap: 6px; border: 1px solid var(--viewer-border); border-radius: 999px; padding: 6px 9px; color:var(--viewer-text); background:var(--viewer-surface); font-size: 12px; font-weight: 700; }
.ugc-tags small { color:var(--viewer-text-muted); font-size: 10px; font-weight: 600; }
.ugc-contribution { margin-top: 14px; padding-top: 13px; border-top: 1px dashed var(--viewer-border); }
.ugc-difficulty-choices { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.ugc-choice, .ugc-tag-option, .ugc-tag-editor-toggle, .ugc-tag-done, .ugc-deprecated-tags button { min-height: 44px; border: 1px solid var(--viewer-border); border-radius: 11px; color:var(--viewer-text); background:var(--viewer-surface); cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; touch-action: manipulation; transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease; }
.ugc-choice { padding: 7px 5px; font-size: 13px; }
.ugc-choice:hover, .ugc-tag-option:hover, .ugc-tag-editor-toggle:hover { border-color:var(--viewer-border); }
.ugc-choice:focus-visible, .ugc-tag-option:focus-visible, .ugc-tag-editor-toggle:focus-visible, .ugc-tag-done:focus-visible, .ugc-clear:focus-visible, .ugc-deprecated-tags button:focus-visible { outline: 3px solid var(--viewer-link); outline-offset: 2px; }
.ugc-choice.is-selected, .ugc-tag-option.is-selected { border-color:var(--viewer-primary); color:var(--viewer-primary); background:var(--viewer-selected); box-shadow:inset 0 0 0 1px var(--viewer-shadow); }
.ugc-choice:disabled, .ugc-tag-editor-toggle:disabled, .ugc-clear:disabled { cursor: not-allowed; opacity: 0.48; }
.ugc-control-meta { min-height: 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 7px; color:var(--viewer-text-muted); font-size: 11px; }
.ugc-clear { min-height: 44px; border: 0; padding: 4px 6px; color:var(--viewer-link); background:transparent; cursor: pointer; font: inherit; font-size: 11px; text-decoration: underline; text-underline-offset: 3px; }
.ugc-inline-error { margin: 6px 0 0; color:var(--viewer-error); font-size: 12px; line-height: 1.45; }
.ugc-tag-editor-toggle { width: 100%; padding: 8px 14px; }
.ugc-tag-editor { display: grid; gap: 12px; margin-top: 12px; }
.ugc-tag-group h5 { margin: 0 0 7px; color:var(--viewer-text-muted); font-size: 11px; }
.ugc-tag-options { display: flex; flex-wrap: wrap; gap: 8px; }
.ugc-tag-option { min-height: 44px; border-radius: 999px; padding: 6px 11px; }
.ugc-tag-editor__footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; color:var(--viewer-text-muted); font-size: 12px; }
.ugc-tag-done { min-width: 88px; padding: 7px 14px; color:var(--viewer-on-primary); background:var(--viewer-primary); border-color:var(--viewer-primary); }
.ugc-deprecated-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color:var(--viewer-text-muted); font-size: 11px; }
.ugc-deprecated-tags button { min-height: 36px; padding: 5px 9px; border-style: dashed; color:var(--viewer-text-muted); background:transparent; font-size: 11px; }
.ugc-tips { display: grid; gap: 9px; }
.ugc-tip { min-width: 0; border-left: 3px solid var(--viewer-border); padding: 9px 11px; background:var(--viewer-surface-subtle); }
.ugc-tip p { margin: 0; color:var(--viewer-text); font-size: 13px; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.ugc-tip footer { display: flex; flex-wrap: wrap; align-items: center; gap: 7px 12px; margin-top: 8px; color:var(--viewer-text-muted); font-size: 11px; }
.ugc-helpful, .ugc-report-trigger, .ugc-tip-primary, .ugc-tip-secondary, .ugc-tip-delete { min-height: 36px; border: 1px solid transparent; border-radius: 9px; padding: 5px 9px; font: inherit; font-size: 11px; cursor: pointer; }
.ugc-helpful { color:var(--viewer-text); background:var(--viewer-border); }
.ugc-helpful.is-selected { border-color:var(--viewer-primary); color:var(--viewer-primary); background:var(--viewer-selected); font-weight: 800; }
.ugc-helpful:disabled { opacity: .55; cursor: wait; }
.ugc-report-trigger, .ugc-tip-delete { color:var(--viewer-link); background:transparent; text-decoration: underline; text-underline-offset: 3px; }
.ugc-tip-actions, .ugc-tip-editor__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
.ugc-tip-primary { color:var(--viewer-on-primary); background:var(--viewer-primary); border-color:var(--viewer-primary); }
.ugc-tip-secondary { color:var(--viewer-text-muted); border-color:var(--viewer-border); background:transparent; }
.ugc-tip-primary:disabled, .ugc-tip-secondary:disabled, .ugc-tip-delete:disabled { opacity: .5; cursor: not-allowed; }
.ugc-tip-editor, .ugc-report-editor { display: grid; gap: 7px; margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--viewer-border); }
.ugc-tip-editor label, .ugc-report-editor label { color:var(--viewer-text); font-size: 12px; font-weight: 700; }
.ugc-tip-editor textarea, .ugc-report-editor select { width: 100%; box-sizing: border-box; border: 1px solid var(--viewer-border); border-radius: 9px; padding: 9px; color:var(--viewer-text); background:var(--viewer-surface); font: inherit; font-size: 13px; line-height: 1.55; }
.ugc-tip-editor__meta { display: flex; justify-content: space-between; color:var(--viewer-text-muted); font-size: 11px; }
.ugc-tip-status { margin: 10px 0 0; color:var(--viewer-link); font-size: 12px; }
.ugc-report-success { margin: 9px 0 0; color:var(--viewer-success); font-size: 12px; font-weight: 700; }
.ugc-tip__author { display: inline-flex; align-items: center; gap: 6px; color:var(--viewer-text); font-weight: 700; }
.ugc-tip__author img { border-radius: 50%; object-fit: cover; }
.ugc-tip__verified { color:var(--viewer-success); font-weight: 700; }
:global(body.theme-dark .chart-ugc-head h3), :global(body.theme-dark .ugc-panel h4), :global(body.theme-dark .ugc-summary-line strong), :global(body.theme-dark .ugc-tip p) { color:var(--viewer-text); }
:global(body.theme-dark .ugc-panel) { border-color:var(--viewer-border); background:var(--viewer-surface-subtle); }
:global(body.theme-dark .ugc-tip), :global(body.theme-dark .ugc-tags li), :global(body.theme-dark .ugc-choice), :global(body.theme-dark .ugc-tag-option), :global(body.theme-dark .ugc-tag-editor-toggle) { color:var(--viewer-text); background:var(--viewer-surface-subtle); }
:global(body.theme-dark .ugc-choice.is-selected), :global(body.theme-dark .ugc-tag-option.is-selected) { border-color:var(--viewer-primary); color:var(--viewer-primary); background:var(--viewer-selected); box-shadow:inset 0 0 0 1px var(--viewer-shadow); }
:global(body.theme-dark .ugc-summary-line), :global(body.theme-dark .ugc-cold-copy), :global(body.theme-dark .ugc-distribution li), :global(body.theme-dark .ugc-tip footer), :global(body.theme-dark .ugc-tip__author), :global(body.theme-dark .ugc-tags small), :global(body.theme-dark .ugc-control-meta), :global(body.theme-dark .ugc-tag-group h5), :global(body.theme-dark .ugc-tag-editor__footer) { color:var(--viewer-text-muted); }
:global(body.theme-dark .ugc-inline-error) { color:var(--viewer-error); }
:global(body.theme-dark .ugc-helpful) { color:var(--viewer-link); background:var(--viewer-surface-subtle); }
:global(body.theme-dark .ugc-helpful.is-selected) { color:var(--viewer-primary); background:var(--viewer-selected); }
:global(body.theme-dark .ugc-tip-editor label), :global(body.theme-dark .ugc-report-editor label) { color:var(--viewer-text); }
:global(body.theme-dark .ugc-tip-editor textarea), :global(body.theme-dark .ugc-report-editor select) { color:var(--viewer-text); background:var(--viewer-surface-subtle); border-color:var(--viewer-border); }
:global(body.theme-dark .ugc-tip-editor__meta), :global(body.theme-dark .ugc-tip-secondary) { color:var(--viewer-text-muted); }
:global(body.theme-dark .ugc-report-success) { color:var(--viewer-success); }
:global(body.theme-dark .ugc-clear), :global(body.theme-dark .ugc-deprecated-tags), :global(body.theme-dark .ugc-deprecated-tags button) { color:var(--viewer-link); }
:global(body.theme-dark .ugc-choice:disabled), :global(body.theme-dark .ugc-tag-editor-toggle:disabled), :global(body.theme-dark .ugc-clear:disabled) { opacity: 0.6; }
:global(body.theme-dark .ugc-tag-done) { color:var(--viewer-on-primary); background:var(--viewer-primary); border-color:var(--viewer-primary); }
@media (max-width: 700px) {
  .chart-ugc-section { margin-top: 22px; padding-top: 20px; }
  .chart-ugc-head { align-items: center; }
  .chart-ugc-grid { grid-template-columns: 1fr; }
  .ugc-panel--tips { grid-column: auto; }
  .ugc-distribution li { grid-template-columns: minmax(70px, auto) minmax(40px, 1fr) auto; }
  .ugc-difficulty-choices { display:flex;flex-wrap:wrap; }
  .ugc-difficulty-choices .ugc-choice { flex:0 0 calc((100% - 16px) / 3); }
}
@media (prefers-reduced-motion: reduce) {
  .ugc-choice, .ugc-tag-option, .ugc-tag-editor-toggle, .ugc-tag-done { transition: none; }
}
</style>

<style scoped>
.chart-ugc-section--song-detail {margin:0;padding-top:28px;border-color:var(--viewer-border);}
.chart-ugc-section--song-detail .chart-ugc-head {margin-bottom:24px;}
.chart-ugc-section--song-detail h3 {font-size:20px;font-weight:600;line-height:1.5;color:var(--viewer-text);}
.chart-ugc-section--song-detail .chart-ugc-difficulty {background:transparent;color:var(--viewer-text-muted);font-size:14px;font-weight:400;padding:0;}
.chart-ugc-section--song-detail .chart-ugc-grid {gap:32px 36px;}
.chart-ugc-section--song-detail .ugc-panel {border:0;border-radius:0;background:transparent;padding:0;}
.chart-ugc-section--song-detail .ugc-panel h4 {font-size:17px;font-weight:600;color:var(--viewer-text);}
.chart-ugc-section--song-detail .ugc-cold-copy {font-size:14px;color:var(--viewer-text-muted);}
.chart-ugc-section--song-detail button {font-size:14px;min-height:44px;font-weight:500;}
.chart-ugc-section--song-detail .ugc-control-meta {font-size:14px;flex-wrap:wrap;}
.chart-ugc-section--song-detail .ugc-panel--tips {padding-top:24px;border-top:1px solid var(--viewer-border);}
.chart-ugc-section--song-detail .ugc-tip-primary {background:var(--viewer-surface);color:var(--viewer-link);border-color:var(--viewer-text-muted);}
.chart-ugc-section--song-detail .ugc-choice,.chart-ugc-section--song-detail .ugc-tag-editor-toggle {background:var(--viewer-surface);border-color:var(--viewer-text-muted);color:var(--viewer-text);}
.chart-ugc-section--song-detail .ugc-tip-primary:focus-visible {outline:3px solid var(--viewer-link);outline-offset:3px;}
</style>
