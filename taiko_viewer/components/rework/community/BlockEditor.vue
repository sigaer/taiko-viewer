<script setup lang="ts">
// ReworkCommunityBlockEditor — the body of a thread being edited, block by block in its stored order: a paragraph is
// a text area (4000 characters, as on create), an image is a preview with its caption (120) and a remove button.
// "Add paragraph" appends an empty paragraph; new images come from the page's upload control in the `upload` slot and
// are appended by the page. Blocks are edited in place on the page's array (v-model:blocks).
import type { PropType } from "vue";
import type { EditableBlock } from "~/utils/rework/community";

const props = defineProps({
  blocks: { type: Array as PropType<EditableBlock[]>, required: true },
  disabled: { type: Boolean, default: false },
  uploading: { type: Boolean, default: false },
  uploadCount: { type: Number, default: 0 }
});
const emit = defineEmits<{ add: []; remove: [index: number] }>();
const { t } = useI18n();
const paragraphNo = (index: number) => props.blocks.slice(0, index + 1).filter((block) => block.type === "paragraph").length;
const imageNo = (index: number) => props.blocks.slice(0, index + 1).filter((block) => block.type === "image").length;
</script>

<template>
  <section class="cbe">
    <span class="rw-field__label">{{ t("rework.forum.compose.paragraphs") }}</span>
    <ol class="cbe__list">
      <li v-for="(block, index) in blocks" :key="block.key" class="cbe__item" :class="`is-${block.type}`">
        <template v-if="block.type === 'paragraph'">
          <textarea
            v-model="block.text"
            class="rw-input rw-textarea cbe__text"
            rows="5"
            maxlength="4000"
            :disabled="disabled"
            :aria-label="t('rework.forum.compose.paragraphN', { n: paragraphNo(index) })"
          />
          <span class="cbe__foot">
            <span class="rw-count num">{{ block.text.length }} / 4000</span>
            <button type="button" class="rw-btn rw-btn--sm rw-btn--ghost" :disabled="disabled" @click="emit('remove', index)"><ReworkIcon name="trash" />{{ t("rework.forum.compose.remove") }}</button>
          </span>
        </template>
        <template v-else>
          <span class="cbe__image">
            <ReworkCommunityMedia :src="block.imageUrl" :alt="block.caption || t('rework.forum.compose.imageN', { n: imageNo(index) })" />
          </span>
          <span class="cbe__side">
            <input
              v-model="block.caption"
              class="rw-input"
              maxlength="120"
              :disabled="disabled"
              :placeholder="t('rework.forum.compose.imageCaptionPlaceholder')"
              :aria-label="`${t('rework.forum.compose.imageCaption')} ${imageNo(index)}`"
            />
            <button type="button" class="rw-btn rw-btn--sm rw-btn--ghost" :disabled="disabled" :aria-label="`${t('rework.forum.compose.remove')} ${t('rework.forum.compose.imageN', { n: imageNo(index) })}`" @click="emit('remove', index)">
              <ReworkIcon name="trash" />{{ t("rework.forum.compose.remove") }}
            </button>
          </span>
        </template>
      </li>
    </ol>
    <div class="cbe__add">
      <button type="button" class="rw-btn" :disabled="disabled" @click="emit('add')"><ReworkIcon name="plus" />{{ t("rework.forum.compose.addParagraph") }}</button>
      <slot name="upload" />
      <span v-if="uploading" class="rw-count" role="status">{{ t("rework.forum.compose.uploadingImages", { count: uploadCount }) }}</span>
    </div>
  </section>
</template>

<style scoped>
.cbe {
  display: grid;
  gap: var(--sp-2);
  min-width: 0;
  font-family: var(--font-ui);
}
.cbe__list {
  display: grid;
  gap: var(--sp-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.cbe__item {
  display: grid;
  gap: var(--sp-1);
  min-width: 0;
}
.cbe__item.is-image {
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: start;
  gap: var(--sp-3);
  padding: var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  background: var(--surface-2);
}
.cbe__text {
  width: 100%;
  box-sizing: border-box;
}
.cbe__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}
.cbe__foot :deep(svg),
.cbe__side :deep(svg),
.cbe__add :deep(svg) {
  width: 16px;
  height: 16px;
}
.cbe__image {
  display: block;
  aspect-ratio: 1;
  border-radius: var(--r-ctl);
  overflow: hidden;
  background: var(--bg-sunk);
}
.cbe__image :deep(.cmd) {
  height: 100%;
}
.cbe__image :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.cbe__side {
  display: grid;
  gap: var(--sp-2);
  justify-items: start;
  min-width: 0;
}
.cbe__side .rw-input {
  width: 100%;
  box-sizing: border-box;
}
.cbe__add {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2) var(--sp-3);
}
@media (max-width: 767px) {
  .cbe__item.is-image {
    grid-template-columns: 88px minmax(0, 1fr);
  }
}
</style>
