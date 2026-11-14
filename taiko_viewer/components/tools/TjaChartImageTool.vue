<script setup lang="ts">
import type { TjaImageInfo, TjaImageResult } from '~/types/tja-image';
import { createTjaImageClient } from '~/utils/tjaImageClient';
import { tjaCalculatorCopy } from '~/utils/tjaCalculatorCopy';

const props = defineProps<{ file?: File; encoding: string; preferredCourse?: string }>();
const { locale } = useI18n();
const copy = computed(() => tjaCalculatorCopy[locale.value === 'ja' ? 'ja' : 'zh']);
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
    <div class="image-header"><h2>{{ copy.image.title }}</h2><span v-if="image" class="image-size">{{ image.width }} × {{ image.height }} · {{ (image.bytes / 1024).toFixed(0) }} KB</span></div>
    <p v-if="loading" role="status">{{ copy.image.reading }}</p>
    <div v-if="info" class="image-controls">
      <label>{{ copy.course }}<select v-model="selected" :disabled="rendering || !client">
        <option v-for="item in info.courses" :key="item.index" :value="item.index">{{ courseName(item.course) }} · {{ item.side === 'single' ? copy.image.single : item.side.toUpperCase() }} · ★{{ item.level }}</option>
      </select></label>
      <label class="title-input">{{ copy.image.displayTitle }}<input v-model="title" type="text" maxlength="200" :placeholder="info.title" :disabled="rendering || !client" /></label>
      <button type="button" class="primary" :disabled="rendering || !client" @click="render">{{ image ? copy.image.again : copy.image.generate }}</button>
    </div>
    <div v-if="rendering" class="rendering" role="status"><span>{{ copy.image.rendering }}</span><button type="button" @click="cancel">{{ copy.cancel }}</button></div>
    <p v-if="error" class="image-error" role="alert">{{ errorText }}</p>
    <button v-if="error" type="button" :disabled="loading || rendering" @click="inspect">{{ copy.image.reread }}</button>
    <template v-if="url && image">
      <div class="image-actions"><a :href="url" :download="filename">{{ copy.image.download }}</a><a :href="url" target="_blank" rel="noopener">{{ copy.image.open }} ↗</a></div>
      <div class="image-preview" tabindex="0" role="region" :aria-label="copy.image.preview"><img :src="url" :width="image.width" :height="image.height" :alt="`${image.title} · ${courseName(course?.course || '')} · ${course?.side === 'single' ? copy.image.single : course?.side.toUpperCase()}`" /></div>
    </template>
    <a class="image-credit" href="https://github.com/WHMHammer/tja-tools" target="_blank" rel="noopener noreferrer">tja-tools ↗</a>
  </section>
</template>

<style scoped>
.image-tool { min-width: 0; padding: clamp(18px, 3vw, 32px); border: 1px solid var(--viewer-border); border-radius: 20px; background: var(--viewer-surface); }
.image-header, .image-actions, .rendering { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
h2 { font-size: 21px; margin: 0; }.image-size { color: var(--viewer-text-muted); font-size: 13px; }
.image-controls { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) auto; gap: 16px; align-items: end; margin-top: 24px; }
label { display: flex; flex-direction: column; gap: 8px; font-size: 14px; min-width: 0; }
button, select, input { box-sizing: border-box; min-width: 0; max-width: 100%; min-height: 44px; padding: 9px 12px; border: 1px solid var(--viewer-control-border); border-radius: 10px; color: var(--viewer-text); background: var(--viewer-surface); font: inherit; }
button { cursor: pointer; font-weight: 600; }button:disabled { opacity: .55; cursor: not-allowed; }
.primary { color: var(--viewer-surface); background: var(--viewer-text); }
button:hover:not(:disabled), .image-actions a:hover { border-color: var(--viewer-link); }
:is(button, select, input, a, .image-preview):focus-visible { outline: 2px solid var(--viewer-link); outline-offset: 4px; }
.rendering { margin-top: 20px; padding: 16px; border-radius: 12px; background: var(--viewer-surface-subtle); }
.image-error { line-height: 1.6; padding: 14px 16px; border-left: 3px solid var(--viewer-error); color: var(--viewer-error); background: var(--viewer-error-surface); }
.image-actions { justify-content: start; margin-block: 20px 12px; }
.image-actions a { min-height: 44px; box-sizing: border-box; padding: 12px 16px; border: 1px solid var(--viewer-control-border); border-radius: 10px; color: var(--viewer-link); text-decoration: none; font-size: 14px; }
.image-preview { overflow: auto; max-height: 640px; border: 1px solid var(--viewer-border); border-radius: 12px; background: var(--viewer-surface-subtle); }
.image-preview img { display: block; width: 100%; height: auto; }
.image-credit { display: inline-flex; align-items: center; min-height: 44px; color: var(--viewer-link); font-size: 13px; text-underline-offset: 4px; margin-top: 12px; }
@media (max-width: 700px) { .image-controls { grid-template-columns: minmax(0, 1fr); }.image-preview { max-height: 480px; } }
</style>
