<script setup lang="ts">
// ReworkToolsRtCalculator — presentation of /tools/rt-calculator (slice F; frozen design: ToolRt.vue). Every value,
// input handler and computation stays in the page (utils/rtCalculator.ts unchanged); this component only lays out the
// controls and the result. Class names and ids the Linux smoke (scripts/verify_rt_calculator_browser.mjs) reads are kept:
// .rt-calculator, .rt-controls, .rt-output, .selection-row select, .judgment-toolbar select, #rt-good / #rt-ok / #rt-bad,
// #rt-validation, .rating strong, .accuracy strong, .dimensions dd.
import type { PropType } from "vue";
import type { AutoJudgment, Judgments, RtResult } from "~/utils/rtCalculator";

type Copy = Record<string, string> & { v1: string[]; v2: string[] };
const props = defineProps({
  copy: { type: Object as PropType<Copy>, required: true },
  songId: { type: Number, required: true },
  version: { type: String as PropType<"v1" | "v2">, required: true },
  level: { type: Number, required: true },
  options: { type: Array as PropType<{ id: number; label: string }[]>, required: true },
  searching: { type: Boolean, default: false },
  searchError: { type: Boolean, default: false },
  pending: { type: Boolean, default: false },
  failed: { type: Boolean, default: false },
  hasSong: { type: Boolean, default: false },
  hasChart: { type: Boolean, default: false },
  v2Unavailable: { type: Boolean, default: false },
  totalNotes: { type: Number, default: 0 },
  auto: { type: String as PropType<AutoJudgment>, required: true },
  resolved: { type: Object as PropType<Judgments | null>, default: null },
  result: { type: Object as PropType<RtResult | null>, default: null },
  fullResult: { type: Object as PropType<RtResult | null>, default: null },
  inputValue: { type: Function as PropType<(key: keyof Judgments) => number | string>, required: true }
});
const emit = defineEmits<{
  "update:version": [value: "v1" | "v2"];
  "update:level": [value: number];
  search: [keyword?: string];
  select: [id: number];
  retry: [];
  input: [key: keyof Judgments, event: Event];
  auto: [event: Event];
  full: [];
}>();
const { t } = useI18n();
const localePath = useLocalePath();
const judgmentKeys = ["good", "ok", "bad"] as const;
const levels = computed(() => (props.version === "v1" ? [4, 5] : [3, 4, 5]));
const shown = computed(() => !props.pending && props.result);
const width = (index: number) =>
  !props.pending && props.result?.eligible && props.fullResult?.dimensions[index]
    ? Math.min(100, (props.result.dimensions[index] / props.fullResult.dimensions[index]) * 100)
    : 0;
</script>

<template>
  <div class="rt-calculator">
    <section class="rt-controls" :aria-label="copy.song">
      <label class="rt-label" for="rt-song">{{ copy.song }}</label>
      <el-select
        id="rt-song"
        :model-value="songId || undefined"
        filterable
        remote
        :remote-method="(keyword: string) => emit('search', keyword)"
        :loading="searching"
        :persistent="false"
        :placeholder="copy.search"
        :no-data-text="searchError ? copy.searchFailed : copy.noSongs"
        class="song-select"
        @visible-change="(open: boolean) => { if (open && !searching) emit('search'); }"
        @update:model-value="(value: number) => emit('select', value)"
      >
        <el-option v-for="option in options" :key="option.id" :label="option.label" :value="option.id" />
      </el-select>
      <p v-if="searchError" class="rw-field__error" role="alert">{{ copy.searchFailed }}</p>

      <div class="selection-row">
        <label class="rw-field">
          <span class="rw-field__label">{{ copy.version }}</span>
          <select class="rw-select" :value="version" @change="emit('update:version', ($event.target as HTMLSelectElement).value as 'v1' | 'v2')">
            <option value="v2">V2</option>
            <option value="v1">V1</option>
          </select>
        </label>
        <label class="rw-field">
          <span class="rw-field__label">{{ copy.difficulty }}</span>
          <select class="rw-select" :value="level" @change="emit('update:level', Number(($event.target as HTMLSelectElement).value))">
            <option v-for="difficulty in levels" :key="difficulty" :value="difficulty">{{ t(`difficulty.${difficulty}`) }}</option>
          </select>
        </label>
      </div>

      <ReworkState v-if="pending" kind="loading" :title="copy.loading" :lines="3" compact />
      <ReworkState v-else-if="failed" kind="failed" :title="copy.failed" :retry-label="copy.retry" compact @retry="emit('retry')" />
      <template v-else-if="hasSong">
        <div class="chart-heading">
          <NuxtLink class="rw-link" :to="localePath(`/songs/${songId}`)">{{ copy.detail }} ↗</NuxtLink>
          <span v-if="hasChart" class="rt-notes">{{ copy.notes }} <strong class="num">{{ totalNotes }}</strong></span>
        </div>
        <template v-if="hasChart">
          <div class="judgment-toolbar">
            <label class="rw-field">
              <span class="rw-field__label">{{ copy.auto }}</span>
              <select class="rw-select" :value="auto" @change="emit('auto', $event)">
                <option v-for="key in judgmentKeys" :key="key" :value="key">{{ copy[key] }}</option>
                <option value="manual">{{ copy.manual }}</option>
              </select>
            </label>
            <button type="button" class="rw-btn" @click="emit('full')">{{ copy.full }}</button>
          </div>
          <div class="judgment-grid">
            <label v-for="key in judgmentKeys" :key="key" :class="['judgment', key]" :for="`rt-${key}`">
              <span class="judgment__name">{{ copy[key] }}</span>
              <input
                :id="`rt-${key}`"
                class="rw-input num"
                type="number"
                inputmode="numeric"
                min="0"
                :max="totalNotes"
                step="1"
                :value="inputValue(key)"
                :readonly="auto === key"
                :aria-invalid="!resolved"
                :aria-describedby="!resolved ? 'rt-validation' : undefined"
                @input="emit('input', key, $event)"
              />
            </label>
          </div>
          <p v-if="auto !== 'manual'" class="judgment-note">{{ copy.auto }} · {{ copy[auto] }}</p>
          <p v-if="!resolved" id="rt-validation" class="rw-field__error" role="alert">{{ copy.invalid }}</p>
          <p v-else-if="result && !result.eligible" class="rw-alert rw-alert--info rt-notice" role="status">{{ copy.below }}</p>
        </template>
        <div v-else class="rt-empty" role="status">
          <p>{{ version === "v2" && v2Unavailable ? copy.v2Failed : copy.empty }}</p>
          <button type="button" class="rw-btn rw-btn--sm" @click="emit('retry')">{{ copy.retry }}</button>
        </div>
      </template>
      <p v-else class="rt-empty">{{ copy.choose }}</p>
    </section>

    <section class="rt-output" :aria-label="copy.result" :aria-busy="pending">
      <div class="result-summary" role="status" aria-live="polite" aria-atomic="true">
        <div class="rating">
          <span>{{ copy.rating }} · {{ version.toUpperCase() }}</span>
          <strong class="num">{{ shown && result!.eligible ? result!.rating.toFixed(4) : "—" }}</strong>
        </div>
        <div class="accuracy">
          <span>{{ copy.accuracy }}</span>
          <strong class="num">{{ shown ? `${(result!.accuracy * 100).toFixed(4)}%` : "—" }}</strong>
        </div>
      </div>
      <dl class="dimensions">
        <div v-for="(name, index) in copy[version]" :key="`${version}-${name}`" class="dimension">
          <dt>{{ name }}</dt>
          <dd class="num">{{ shown && result!.eligible ? result!.dimensions[index].toFixed(4) : "—" }}</dd>
          <span class="dimension-track" aria-hidden="true"><span :style="{ width: `${width(index)}%` }" /></span>
        </div>
      </dl>
      <a v-if="version === 'v2'" class="source rw-link" href="https://github.com/OurTaiko/Constants" target="_blank" rel="noopener noreferrer">{{ copy.source }} · OurTaiko / Constants ↗</a>
    </section>
  </div>
</template>

<style scoped>
.rt-calculator {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-5);
  align-items: start;
  min-width: 0;
  font-family: var(--font-ui);
  color: var(--ink);
}
.rt-controls,
.rt-output {
  min-width: 0;
  padding: var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.rt-output {
  background: var(--bg-sunk);
}
.rt-label {
  display: block;
  margin-bottom: 6px;
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-2);
}
.song-select {
  width: 100%;
}
.song-select :deep(.el-select__wrapper) {
  min-height: var(--hit);
}
.selection-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-4);
  margin-top: var(--sp-4);
}
.selection-row .rw-select {
  width: 100%;
  min-width: 0;
}
.chart-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  margin-top: var(--sp-4);
  padding: var(--sp-3) 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-14);
}
.chart-heading .rw-link {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
}
.rt-notes strong {
  margin-left: 6px;
  font-size: var(--fs-16);
}
.judgment-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--sp-3);
  margin: var(--sp-4) 0;
}
.judgment-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-3);
}
.judgment {
  display: grid;
  grid-template-rows: auto auto;
  align-content: start;
  min-width: 0;
  gap: 6px;
  padding-top: var(--sp-2);
  border-top: 2px solid var(--line-strong);
  font-size: var(--fs-14);
  font-weight: 600;
}
.judgment-grid .judgment input.rw-input {
  width: 100%;
  min-width: 0;
  min-height: 48px;
  font-size: var(--fs-22);
}
.judgment-grid .judgment input.rw-input[readonly] {
  background: var(--bg-sunk);
  border-style: dashed;
}
/* which judgement is filled in automatically: one line under the row (the three columns keep one height) */
.judgment-note {
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.rt-notice {
  margin-top: var(--sp-4);
}
.rw-field__error {
  margin: var(--sp-3) 0 0;
}
.rt-empty {
  margin: var(--sp-4) 0 0;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.rt-empty p {
  margin: 0 0 var(--sp-2);
}
.result-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--sp-4);
  padding-bottom: var(--sp-5);
  border-bottom: 1px solid var(--line);
}
.rating,
.accuracy {
  display: grid;
  gap: var(--sp-2);
}
.result-summary span {
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.rating strong {
  font-size: var(--fs-36);
  font-weight: 700;
  line-height: 1;
}
.accuracy strong {
  font-size: var(--fs-22);
  line-height: 1.2;
}
.dimensions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-4) var(--sp-5);
  margin: var(--sp-5) 0;
}
.dimension {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 6px var(--sp-2);
  min-width: 0;
}
.dimension dt {
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.dimension dd {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 600;
}
.dimension-track {
  grid-column: 1 / -1;
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--line);
}
.dimension-track > span {
  display: block;
  height: 100%;
  background: var(--series);
}
.source {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-13);
}
@media (max-width: 1099px) {
  .rt-calculator {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .rt-controls,
  .rt-output {
    padding: var(--sp-4);
  }
  .judgment-grid {
    gap: var(--sp-2);
  }
  .judgment-grid .judgment input.rw-input {
    font-size: var(--fs-18);
    padding: 0 var(--sp-2);
  }
  .judgment-toolbar {
    flex-wrap: wrap;
  }
}
@media (max-width: 420px) {
  .dimensions {
    column-gap: var(--sp-4);
  }
  .dimension {
    grid-template-columns: 1fr;
  }
  .dimension-track {
    grid-column: 1;
  }
}
</style>
