<script setup lang="ts">
// Player notes of the selected chart on the song detail page (was components/ChartUgcSection.vue): difficulty votes,
// tags and tips. Script unchanged; presentation moved to the design-system tokens (votes and selected tags use
// --vote-on*, the distribution bars --series-alt).
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
// Static locale keys (checked against the locale files)
const SUMMARY_KEYS = {
  insufficient: "ugc.difficulty.summary.insufficient",
  mixed: "ugc.difficulty.summary.mixed",
  easy: "ugc.difficulty.summary.easy",
  balanced: "ugc.difficulty.summary.balanced",
  hard: "ugc.difficulty.summary.hard"
} as const;
const BUCKET_KEYS = {
  "-2": "ugc.difficulty.buckets.-2",
  "-1": "ugc.difficulty.buckets.-1",
  "0": "ugc.difficulty.buckets.0",
  "1": "ugc.difficulty.buckets.1",
  "2": "ugc.difficulty.buckets.2"
} as const;
const GROUP_KEYS = {
  rhythm: "ugc.tagGroups.rhythm",
  technique: "ugc.tagGroups.technique",
  stamina: "ugc.tagGroups.stamina",
  readability_speed: "ugc.tagGroups.readability_speed",
  structure: "ugc.tagGroups.structure"
} as const;
const bucketLabel = (value: ChartDifficultyVoteValue) => t(BUCKET_KEYS[String(value) as keyof typeof BUCKET_KEYS]);
const summaryText = computed(() => t(SUMMARY_KEYS[props.summary.difficulty.summary]));
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
  <section id="chart-ugc" class="ugc" aria-labelledby="chart-ugc-title">
    <header class="ugc-head">
      <h2 id="chart-ugc-title">{{ t("ugc.sectionTitle") }}</h2>
      <span class="ugc-difficulty">{{ difficultyLabel }}</span>
    </header>

    <div class="ugc-grid">
      <section class="ugc-part" aria-labelledby="chart-ugc-difficulty-title">
        <h3 id="chart-ugc-difficulty-title">{{ t("ugc.difficulty.title") }}</h3>
        <template v-if="summary.difficulty.count">
          <p class="ugc-summary">
            <strong>{{ summaryText }}</strong>
            <span>{{ t("ugc.difficulty.count", { count: summary.difficulty.count }) }}</span>
            <span v-if="summary.difficulty.verifiedCount">{{ t("ugc.difficulty.verifiedCount", { count: summary.difficulty.verifiedCount }) }}</span>
          </p>
          <ul class="ugc-bars" :aria-label="t('ugc.difficulty.distributionLabel')">
            <li v-for="row in distributionRows" :key="row.value">
              <span class="ugc-bars__label">{{ bucketLabel(row.value) }}</span>
              <span class="ugc-bars__track" aria-hidden="true"><span :style="{ width: `${row.percentage}%` }" /></span>
              <strong class="num">{{ t("ugc.difficulty.votes", { count: row.count }) }}</strong>
            </li>
          </ul>
        </template>
        <p v-else class="ugc-cold">{{ t("ugc.difficulty.empty") }}</p>

        <ClientOnly>
          <div class="ugc-contribution" :aria-busy="difficultySaving">
            <div class="ugc-choices" role="radiogroup" :aria-label="t('ugc.difficulty.choose')" :aria-describedby="difficultyErrorKey ? 'ugc-difficulty-error' : undefined">
              <button
                v-for="value in bucketValues"
                :key="value"
                type="button"
                role="radio"
                class="ugc-choice"
                :aria-checked="viewerState?.difficultyVote === value"
                :tabindex="viewerState?.difficultyVote === value || (viewerState?.difficultyVote == null && value === bucketValues[0]) ? 0 : -1"
                :disabled="authenticated && (!canWrite || interactionPending)"
                @click="chooseDifficulty(value)"
                @keydown="navigateDifficulty($event, value)"
              >
                {{ bucketLabel(value) }}
              </button>
            </div>
            <div class="ugc-meta">
              <span v-if="difficultySaving" role="status">{{ t("ugc.saving") }}</span>
              <span v-else-if="interactionUnavailable">{{ t("ugc.interactionUnavailable") }}</span>
              <button v-if="viewerState?.difficultyVote !== null && viewerState" type="button" class="rw-btn rw-btn--ghost rw-btn--sm" :disabled="difficultySaving" @click="clearDifficulty">
                {{ t("ugc.clear") }}
              </button>
            </div>
            <p v-if="difficultyErrorKey" id="ugc-difficulty-error" class="ugc-error" role="alert">{{ t(difficultyErrorKey) }}</p>
          </div>
        </ClientOnly>
      </section>

      <section class="ugc-part" aria-labelledby="chart-ugc-tags-title">
        <h3 id="chart-ugc-tags-title">{{ t("ugc.tagsTitle") }}</h3>
        <ul v-if="summary.tags.length" class="ugc-tags">
          <li v-for="tag in summary.tags" :key="tag.slug">
            <span>{{ t(tag.labelKey) }}</span>
            <small class="num">{{ t("ugc.tagVotes", { count: tag.count }) }}</small>
          </li>
        </ul>
        <p v-else class="ugc-cold">{{ t("ugc.tagsEmpty") }}</p>

        <ClientOnly>
          <div class="ugc-contribution" :aria-busy="tagSaving">
            <button
              type="button"
              class="rw-btn"
              :aria-expanded="tagEditorOpen"
              aria-controls="ugc-tag-editor"
              :disabled="authenticated && (!canWrite || interactionPending)"
              @click="openTagEditor"
            >
              {{ selectedTagSlugs.length ? t("ugc.editTags") : t("ugc.addTags") }}
            </button>
            <div v-show="tagEditorOpen" id="ugc-tag-editor" class="ugc-tag-editor">
              <div v-for="group in tagGroups" :key="group.groupKey" class="ugc-tag-group">
                <h4>{{ t(GROUP_KEYS[group.groupKey]) }}</h4>
                <div class="ugc-chips">
                  <button v-for="tag in group.tags" :key="tag.slug" type="button" class="ugc-chip" :aria-pressed="selectedTagSet.has(tag.slug)" @click="toggleTag(tag.slug)">
                    {{ t(tag.labelKey) }}
                  </button>
                </div>
              </div>
              <div v-if="deprecatedSelections.length" class="ugc-deprecated">
                <span>{{ t("ugc.deprecatedTags") }}</span>
                <button v-for="tag in deprecatedSelections" :key="tag.slug" type="button" class="rw-btn rw-btn--sm" @click="removeDeprecatedTag(tag.slug)">
                  {{ t(tag.labelKey) }} · {{ t("ugc.remove") }}
                </button>
              </div>
              <div class="ugc-tag-editor__footer">
                <span>{{ t("ugc.selectedTags", { count: activeSelectedTagSlugs.length }) }}</span>
                <button type="button" class="rw-btn rw-btn--primary rw-btn--sm" @click="tagEditorOpen = false">{{ t("ugc.done") }}</button>
              </div>
              <p v-if="tagLimitReached" class="ugc-error" role="status" aria-live="polite">{{ t("ugc.tagLimit") }}</p>
            </div>
            <div class="ugc-meta">
              <span v-if="tagSaving" role="status">{{ t("ugc.saving") }}</span>
              <span v-else-if="interactionUnavailable">{{ t("ugc.interactionUnavailable") }}</span>
            </div>
            <p v-if="tagErrorKey" class="ugc-error" role="alert">{{ t(tagErrorKey) }}</p>
          </div>
        </ClientOnly>
      </section>

      <section class="ugc-part is-wide" aria-labelledby="chart-ugc-tips-title">
        <h3 id="chart-ugc-tips-title">{{ t("ugc.tipsTitle") }}</h3>
        <p v-if="!summary.tips.length" class="ugc-cold">{{ t("ugc.tipsEmpty") }}</p>
        <ul v-else class="ugc-tips">
          <li v-for="tip in summary.tips" :key="tip.tipId" class="ugc-tip">
            <DsPlayerAvatar :src="tip.author.avatarUrl" :size="24" />
            <div class="ugc-tip__body">
              <p>{{ tip.body }}</p>
              <div class="ugc-tip__meta">
                <span class="ugc-tip__author">{{ tip.author.isDeleted ? t("ugc.deletedUser") : tip.author.displayName }}</span>
                <span v-if="tip.verifiedPlay" class="ugc-tip__verified">{{ t("ugc.verifiedPlay") }}</span>
                <button type="button" class="rw-btn rw-btn--ghost rw-btn--sm" @click="openReport(tip.tipId)">{{ t("ugc.report") }}</button>
                <span v-if="props.helpfulErrorById[tip.tipId]" class="ugc-error">{{ t(props.helpfulErrorById[tip.tipId] || "ugc.helpfulError") }}</span>
              </div>
            </div>
            <button type="button" class="ugc-helpful" :aria-pressed="helpfulSet.has(tip.tipId)" :disabled="Boolean(props.helpfulSavingById[tip.tipId])" @click="toggleHelpful(tip.tipId)">
              {{ t("ugc.helpfulCount", { count: tip.helpfulCount }) }}
            </button>
          </li>
        </ul>
        <div class="ugc-actions">
          <button type="button" class="rw-btn" :disabled="myTip?.status === 'hidden' || (authenticated && (!canTipWrite || interactionPending))" @click="openTipEditor">
            {{ myTip?.status === "active" || myTip?.status === "hidden" ? t("ugc.editTip") : t("ugc.leaveTip") }}
          </button>
          <button v-if="myTip?.status === 'active'" type="button" class="rw-btn rw-btn--ghost" :disabled="tipSaving" @click="deleteTip">{{ t("ugc.deleteTip") }}</button>
        </div>
        <p v-if="myTip?.status === 'hidden'" class="ugc-status">{{ t("ugc.tip.hidden") }}</p>
        <div v-if="tipEditorOpen" class="ugc-editor">
          <label for="ugc-tip-body">{{ t("ugc.tip.label") }}</label>
          <textarea id="ugc-tip-body" v-model="tipBody" rows="3" maxlength="120" :aria-describedby="tipErrorKey ? 'ugc-tip-error' : 'ugc-tip-count'" />
          <div id="ugc-tip-count" class="ugc-editor__meta">
            <span>{{ t("ugc.tip.remaining", { count: Math.max(0, 120 - tipBodyLength) }) }}</span><span class="num">{{ tipBodyLength }} / 120</span>
          </div>
          <div class="ugc-actions">
            <button type="button" class="rw-btn rw-btn--primary" :disabled="tipSaving || !tipBody.trim() || tipBodyLength > 120" @click="saveTip">{{ t("ugc.save") }}</button>
            <button type="button" class="rw-btn" :disabled="tipSaving" @click="cancelTipEditor">{{ t("ugc.cancel") }}</button>
          </div>
          <p v-if="tipErrorKey" id="ugc-tip-error" class="ugc-error" role="alert">{{ t(tipErrorKey) }}</p>
        </div>
        <div v-if="reportTipId" class="ugc-editor">
          <label for="ugc-report-reason">{{ t("ugc.reportReason") }}</label>
          <select id="ugc-report-reason" v-model="reportReason">
            <option value="spam">{{ t("ugc.reportReasons.spam") }}</option>
            <option value="abuse">{{ t("ugc.reportReasons.abuse") }}</option>
            <option value="advertising">{{ t("ugc.reportReasons.advertising") }}</option>
            <option value="link">{{ t("ugc.reportReasons.link") }}</option>
            <option value="duplicate">{{ t("ugc.reportReasons.duplicate") }}</option>
            <option value="other">{{ t("ugc.reportReasons.other") }}</option>
          </select>
          <div class="ugc-actions">
            <button type="button" class="rw-btn rw-btn--primary" :disabled="Boolean(props.reportSavingById[reportTipId])" @click="submitReport">{{ t("ugc.submitReport") }}</button>
            <button type="button" class="rw-btn" @click="reportTipId = null">{{ t("ugc.cancel") }}</button>
          </div>
          <p v-if="props.reportErrorById[reportTipId]" class="ugc-error" role="alert">{{ t(props.reportErrorById[reportTipId] || "ugc.reportError") }}</p>
        </div>
        <p v-if="Object.values(props.reportSuccessById).some(Boolean)" class="ugc-success" role="status">{{ t("ugc.reportSuccess") }}</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.ugc {
  container-type: inline-size;
  min-width: 0;
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  font-family: var(--font-ui);
  color: var(--ink);
}
.ugc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-4);
  min-height: var(--hit);
  margin-bottom: var(--sp-3);
}
.ugc-head h2 {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
  line-height: var(--lh-snug);
}
.ugc-difficulty {
  font-size: var(--fs-13);
  color: var(--ink-3);
}
.ugc-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-8) var(--sp-10);
}
.ugc-part {
  min-width: 0;
}
.ugc-part.is-wide {
  grid-column: 1 / -1;
}
h3 {
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--ink-2);
}
h4 {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-12);
  font-weight: 500;
  color: var(--ink-3);
}
.ugc-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px var(--sp-3);
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.ugc-summary strong {
  font-size: var(--fs-16);
  color: var(--ink);
}
.ugc-cold {
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  color: var(--ink-2);
}
.ugc-bars,
.ugc-tags,
.ugc-tips {
  margin: 0;
  padding: 0;
  list-style: none;
}
.ugc-bars {
  display: grid;
  gap: var(--sp-2);
}
.ugc-bars li {
  display: grid;
  grid-template-columns: minmax(64px, auto) minmax(48px, 1fr) auto;
  align-items: center;
  gap: var(--sp-3);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.ugc-bars__track {
  height: 8px;
  overflow: hidden;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
}
.ugc-bars__track span {
  display: block;
  min-width: 2px;
  height: 100%;
  border-radius: var(--r-xs);
  background: var(--series-alt);
}
.ugc-bars strong {
  font-size: var(--fs-14);
  color: var(--ink);
}
.ugc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.ugc-tags li {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: var(--r-note);
  background: var(--surface);
  font-size: var(--fs-13);
}
.ugc-tags small {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.ugc-contribution {
  margin-top: var(--sp-4);
  padding-top: var(--sp-3);
  border-top: 1px dashed var(--line);
}
.ugc-choices {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}
.ugc-choice,
.ugc-chip,
.ugc-helpful {
  min-height: var(--hit);
  padding: 6px var(--sp-2);
  border: 1px solid var(--ctl-border);
  border-radius: var(--r-ctl);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-13);
  overflow-wrap: anywhere;
  cursor: pointer;
  touch-action: manipulation;
}
.ugc-choice:hover,
.ugc-chip:hover,
.ugc-helpful:hover {
  background: var(--bg-sunk);
}
.ugc-choice[aria-checked="true"],
.ugc-chip[aria-pressed="true"],
.ugc-helpful[aria-pressed="true"] {
  border-color: var(--vote-on);
  background: var(--vote-on-wash);
  color: var(--vote-on-ink);
  font-weight: 700;
}
.ugc-choice:disabled,
.ugc-helpful:disabled {
  color: var(--ink-3);
  background: var(--bg-sunk);
  cursor: not-allowed;
}
.ugc-choice:focus-visible,
.ugc-chip:focus-visible,
.ugc-helpful:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.ugc-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2) var(--sp-3);
  min-height: 24px;
  margin-top: var(--sp-2);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.ugc-error {
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-13);
  line-height: 1.45;
  color: var(--danger);
}
.ugc-tag-editor {
  display: grid;
  gap: var(--sp-3);
  margin-top: var(--sp-3);
}
.ugc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.ugc-chip {
  padding: 4px var(--sp-3);
  border-radius: var(--r-note);
}
.ugc-deprecated {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.ugc-tag-editor__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.ugc-tips {
  border-top: 1px solid var(--line);
}
.ugc-tip {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-3) 0;
  border-bottom: 1px solid var(--line);
}
.ugc-tip__body {
  flex: 1;
  min-width: 0;
}
.ugc-tip__body p {
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.ugc-tip__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 var(--sp-3);
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.ugc-tip__author {
  color: var(--ink-2);
  font-weight: 500;
}
.ugc-tip__verified {
  color: var(--ok);
  font-weight: 500;
}
.ugc-helpful {
  flex: none;
  align-self: center;
  padding: 4px var(--sp-3);
  border-radius: var(--r-note);
  white-space: nowrap;
}
.ugc-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}
.ugc-status {
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.ugc-editor {
  display: grid;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
  padding-top: var(--sp-3);
  border-top: 1px dashed var(--line);
}
.ugc-editor label {
  font-size: var(--fs-13);
  font-weight: 600;
}
.ugc-editor textarea,
.ugc-editor select {
  width: 100%;
  box-sizing: border-box;
  min-height: var(--hit);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--ctl-border);
  border-radius: var(--r-ctl);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-16);
  line-height: 1.55;
}
.ugc-editor__meta {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.ugc-success {
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--ok);
}
/* One column wherever the card is narrow: the right column of the song detail page, tablets and phones */
@container (max-width: 639px) {
  .ugc-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--sp-6);
  }
}
@media (max-width: 767px) {
  .ugc {
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
  }
}
@container (max-width: 459px) {
  .ugc-choices {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
