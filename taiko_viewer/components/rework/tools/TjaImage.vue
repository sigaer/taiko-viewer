<script setup lang="ts">
// ReworkToolsTjaImage — the chart image part of /tools/tja-constants (slice F). Moved from components/tools/TjaChartImageTool.vue:
// the script is unchanged (the image is drawn in the browser by the tja-tools worker); only the markup and styles changed.
import type { TjaImageInfo, TjaImageResult } from '~/types/tja-image';
import { createTjaImageClient } from '~/utils/tjaImageClient';
import { tjaCalculatorCopy } from '~/utils/tjaCalculatorCopy';

const props = defineProps<{ file?: File; encoding: string; preferredCourse?: string }>();
const { locale } = useI18n();
// Copy table chosen by its own keys (zh / ja; anything else → zh), the same result as before the move.
const copy = computed(() => tjaCalculatorCopy[(locale.value in tjaCalculatorCopy ? locale.value : 'zh') as keyof typeof tjaCalculatorCopy]);
const info = shallowRef<TjaImageInfo>();
const image = shallowRef<TjaImageResult>();
const selected = ref(0);
const title = ref('');
const url = ref('');
const loading = ref(false);
const rendering = ref(false);
const error = ref('');
let revision = 0;
let client: ReturnType<typeof createTjaImageClient> | undefined;
const course = computed(() => info.value?.courses.find(item => item.index === selected.value));
const errorText = computed(() => copy.value.errors[error.value as keyof typeof copy.value.errors] || copy.value.errors.image_failed);
const filename = computed(() => {
  const name = (image.value?.title || props.file?.name.replace(/\.tja$/i, '') || 'tja').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 120);
  return `${name}-${course.value?.course || 'chart'}-${course.value?.side || 'single'}.png`;
});
function courseName(name: string) { return copy.value.courses[name as keyof typeof copy.value.courses] || name; }
function clearImage() {
  if (url.value) URL.revokeObjectURL(url.value);
  url.value = ''; image.value = undefined;
}
function preferCourse() {
  if (!info.value) return;
  const [name, side = 'single'] = (props.preferredCourse || 'oni').split('_');
  const match = info.value.courses.find(item => item.course === name && item.side === side);
  if (match) selected.value = match.index;
}
async function inspect() {
  const id = ++revision;
  client?.dispose(); client = undefined;
  clearImage(); info.value = undefined; error.value = ''; title.value = '';
  rendering.value = false; loading.value = false;
  if (!props.file) return;
  loading.value = true;
  try {
    const current = client = createTjaImageClient();
    const data = await current.request<TjaImageInfo>('inspect', { file: props.file, encoding: props.encoding });
    if (id !== revision) return;
    info.value = data; title.value = data.title;
    selected.value = data.courses[0].index; preferCourse();
  } catch (cause) {
    if (id === revision) error.value = cause instanceof Error ? cause.message : 'image_failed';
  } finally { if (id === revision) loading.value = false; }
}
async function render() {
  if (!client || !info.value || rendering.value || loading.value) return;
  const id = revision;
  const chosen = selected.value;
  const displayTitle = title.value;
  rendering.value = true; error.value = ''; clearImage();
  try {
    const result = await client.request<TjaImageResult>('render', { index: selected.value, title: title.value.trim() || info.value.title });
    if (id !== revision || chosen !== selected.value || displayTitle !== title.value) return;
    if (!(result.blob instanceof Blob) || result.blob.type !== 'image/png' || result.blob.size > 12 * 1024 * 1024) throw new Error('image_failed');
    image.value = result; url.value = URL.createObjectURL(result.blob);
  } catch (cause) {
    if (id === revision) error.value = cause instanceof Error ? cause.message : 'image_failed';
  } finally { if (id === revision) rendering.value = false; }
}
function cancel() {
  revision++; client?.dispose(); client = undefined;
  rendering.value = false; loading.value = false; error.value = 'image_cancelled';
}
watch(() => [props.file, props.encoding], inspect);
watch(() => props.preferredCourse, preferCourse);
watch([selected, title], clearImage);
onBeforeUnmount(() => { revision++; client?.dispose(); clearImage(); });
</script>

<template>
  <section v-if="file" class="image-tool" :aria-label="copy.image.title" :aria-busy="loading || rendering">
    <div class="image-header">
      <h2>{{ copy.image.title }}</h2>
      <span v-if="image" class="image-size num">{{ image.width }} × {{ image.height }} · {{ (image.bytes / 1024).toFixed(0) }} KB</span>
    </div>
    <ReworkState v-if="loading" kind="loading" :title="copy.image.reading" :lines="2" compact />
    <div v-if="info" class="image-controls">
      <label class="rw-field">
        <span class="rw-field__label">{{ copy.course }}</span>
        <select v-model="selected" class="rw-select" :disabled="rendering || !client">
          <option v-for="item in info.courses" :key="item.index" :value="item.index">{{ courseName(item.course) }} · {{ item.side === 'single' ? copy.image.single : item.side.toUpperCase() }} · ★{{ item.level }}</option>
        </select>
      </label>
      <label class="rw-field title-input">
        <span class="rw-field__label">{{ copy.image.displayTitle }}</span>
        <input v-model="title" class="rw-input" type="text" maxlength="200" :placeholder="info.title" :disabled="rendering || !client" />
      </label>
      <button type="button" class="rw-btn rw-btn--primary primary" :disabled="rendering || !client" @click="render">{{ image ? copy.image.again : copy.image.generate }}</button>
    </div>
    <div v-if="rendering" class="rendering" role="status">
      <span>{{ copy.image.rendering }}</span>
      <button type="button" class="rw-btn rw-btn--sm" @click="cancel">{{ copy.cancel }}</button>
    </div>
    <p v-if="error" class="rw-alert image-error" role="alert">{{ errorText }}</p>
    <button v-if="error" type="button" class="rw-btn reread" :disabled="loading || rendering" @click="inspect">{{ copy.image.reread }}</button>
    <template v-if="url && image">
      <div class="image-actions">
        <a class="rw-btn" :href="url" :download="filename"><ReworkIcon name="download" class="btn-icon" />{{ copy.image.download }}</a>
        <a class="rw-btn" :href="url" target="_blank" rel="noopener">{{ copy.image.open }} ↗</a>
      </div>
      <div class="image-preview" tabindex="0" role="region" :aria-label="copy.image.preview">
        <img :src="url" :width="image.width" :height="image.height" :alt="`${image.title} · ${courseName(course?.course || '')} · ${course?.side === 'single' ? copy.image.single : course?.side.toUpperCase()}`" />
      </div>
    </template>
    <a class="rw-link image-credit" href="https://github.com/WHMHammer/tja-tools" target="_blank" rel="noopener noreferrer">tja-tools ↗</a>
  </section>
</template>

<style scoped>
.image-tool {
  min-width: 0;
  padding: var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  font-family: var(--font-ui);
  color: var(--ink);
}
.image-header,
.image-actions,
.rendering {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
h2 {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
}
.image-size {
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.image-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) auto;
  align-items: end;
  gap: var(--sp-4);
  margin-top: var(--sp-4);
}
.image-controls .rw-select,
.image-controls .rw-input {
  width: 100%;
  min-width: 0;
}
.rendering {
  margin-top: var(--sp-4);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.image-error {
  margin-top: var(--sp-4);
}
.reread {
  margin-top: var(--sp-3);
}
.image-actions {
  justify-content: flex-start;
  margin: var(--sp-4) 0 var(--sp-3);
}
.btn-icon {
  width: 16px;
  height: 16px;
  margin-right: 6px;
}
.image-preview {
  max-height: 640px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.image-preview:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.image-preview img {
  display: block;
  width: 100%;
  height: auto;
}
.image-credit {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  margin-top: var(--sp-2);
  font-size: var(--fs-13);
}
@media (max-width: 767px) {
  .image-tool {
    padding: var(--sp-4);
  }
  .image-controls {
    grid-template-columns: minmax(0, 1fr);
  }
  .image-preview {
    max-height: 480px;
  }
}
</style>
