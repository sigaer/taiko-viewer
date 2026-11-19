<script setup lang="ts">
import type { TjaResult } from '~/types/tja-calculator';
import { tjaCalculatorCopy } from '~/utils/tjaCalculatorCopy';

definePageMeta({ pageTitleKey: 'tools.tjaConstants', hidePageDescription: true, navKey: '/tools/tja-constants', breadcrumbs: [
  { labelKey: 'nav.more', to: '/more' }, { labelKey: 'tools.tjaConstants', to: '/tools/tja-constants' }
] });
const { locale } = useI18n();
const copy = computed(() => tjaCalculatorCopy[locale.value === 'ja' ? 'ja' : 'zh']);
useViewerSeo(() => ({ title: copy.value.title, description: copy.value.title, path: '/tools/tja-constants' }));
const input = ref<HTMLInputElement>();
const resultHeading = ref<HTMLElement>();
const file = shallowRef<File>();
const encoding = ref('auto');
const result = shallowRef<TjaResult>();
const loading = ref(false);
const dragging = ref(false);
const errorCode = ref('');
const notice = ref('');
const selectedCourse = ref('');
const selectedBranch = ref('');
let controller: AbortController | undefined;
let requestId = 0;
const courses = computed(() => [...new Set(result.value?.charts.map(c => c.course) || [])]);
const branches = computed(() => result.value?.charts.filter(c => c.course === selectedCourse.value) || []);
const chart = computed(() => branches.value.find(c => c.branch === selectedBranch.value));
const metricKeys = ['stamina', 'handspeed', 'burst', 'complex', 'rhythm'] as const;
const errorText = (code: string) => copy.value.errors[code as keyof typeof copy.value.errors] || copy.value.errors.unavailable;
const courseName = (course: string) => {
  const [name, side] = course.split('_');
  return (copy.value.courses[name as keyof typeof copy.value.courses] || name) + (side === 'p1' || side === 'p2' ? ` · ${side.toUpperCase()}` : '');
};
const branchName = (name: string) => copy.value.branches[name as keyof typeof copy.value.branches] || name;
const format = (value: number) => value.toFixed(2);
function selectCourse(course: string) {
  selectedCourse.value = course;
  const choices = result.value?.charts.filter(c => c.course === course) || [];
  selectedBranch.value = choices.find(c => c.branch === 'master')?.branch || choices[0]?.branch || '';
}
function selectFile(files: FileList | File[] | null) {
  if (loading.value || !files?.length) return;
  result.value = undefined; errorCode.value = ''; notice.value = ''; file.value = undefined;
  selectedCourse.value = ''; selectedBranch.value = '';
  if (files.length !== 1) { errorCode.value = 'file_count'; return; }
  const candidate = files[0];
  if (!/\.tja$/i.test(candidate.name)) { errorCode.value = 'file_type'; return; }
  if (!candidate.size || candidate.size > 512 * 1024) { errorCode.value = 'file_size'; return; }
  file.value = candidate;
}
function onInput(event: Event) {
  const el = event.target as HTMLInputElement;
  selectFile(el.files); el.value = '';
}
function onDrop(event: DragEvent) { dragging.value = false; selectFile(event.dataTransfer?.files || null); }
function cancel() {
  requestId++; controller?.abort(); loading.value = false; notice.value = 'cancelled';
}
async function calculate() {
  if (!file.value || loading.value) return;
  const id = ++requestId;
  controller = new AbortController();
  const abort = controller;
  const timer = setTimeout(() => abort.abort(), 35_000);
  loading.value = true; errorCode.value = ''; notice.value = ''; result.value = undefined;
  try {
    const data = await $fetch<TjaResult>('/api/tools/tja-constants', {
      method: 'POST', body: file.value, signal: abort.signal, retry: 0,
      headers: { 'Content-Type': 'application/octet-stream', 'x-tja-encoding': encoding.value }
    });
    if (id !== requestId) return;
    result.value = data;
    selectCourse(data.charts.find(c => c.course === 'oni')?.course || data.charts[0].course);
    notice.value = 'done';
    await nextTick();
    resultHeading.value?.focus({ preventScroll: true });
    resultHeading.value?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  } catch (error: any) {
    if (id !== requestId) return;
    errorCode.value = abort.signal.aborted ? 'timeout' : error.statusCode === 429 ? 'rate_limit' : error.data?.data?.code || 'upload_failed';
  } finally { clearTimeout(timer); if (id === requestId) loading.value = false; }
}
function download() {
  if (!result.value) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(result.value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url;
  link.download = (file.value?.name.replace(/\.tja$/i, '') || 'tja') + '-constants.json';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
onBeforeUnmount(() => { requestId++; controller?.abort(); });
</script>

<template>
  <div class="calculator">
    <section class="upload-panel" :aria-label="copy.title" :aria-busy="loading">
      <input ref="input" hidden type="file" accept=".tja" :aria-label="copy.choose" :disabled="loading" @change="onInput" />
      <div class="drop-zone" :class="{ dragging, selected: file }" @dragover.prevent="dragging = !loading" @dragleave.prevent="dragging = false" @drop.prevent="onDrop">
        <svg aria-hidden="true" viewBox="0 0 48 48" class="file-icon" fill="none" stroke="currentColor" stroke-width="2"><path d="M28 6H12a2 2 0 0 0-2 2v32a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V16L28 6Z M28 6v10h10 M18 25h12 M18 31h8" /></svg>
        <h2>{{ file ? file.name : copy.drop }}</h2>
        <p>{{ file ? `${(file.size / 1024).toFixed(1)} KB` : copy.limits }}</p>
        <button type="button" class="secondary" :disabled="loading" @click="input?.click()">{{ file ? copy.change : copy.choose }}</button>
      </div>
      <div class="upload-controls">
        <label>{{ copy.encoding }}<select v-model="encoding" :disabled="loading" @change="result = undefined; notice = ''; selectedCourse = ''; selectedBranch = ''">
          <option value="auto">{{ copy.auto }}</option><option value="utf-8-sig">UTF-8</option><option value="cp932">Shift-JIS</option><option value="gb18030">GB18030</option>
        </select></label>
        <button type="button" class="primary" :disabled="!file || loading" @click="calculate">{{ result || errorCode ? copy.retry : copy.start }}</button>
      </div>
      <p class="privacy">{{ copy.privacy }}</p>
      <div v-if="loading" class="loading-state" role="status">
        <strong>{{ copy.calculating }}</strong><p>{{ copy.wait }}</p>
        <button type="button" class="secondary" @click="cancel">{{ copy.cancel }}</button>
      </div>
      <p v-if="errorCode" class="error-message" role="alert">{{ errorText(errorCode) }}</p>
      <p class="status" role="status" aria-live="polite">{{ notice === 'done' ? copy.done : notice === 'cancelled' ? copy.cancelled : '' }}</p>
    </section>

    <section v-if="result" class="result-panel" :aria-label="copy.result">
      <div class="result-header"><div><span class="eyebrow">V2 · {{ copy.result }}</span><h2 ref="resultHeading" tabindex="-1">{{ result.title || file?.name }}</h2></div>
        <button type="button" class="secondary" @click="download">{{ copy.download }}</button>
      </div>
      <div class="course-switch" role="group" :aria-label="copy.course">
        <button v-for="course in courses" :key="course" type="button" :aria-pressed="selectedCourse === course" @click="selectCourse(course)">{{ courseName(course) }}</button>
      </div>
      <div class="chart-meta"><label v-if="branches.length > 1">{{ copy.branch }}<select v-model="selectedBranch"><option v-for="item in branches" :key="item.branch" :value="item.branch">{{ branchName(item.branch) }}</option></select></label>
        <span v-else>{{ branchName(selectedBranch) }}</span><span>{{ copy.notes }} <strong>{{ chart?.totalNotes.toLocaleString() }}</strong></span>
      </div>
      <p v-if="chart?.error" class="error-message" role="status">{{ errorText(chart.error) }}</p>
      <template v-else-if="chart?.constants">
        <dl class="constant-summary">
          <div><dt>{{ copy.low }}</dt><dd>{{ format(chart.constants.sub_constant_1) }}</dd></div>
          <div class="main-constant"><dt>{{ copy.main }}</dt><dd>{{ format(chart.constants.main_constant) }}</dd></div>
          <div><dt>{{ copy.high }}</dt><dd>{{ format(chart.constants.sub_constant_2) }}</dd></div>
        </dl>
        <h3>{{ copy.abilities }}</h3>
        <dl class="metrics"><div v-for="(key, index) in metricKeys" :key="key"><dt>{{ copy.metrics[index] }}</dt><dd>{{ format(chart.constants[key]) }}</dd></div></dl>
        <details v-if="chart.raw"><summary>{{ copy.raw }}</summary><dl class="raw-metrics"><div v-for="(value, key) in chart.raw" :key="key"><dt>{{ key }}</dt><dd>{{ Number(value).toFixed(4) }}</dd></div></dl></details>
      </template>
      <p class="reference">{{ copy.reference }}</p>
      <a href="https://github.com/OurTaiko/Constants" target="_blank" rel="noopener noreferrer">{{ copy.source }} ↗</a>
    </section>
    <ToolsTjaChartImageTool :file="file" :encoding="encoding" :preferred-course="selectedCourse" />
  </div>
</template>

<style scoped>
.calculator { display: grid; gap: 24px; width: 100%; max-width: 960px; margin-inline: auto; color: var(--viewer-text); }
.upload-panel, .result-panel { padding: clamp(18px, 3vw, 32px); border: 1px solid var(--viewer-border); border-radius: 20px; background: var(--viewer-surface); min-width: 0; }
.drop-zone { padding: 28px 16px; text-align: center; border: 2px dashed var(--viewer-border); border-radius: 14px; background: var(--viewer-surface-subtle); transition: border-color .15s; }
.drop-zone.dragging, .drop-zone:focus-within { border-color: var(--viewer-link); }
.file-icon { width: 44px; height: 44px; color: var(--viewer-link); }
h2 { margin: 10px 0; font-size: 21px; overflow-wrap: anywhere; }
.result-header h2 { scroll-margin-top: 100px; }
p { line-height: 1.6; }
.drop-zone p, .privacy, .reference, .eyebrow, .chart-meta { color: var(--viewer-text-muted); }
button, select { font: inherit; min-height: 44px; border: 1px solid var(--viewer-control-border); border-radius: 10px; padding: 9px 16px; color: var(--viewer-text); background: var(--viewer-surface); }
button { cursor: pointer; font-weight: 600; }
button:hover:not(:disabled) { border-color: var(--viewer-link); }
button:disabled { opacity: .55; cursor: not-allowed; }
button:focus-visible, select:focus-visible, summary:focus-visible, a:focus-visible { outline: 2px solid var(--viewer-link); outline-offset: 4px; }
.primary { background: var(--viewer-text); color: var(--viewer-surface); padding-inline: 28px; }
.upload-controls { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 16px; margin-top: 20px; }
label { display: flex; align-items: center; gap: 12px; font-size: 14px; }
.privacy, .reference { font-size: 13px; margin-bottom: 0; }
.status { margin: 12px 0 0; font-size: 14px; }.status:empty { display: none; }
.loading-state { padding: 20px; margin-top: 20px; background: var(--viewer-surface-subtle); border-radius: 12px; }
.loading-state p { margin-top: 8px; font-size: 14px; }
.error-message { border-left: 3px solid var(--viewer-error); color: var(--viewer-error); background: var(--viewer-error-surface); padding: 14px 16px; border-radius: 4px; }
.result-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }.result-header > div { min-width: 0; }
.eyebrow { font-size: 12px; letter-spacing: .06em; }
.course-switch { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 16px; }
.course-switch [aria-pressed=true] { color: var(--viewer-surface); background: var(--viewer-text); border-color: var(--viewer-text); }
.chart-meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; font-size: 14px; }
.chart-meta strong { color: var(--viewer-text); margin-left: 8px; font-variant-numeric: tabular-nums; }
.constant-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); text-align: center; align-items: center; gap: 8px; padding: 30px 8px; margin: 22px 0; background: var(--viewer-surface-subtle); border-radius: 14px; }
.constant-summary dt { color: var(--viewer-text-muted); font-size: 13px; }.constant-summary dd { margin: 10px 0 0; font-size: clamp(22px, 4vw, 32px); font-weight: 700; font-variant-numeric: tabular-nums; }
.constant-summary .main-constant dd { font-size: clamp(30px, 5vw, 46px); color: var(--viewer-link); }
h3 { font-size: 15px; margin: 24px 0 14px; }
.metrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }.metrics > div { padding: 16px 8px; border: 1px solid var(--viewer-border); border-radius: 12px; text-align: center; }
.metrics dt { color: var(--viewer-text-muted); font-size: 13px; }.metrics dd { margin: 10px 0 0; font-size: 22px; font-weight: 650; font-variant-numeric: tabular-nums; }
details { margin-top: 24px; }summary { cursor: pointer; padding-block: 12px; min-height: 44px; box-sizing: border-box; font-size: 14px; }
.raw-metrics > div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; border-bottom: 1px solid var(--viewer-border); padding-block: 8px; font-size: 13px; }.raw-metrics dd { margin: 0; }
.result-panel a { display: inline-block; padding-block: 12px; color: var(--viewer-link); font-size: 13px; text-underline-offset: 4px; }
@media (max-width: 540px) { .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }.metrics > div:last-child { grid-column: 1 / -1; }.upload-controls { align-items: stretch; }.upload-controls label, .upload-controls .primary { width: 100%; }.upload-controls select { flex: 1; }.result-header .secondary { width: 100%; } }
@media (prefers-reduced-motion: reduce) { .drop-zone { transition: none; } }
</style>
