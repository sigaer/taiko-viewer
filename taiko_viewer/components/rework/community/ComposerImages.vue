<script setup lang="ts">
// ReworkCommunityComposerImages — the composer's uploaded images: preview, remove, and an optional caption each
// (the caption is edited in place on the page's image object, as before). The upload control itself is the page's
// el-upload (its request and size check are unchanged), passed in the default slot as the last tile.
import type { PropType } from "vue";

defineProps({
  images: { type: Array as PropType<{ imageUrl: string; caption: string }[]>, required: true },
  disabled: { type: Boolean, default: false },
  uploading: { type: Boolean, default: false },
  uploadCount: { type: Number, default: 0 }
});
const emit = defineEmits<{ remove: [index: number] }>();
const { t } = useI18n();
</script>

<template>
  <div class="cim">
    <span class="rw-field__label">{{ t("rework.forum.compose.images") }}</span>
    <ul class="cim__grid composer-media-grid" :aria-label="t('rework.forum.compose.images')" :aria-busy="uploading">
      <li v-for="(image, index) in images" :key="image.imageUrl" class="cim__item composer-image">
        <span class="cim__preview">
          <img :src="image.imageUrl" :alt="image.caption || t('rework.forum.compose.imageN', { n: index + 1 })" />
          <button type="button" class="cim__rm composer-image__remove" :disabled="disabled" :aria-label="`${t('rework.forum.compose.remove')} ${t('rework.forum.compose.imageN', { n: index + 1 })}`" @click="emit('remove', index)">
            <ReworkIcon name="close" />
          </button>
        </span>
        <details class="cim__caption composer-image__caption">
          <summary>{{ image.caption ? image.caption : t("rework.forum.compose.imageCaption") }}</summary>
          <textarea
            v-model="image.caption"
            class="rw-input rw-textarea"
            rows="3"
            maxlength="120"
            :disabled="disabled"
            :placeholder="t('rework.forum.compose.imageCaptionPlaceholder')"
            :aria-label="`${t('rework.forum.compose.imageCaptionPlaceholder')} ${index + 1}`"
          />
        </details>
      </li>
      <li class="cim__item cim__add"><slot /></li>
    </ul>
    <p v-if="uploading" class="cim__status composer-upload-status" role="status">{{ t("rework.forum.compose.uploadingImages", { count: uploadCount }) }}</p>
  </div>
</template>

<style scoped>
.cim {
  display: grid;
  gap: 6px;
  min-width: 0;
  font-family: var(--font-ui);
}
.cim__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  align-items: start;
  gap: var(--sp-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.cim__item {
  min-width: 0;
}
.cim__preview {
  position: relative;
  display: block;
  aspect-ratio: 1;
  border-radius: var(--r-ctl);
  overflow: hidden;
  background: var(--bg-sunk);
}
.cim__preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.cim__rm {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  place-items: center;
  width: var(--hit);
  height: var(--hit);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}
.cim__rm :deep(svg) {
  width: 20px;
  height: 20px;
  padding: 3px;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 0 0 1px var(--line);
}
.cim__rm:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -4px;
}
.cim__rm:disabled {
  cursor: not-allowed;
  color: var(--ink-3);
}
.cim__caption summary {
  display: flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-13);
  color: var(--ink-2);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cim__caption summary:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.cim__caption textarea {
  width: 100%;
}
.cim__add {
  aspect-ratio: 1;
}
.cim__add :deep(.composer-image-upload),
.cim__add :deep(.el-upload) {
  display: block;
  width: 100%;
  height: 100%;
}
.cim__add :deep(.composer-image-upload__trigger) {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 1px dashed var(--ctl-border);
  border-radius: var(--r-ctl);
  background: transparent;
  color: var(--ink-2);
  cursor: pointer;
}
.cim__add :deep(.composer-image-upload__trigger:hover) {
  background: var(--bg-sunk);
  color: var(--link);
}
.cim__add :deep(.composer-image-upload__trigger:focus-visible) {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.cim__add :deep(.composer-image-upload__trigger:disabled) {
  cursor: not-allowed;
  color: var(--ink-3);
}
.cim__add :deep(svg) {
  width: 28px;
  height: 28px;
}
.cim__status {
  margin: 0;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
</style>
