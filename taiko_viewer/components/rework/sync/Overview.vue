<script setup lang="ts">
// ReworkSyncOverview — the first section of /account/sync: the current binding, whether a sync can start now (and
// why not), the targets to send to, the start button and the outcome of the last request, in one place.
// Presentation only: the page owns the selection (v-model:selected), the start handler (`submit`) and the start
// button's disabled condition (`startDisabled`, the page's original expression); the readiness text is derived from
// the same fields in the same order (utils/rework/sync.ts syncReadiness).
import type { PropType } from "vue";
import { syncOutcome, syncReadiness, type SyncOverviewPayload } from "~/utils/rework/sync";

type Notice = { level: "success" | "warning" | "error"; message: string } | null;
const props = defineProps({
  overview: { type: Object as PropType<SyncOverviewPayload>, required: true },
  cooldown: { type: Number, required: true },
  pending: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  /** the page's own disabled condition of the start button */
  startDisabled: { type: Boolean, required: true },
  selected: { type: Array as PropType<string[]>, required: true },
  /** the result of the request the page just made (the same text as its message toast) */
  notice: { type: Object as PropType<Notice>, default: null },
  /** buildSyncFeedback(lastSync) of the page, for the last-result line */
  lastFeedback: { type: Object as PropType<Notice>, default: null }
});
const emit = defineEmits<{ submit: []; "update:selected": [value: string[]] }>();
const { t } = useI18n();
const localePath = useLocalePath();
const { formatDateTime } = useViewerDateTime();
const k = (key: string, values?: Record<string, unknown>) => t(`rework.account.sync.${key}`, values || {});

const binding = computed(() => props.overview.currentBinding);
const readiness = computed(() => syncReadiness(props.overview, props.cooldown));
const lastLog = computed(() => props.overview.lastSync);
const lastOutcome = computed(() => (lastLog.value ? syncOutcome(lastLog.value.status) : null));
const model = computed({
  get: () => props.selected,
  set: (value: string[]) => emit("update:selected", value)
});
// The cooldown applies to syncs and to the imports below (manual bindings included), as the old status grid showed.
const statusTag = computed(() => {
  if (!binding.value) return null;
  if (props.cooldown > 0) return { tone: "warn", text: k("remaining", { seconds: props.cooldown }) };
  if (readiness.value === "reverify" || readiness.value === "unavailable") return null;
  return { tone: "ok", text: k("ready") };
});
const blocker = computed(() => {
  const value = readiness.value;
  if (value === "manual") return { tone: "info", text: k("manualSaved") };
  if (value === "reverify") return { tone: "warn", text: k("reverifyBinding"), link: true };
  if (value === "unavailable") return { tone: "warn", text: k("serviceUnavailable") };
  return null;
});
const noticeRole = computed(() => (props.notice?.level === "error" ? "alert" : "status"));
</script>

<template>
  <section class="rs-over" aria-labelledby="sync-binding-title">
    <div class="rs-over__head">
      <div class="rs-over__who">
        <p class="rs-over__label">{{ k("currentBinding") }}</p>
        <h2 id="sync-binding-title" class="rs-over__name">
          <span class="rs-over__name-text">{{ binding?.displayName || binding?.taikoId }}</span>
          <span v-if="binding?.displayName && binding.displayName !== binding.taikoId" class="rs-over__id num">{{ binding.taikoId }}</span>
        </h2>
        <p class="rs-over__meta">
          <span>{{ k("currentTitle") }} <b>{{ binding?.verifiedTitle || "—" }}</b></span>
        </p>
      </div>
      <span v-if="statusTag" class="rw-tag rs-over__state" :class="`rw-tag--${statusTag.tone}`" data-sync-readiness>{{ statusTag.text }}</span>
    </div>

    <p class="rs-over__last" data-sync-last>
      <span class="rs-over__last-label">{{ k("lastSync") }}</span>
      <template v-if="lastLog">
        <time class="num" :datetime="lastLog.createdAt">{{ formatDateTime(lastLog.createdAt) }}</time>
        <span class="rw-tag" :class="lastOutcome === 'success' ? 'rw-tag--ok' : lastOutcome === 'partial' ? 'rw-tag--warn' : 'rs-tag--danger'">
          <ReworkIcon :name="lastOutcome === 'success' ? 'check' : 'warn'" />{{ k(`outcome.${lastOutcome}`) }}
        </span>
        <a class="rw-link" href="#sync-last-result">{{ k("details") }}</a>
      </template>
      <span v-else>{{ k("noHistory") }}</span>
    </p>

    <div v-if="blocker" class="rw-alert" :class="`rw-alert--${blocker.tone}`" role="note">
      <p class="rs-over__alert-text">{{ blocker.text }}</p>
      <NuxtLink v-if="blocker.link" class="rw-link" :to="localePath('/account/profile')">{{ k("toProfile") }}</NuxtLink>
    </div>

    <template v-if="!binding?.isManual">
      <fieldset class="rs-over__targets" :disabled="pending || submitting">
        <legend class="rs-over__legend">{{ k("targets") }}</legend>
        <p v-if="!overview.targets.length" class="rs-over__empty">{{ k("noTargets") }}</p>
        <label v-for="target in overview.targets" v-else :key="target.id" class="target-item">
          <input v-model="model" type="checkbox" :value="target.id" />
          <span class="target-item__text">
            <span class="target-label">{{ target.label }}</span>
            <span v-if="target.description" class="target-item__desc">{{ target.description }}</span>
          </span>
        </label>
      </fieldset>
      <div class="rs-over__action">
        <button
          type="button"
          class="rw-btn rw-btn--primary rs-over__start"
          :class="{ 'is-busy': submitting }"
          :disabled="startDisabled || submitting"
          :aria-busy="submitting || undefined"
          data-sync-start
          @click="emit('submit')"
        >
          <ReworkIcon v-if="!submitting" name="sync" />{{ cooldown > 0 ? k("coolingDown", { seconds: cooldown }) : k("start") }}
        </button>
        <span class="rs-over__hint">{{ k("cooldownHint") }}</span>
      </div>
    </template>

    <p
      v-if="notice"
      class="rw-alert rs-over__notice"
      :class="notice.level === 'success' ? 'rw-alert--ok' : notice.level === 'warning' ? 'rw-alert--warn' : ''"
      :role="noticeRole"
      data-sync-notice
    >
      {{ notice.message }}
    </p>
    <p v-else-if="lastLog && lastOutcome !== 'success' && lastFeedback" class="rs-over__why" data-sync-why>{{ lastFeedback.message }}</p>
  </section>
</template>

<style scoped>
.rs-over {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-width: 0;
  padding: var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-ui);
}
.rs-over__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-3);
}
.rs-over__who {
  min-width: 0;
}
.rs-over__label {
  margin: 0;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.rs-over__name {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px var(--sp-3);
  margin: 2px 0 0;
  font-size: var(--fs-22);
  font-weight: 700;
  line-height: var(--lh-tight);
  overflow-wrap: anywhere;
}
.rs-over__name-text {
  min-width: 0;
}
.rs-over__id {
  font-size: var(--fs-14);
  font-weight: 500;
  color: var(--ink-2);
}
.rs-over__meta {
  margin: var(--sp-1) 0 0;
  font-size: var(--fs-14);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.rs-over__meta b {
  color: var(--ink);
  font-weight: 600;
}
.rs-over__state {
  flex: none;
}
.rs-over__last {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-1) var(--sp-3);
  margin: 0;
  padding-top: var(--sp-3);
  border-top: 1px solid var(--line);
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.rs-over__last-label {
  color: var(--ink-2);
}
.rs-over__last time {
  color: var(--ink);
}
.rs-over__last .rw-link {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
}
.rs-tag--danger {
  background: var(--danger-wash);
  color: var(--ink);
}
.rs-over__alert-text {
  margin: 0;
}
.rs-over__targets {
  display: grid;
  gap: var(--sp-2);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.rs-over__legend {
  margin-bottom: var(--sp-2);
  padding: 0;
  font-size: var(--fs-14);
  font-weight: 700;
}
.rs-over__empty {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.target-item {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  min-height: var(--hit);
  padding: var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  cursor: pointer;
}
.target-item:has(input:checked) {
  border-color: var(--seg-on-ring);
  background: var(--bg-sunk);
}
.target-item input {
  flex: none;
  width: 18px;
  height: 18px;
  margin: 2px 0 0;
  accent-color: var(--action-bg);
}
.target-item input:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.rs-over__targets:disabled .target-item {
  cursor: not-allowed;
  color: var(--ink-3);
}
.target-item__text {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.target-label {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.target-item__desc {
  font-size: var(--fs-13);
  line-height: var(--lh-snug);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.rs-over__action {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2) var(--sp-4);
}
.rs-over__start {
  min-width: 168px;
}
.rs-over__start svg {
  width: 18px;
  height: 18px;
}
.rs-over__hint {
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.rs-over__notice {
  white-space: pre-line;
}
.rs-over__why {
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .rs-over {
    padding: var(--sp-4);
  }
  .rs-over__head {
    flex-wrap: wrap;
  }
  .rs-over__start {
    flex: 1 1 100%;
  }
}
</style>
