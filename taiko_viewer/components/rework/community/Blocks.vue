<script setup lang="ts">
// ReworkCommunityBlocks — the content blocks of a thread or a reply, rendered as before: a paragraph is plain text
// (white-space kept, never HTML), an image opens the media viewer (`open` with its URL and the click event, so focus
// returns to the trigger). `priorityIndex` loads that image eagerly (the first image of the thread body).
// Line breaks inside a paragraph: kept in replies, collapsed in the thread body — exactly as the page rendered them
// before (the old .thread-content p had no pre-wrap; replies had). Rendering of content is frozen in this slice.
import type { PropType } from "vue";
import type { ForumContentBlock } from "~/types/forum";

defineProps({
  blocks: { type: Array as PropType<ForumContentBlock[]>, required: true },
  /** accessible name of an image trigger: "<viewer label>: <alt>" */
  viewerLabel: { type: String, required: true },
  /** alt text when a block has none */
  fallbackAlt: { type: String, default: "" },
  priorityIndex: { type: Number, default: -1 },
  /** the thread body: reading size; replies are one step smaller */
  body: { type: Boolean, default: false }
});
const emit = defineEmits<{ open: [url: string, event: MouseEvent]; failed: [url: string] }>();
const { t } = useI18n();
// An image that fails to load is replaced by a neutral placeholder in its place (never another picture) and is not a
// viewer trigger; the page also leaves it out of the media viewer (`failed`).
const failedUrls = ref<string[]>([]);
const onFailed = (url: string) => {
  if (!failedUrls.value.includes(url)) failedUrls.value = [...failedUrls.value, url];
  emit("failed", url);
};
</script>

<template>
  <div class="cb" :class="{ 'is-body': body }">
    <template v-for="(block, index) in blocks" :key="`${block.type}-${index}`">
      <p v-if="block.type === 'paragraph'" class="cb__p">{{ block.text }}</p>
      <figure v-else class="cb__figure">
        <span v-if="!block.imageUrl || failedUrls.includes(block.imageUrl)" class="cb__failed" role="img" :aria-label="t('rework.forum.imageFailed')">
          <ReworkIcon name="image" /><span aria-hidden="true">{{ t("rework.forum.imageFailed") }}</span>
        </span>
        <button
          v-else
          type="button"
          class="cb__trigger"
          :aria-label="`${viewerLabel}: ${block.alt || block.caption || fallbackAlt}`"
          @click="emit('open', block.imageUrl || '', $event)"
        >
          <ReworkCommunityMedia :src="block.imageUrl" :alt="block.alt || block.caption || fallbackAlt" :priority="index === priorityIndex" @failed="onFailed" />
        </button>
        <figcaption v-if="block.caption" class="cb__caption">{{ block.caption }}</figcaption>
      </figure>
    </template>
  </div>
</template>

<style scoped>
.cb {
  display: grid;
  gap: var(--sp-3);
  min-width: 0;
  font-size: var(--fs-14);
  line-height: 1.8;
  color: var(--ink);
}
.cb:not(.is-body) .cb__p {
  white-space: pre-wrap;
}
.cb.is-body {
  gap: var(--sp-5);
  font-size: var(--fs-16);
  line-height: 1.85;
}
.cb__p {
  margin: 0;
  overflow-wrap: anywhere;
  line-break: strict;
}
.cb__figure {
  display: grid;
  gap: var(--sp-2);
  margin: 0;
  min-width: 0;
}
.cb__trigger {
  display: block;
  width: fit-content;
  max-width: 100%;
  padding: 0;
  border: 0;
  border-radius: var(--r-panel);
  background: transparent;
  cursor: zoom-in;
}
.cb:not(.is-body) .cb__trigger {
  margin: 0;
}
.is-body .cb__trigger {
  margin: 0 auto;
}
.cb__trigger:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 4px;
}
.cb__trigger :deep(img) {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: min(80vh, 900px);
  border-radius: var(--r-panel);
  object-fit: contain;
  background: transparent;
}
.cb:not(.is-body) .cb__trigger :deep(img) {
  max-height: 420px;
}
.cb__failed {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  width: min(100%, 360px);
  min-height: 120px;
  padding: var(--sp-4);
  box-sizing: border-box;
  border: 1px dashed var(--line-strong);
  border-radius: var(--r-panel);
  background: var(--bg-sunk);
  color: var(--ink-3);
  font-size: var(--fs-13);
}
.is-body .cb__failed {
  margin: 0 auto;
}
.cb__failed :deep(svg) {
  width: 20px;
  height: 20px;
}
.cb__caption {
  font-size: var(--fs-13);
  line-height: var(--lh-body);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.is-body .cb__failed {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  width: min(100%, 360px);
  min-height: 120px;
  padding: var(--sp-4);
  box-sizing: border-box;
  border: 1px dashed var(--line-strong);
  border-radius: var(--r-panel);
  background: var(--bg-sunk);
  color: var(--ink-3);
  font-size: var(--fs-13);
}
.is-body .cb__failed {
  margin: 0 auto;
}
.cb__failed :deep(svg) {
  width: 20px;
  height: 20px;
}
.cb__caption {
  text-align: center;
}
</style>
