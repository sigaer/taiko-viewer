<script setup lang="ts">
// ReworkToolsTjaConstants — presentation of /tools/tja-constants (slice F; frozen design: ToolTja.vue). The file
// checks (one .tja file, 1 B – 512 KB), the request, cancel, timeout and the result handling stay in the page; this
// component lays out the upload panel and the result. The file input keeps accept=".tja".
import type { PropType } from "vue";
import type { TjaChart, TjaResult } from "~/types/tja-calculator";
import type { tjaCalculatorCopy } from "~/utils/tjaCalculatorCopy";

type Copy = (typeof tjaCalculatorCopy)["zh"];
const props = defineProps({
  copy: { type: Object as PropType<Copy>, required: true },
  file: { type: Object as PropType<File | undefined>, default: undefined },
  encoding: { type: String, required: true },
  result: { type: Object as PropType<TjaResult | undefined>, default: undefined },
  loading: { type: Boolean, default: false },
  dragging: { type: Boolean, default: false },
  errorCode: { type: String, default: "" },
  notice: { type: String, default: "" },
  courses: { type: Array as PropType<string[]>, required: true },
  branches: { type: Array as PropType<TjaChart[]>, required: true },
  chart: { type: Object as PropType<TjaChart | undefined>, default: undefined },
  selectedCourse: { type: String, default: "" },
  selectedBranch: { type: String, default: "" },
  errorText: { type: Function as PropType<(code: string) => string>, required: true },
  courseName: { type: Function as PropType<(course: string) => string>, required: true },
  branchName: { type: Function as PropType<(name: string) => string>, required: true },
  format: { type: Function as PropType<(value: number) => string>, required: true },
  /** element refs the page focuses and opens (the file input, the result heading) */
  inputRef: { type: Function as PropType<(el: unknown) => void>, required: true },
  headingRef: { type: Function as PropType<(el: unknown) => void>, required: true }
});
const emit = defineEmits<{
  "update:encoding": [value: string];
  "update:selectedBranch": [value: string];
  "update:dragging": [value: boolean];
  pick: [];
  input: [event: Event];
  drop: [event: DragEvent];
  calculate: [];
  cancel: [];
  download: [];
  course: [course: string];
}>();
const metricKeys = ["stamina", "handspeed", "burst", "complex", "rhythm"] as const;
const size = computed(() => (props.file ? `${(props.file.size / 1024).toFixed(1)} KB` : ""));
</script>

<template>
  <div class="calculator">
    <section class="upload-panel" :aria-label="copy.title" :aria-busy="loading">
      <input :ref="inputRef" hidden type="file" accept=".tja" :aria-label="copy.choose" :disabled="loading" @change="emit('input', $event)" />
      <div
        class="drop-zone"
        :class="{ dragging, selected: file }"
        @dragover.prevent="emit('update:dragging', !loading)"
        @dragleave.prevent="emit('update:dragging', false)"
        @drop.prevent="emit('drop', $event)"
      >
        <ReworkIcon name="upload" class="file-icon" />
        <h2 class="drop-zone__title">{{ file ? file.name : copy.drop }}</h2>
        <p class="drop-zone__meta">{{ file ? size : copy.limits }}</p>
        <button type="button" class="rw-btn" :disabled="loading" @click="emit('pick')">{{ file ? copy.change : copy.choose }}</button>
      </div>
      <div class="upload-controls">
        <label class="rw-field">
          <span class="rw-field__label">{{ copy.encoding }}</span>
          <select class="rw-select" :value="encoding" :disabled="loading" @change="emit('update:encoding', ($event.target as HTMLSelectElement).value)">
            <option value="auto">{{ copy.auto }}</option>
            <option value="utf-8-sig">UTF-8</option>
            <option value="cp932">Shift-JIS</option>
            <option value="gb18030">GB18030</option>
          </select>
        </label>
        <button type="button" class="rw-btn rw-btn--primary primary" :class="{ 'is-busy': loading }" :disabled="!file || loading" @click="emit('calculate')">
          {{ result || errorCode ? copy.retry : copy.start }}
        </button>
      </div>
      <p class="privacy">{{ copy.privacy }}</p>
      <div v-if="loading" class="loading-state" role="status">
        <strong>{{ copy.calculating }}</strong>
        <p>{{ copy.wait }}</p>
        <button type="button" class="rw-btn rw-btn--sm" @click="emit('cancel')">{{ copy.cancel }}</button>
      </div>
      <p v-if="errorCode" class="rw-alert error-message" role="alert">{{ errorText(errorCode) }}</p>
      <p class="status" role="status" aria-live="polite">{{ notice === "done" ? copy.done : notice === "cancelled" ? copy.cancelled : "" }}</p>
    </section>

    <section v-if="result" class="result-panel" :aria-label="copy.result">
      <div class="result-header">
        <div class="result-header__text">
          <span class="eyebrow">V2 · {{ copy.result }}</span>
          <h2 :ref="headingRef" tabindex="-1">{{ result.title || file?.name }}</h2>
        </div>
        <button type="button" class="rw-btn" @click="emit('download')"><ReworkIcon name="download" class="btn-icon" />{{ copy.download }}</button>
      </div>
      <div class="course-switch rw-seg" role="group" :aria-label="copy.course">
        <button v-for="course in courses" :key="course" type="button" :aria-pressed="selectedCourse === course" @click="emit('course', course)">{{ courseName(course) }}</button>
      </div>
      <div class="chart-meta">
        <label v-if="branches.length > 1" class="rw-field">
          <span class="rw-field__label">{{ copy.branch }}</span>
          <select class="rw-select" :value="selectedBranch" @change="emit('update:selectedBranch', ($event.target as HTMLSelectElement).value)">
            <option v-for="item in branches" :key="item.branch" :value="item.branch">{{ branchName(item.branch) }}</option>
          </select>
        </label>
        <span v-else>{{ branchName(selectedBranch) }}</span>
        <span>{{ copy.notes }} <strong class="num">{{ chart?.totalNotes.toLocaleString() }}</strong></span>
      </div>
      <p v-if="chart?.error" class="rw-alert error-message" role="status">{{ errorText(chart.error) }}</p>
      <template v-else-if="chart?.constants">
        <dl class="constant-summary">
          <div><dt>{{ copy.low }}</dt><dd class="num">{{ format(chart.constants.sub_constant_1) }}</dd></div>
          <div class="main-constant"><dt>{{ copy.main }}</dt><dd class="num">{{ format(chart.constants.main_constant) }}</dd></div>
          <div><dt>{{ copy.high }}</dt><dd class="num">{{ format(chart.constants.sub_constant_2) }}</dd></div>
        </dl>
        <h3>{{ copy.abilities }}</h3>
        <dl class="metrics">
          <div v-for="(key, index) in metricKeys" :key="key"><dt>{{ copy.metrics[index] }}</dt><dd class="num">{{ format(chart.constants[key]) }}</dd></div>
        </dl>
        <details v-if="chart.raw">
          <summary>{{ copy.raw }}</summary>
          <dl class="raw-metrics">
            <div v-for="(value, key) in chart.raw" :key="key"><dt>{{ key }}</dt><dd class="num">{{ Number(value).toFixed(4) }}</dd></div>
          </dl>
        </details>
      </template>
      <p class="reference">{{ copy.reference }}</p>
      <a class="rw-link source" href="https://github.com/OurTaiko/Constants" target="_blank" rel="noopener noreferrer">{{ copy.source }} ↗</a>
    </section>
    <slot />
  </div>
</template>

<style scoped>
.calculator {
  display: grid;
  gap: var(--sp-5);
  width: 100%;
  max-width: 960px;
  min-width: 0;
  font-family: var(--font-ui);
  color: var(--ink);
}
.upload-panel,
.result-panel {
  min-width: 0;
  padding: var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.drop-zone {
  display: grid;
  justify-items: center;
  gap: var(--sp-2);
  padding: var(--sp-6) var(--sp-4);
  border: 2px dashed var(--line-strong);
  border-radius: var(--r-panel);
  background: var(--bg-sunk);
  text-align: center;
}
.drop-zone.dragging,
.drop-zone:focus-within {
  border-color: var(--action-bg);
}
.file-icon {
  width: 36px;
  height: 36px;
  color: var(--ink-2);
}
.drop-zone__title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
  overflow-wrap: anywhere;
}
.drop-zone__meta {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.upload-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--sp-4);
  margin-top: var(--sp-4);
}
.privacy,
.reference {
  margin: var(--sp-3) 0 0;
  font-size: var(--fs-13);
  line-height: var(--lh-body);
  color: var(--ink-2);
}
.loading-state {
  display: grid;
  justify-items: start;
  gap: var(--sp-2);
  margin-top: var(--sp-4);
  padding: var(--sp-4);
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.loading-state p {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.error-message {
  margin-top: var(--sp-4);
}
.status {
  margin: var(--sp-3) 0 0;
  font-size: var(--fs-14);
}
.status:empty {
  display: none;
}
.result-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
.result-header__text {
  min-width: 0;
}
.eyebrow {
  font-size: var(--fs-12);
  letter-spacing: 0.06em;
  color: var(--ink-3);
}
.result-header h2 {
  margin: 4px 0 0;
  font-size: var(--fs-22);
  font-weight: 800;
  overflow-wrap: anywhere;
  scroll-margin-top: 100px;
}
.result-header h2:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.btn-icon {
  width: 16px;
  height: 16px;
  margin-right: 6px;
}
.course-switch {
  margin: var(--sp-4) 0 var(--sp-3);
}
.chart-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--sp-3);
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.chart-meta strong {
  margin-left: 6px;
  font-size: var(--fs-16);
  color: var(--ink);
}
.constant-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  gap: var(--sp-2);
  margin: var(--sp-5) 0;
  padding: var(--sp-5) var(--sp-2);
  border-radius: var(--r-panel);
  background: var(--bg-sunk);
  text-align: center;
}
.constant-summary dt {
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.constant-summary dd {
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-28);
  font-weight: 700;
}
.constant-summary .main-constant dd {
  font-size: var(--fs-36);
}
h3 {
  margin: var(--sp-5) 0 var(--sp-3);
  font-size: var(--fs-16);
}
.metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--sp-2);
  margin: 0;
}
.metrics > div {
  padding: var(--sp-3) var(--sp-2);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  text-align: center;
}
.metrics dt {
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.metrics dd {
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-22);
  font-weight: 600;
}
details {
  margin-top: var(--sp-4);
}
summary {
  display: flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-14);
  cursor: pointer;
}
.raw-metrics {
  margin: 0;
}
.raw-metrics > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--sp-2);
  padding: var(--sp-2) 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-13);
}
.raw-metrics dt {
  overflow-wrap: anywhere;
}
.raw-metrics dd {
  margin: 0;
}
.source {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-13);
}
@media (max-width: 767px) {
  .upload-panel,
  .result-panel {
    padding: var(--sp-4);
  }
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .metrics > div:last-child {
    grid-column: 1 / -1;
  }
  .upload-controls {
    align-items: stretch;
  }
  .upload-controls .rw-field,
  .upload-controls .primary {
    width: 100%;
  }
  .upload-controls .rw-select {
    width: 100%;
  }
  .result-header .rw-btn {
    width: 100%;
  }
  .constant-summary dd {
    font-size: var(--fs-22);
  }
  .constant-summary .main-constant dd {
    font-size: var(--fs-28);
  }
}
</style>
