<script setup lang="ts">
import type { TjaResult } from '~/types/tja-calculator';
import { tjaCalculatorCopy } from '~/utils/tjaCalculatorCopy';

definePageMeta({ pageTitleKey: 'tools.tjaConstants', hidePageDescription: true, navKey: '/tools/tja-constants', hidePageHeader: true, breadcrumbs: [
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
// Presentation (slice F): the encoding select's former inline change handler, and the element refs the component sets.
function setEncoding(value: string) {
  encoding.value = value;
  result.value = undefined; notice.value = ''; selectedCourse.value = ''; selectedBranch.value = '';
}
const setInput = (el: unknown) => { input.value = (el as HTMLInputElement | null) || undefined; };
const setResultHeading = (el: unknown) => { resultHeading.value = (el as HTMLElement | null) || undefined; };
</script>

<template>
  <div class="rw-stack">
    <ReworkPageHeader :title="copy.title" />
    <ReworkToolsTjaConstants
      v-model:dragging="dragging"
      v-model:selected-branch="selectedBranch"
      :copy="copy"
      :file="file"
      :encoding="encoding"
      :result="result"
      :loading="loading"
      :error-code="errorCode"
      :notice="notice"
      :courses="courses"
      :branches="branches"
      :chart="chart"
      :selected-course="selectedCourse"
      :error-text="errorText"
      :course-name="courseName"
      :branch-name="branchName"
      :format="format"
      :input-ref="setInput"
      :heading-ref="setResultHeading"
      @update:encoding="setEncoding"
      @pick="input?.click()"
      @input="onInput"
      @drop="onDrop"
      @calculate="calculate"
      @cancel="cancel"
      @download="download"
      @course="selectCourse"
    >
      <ReworkToolsTjaImage :file="file" :encoding="encoding" :preferred-course="selectedCourse" />
    </ReworkToolsTjaConstants>
  </div>
</template>
