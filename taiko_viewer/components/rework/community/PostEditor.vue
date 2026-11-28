<script setup lang="ts">
// ReworkCommunityPostEditor — edits one's own reply in place: its text (1000 characters, as the reply box) and the
// images it already has (each can be removed; adding images is the reply box's job). Only emits: the page posts
// /api/forum/posts/:id/edit and replaces the thread with the response, as after a new reply.
import type { PropType } from "vue";
import type { ForumContentBlock } from "~/types/forum";

const props = defineProps({
  blocks: { type: Array as PropType<ForumContentBlock[]>, required: true },
  saving: { type: Boolean, default: false }
});
const emit = defineEmits<{ save: [payload: { bodyText: string; images: string[] }]; cancel: [] }>();
const { t } = useI18n();
const fieldId = useId();
const field = ref<HTMLTextAreaElement | null>(null);
const body = ref(
  props.blocks
    .filter((block): block is Extract<ForumContentBlock, { type: "paragraph" }> => block.type === "paragraph")
    .map((block) => block.text)
    .join("\n")
);
const images = ref(props.blocks.filter((block) => block.type === "image").map((block) => (block as { imageUrl: string }).imageUrl));
const empty = computed(() => !body.value.trim() && !images.value.length);
onMounted(() => field.value?.focus());
</script>

<template>
  <form class="cpe" @submit.prevent="!empty && emit('save', { bodyText: body, images })">
    <label :for="fieldId" class="rw-vh">{{ t("rework.forum.tools.editReply") }}</label>
    <textarea :id="fieldId" ref="field" v-model="body" class="rw-input rw-textarea cpe__field" rows="4" maxlength="1000" :disabled="saving" />
    <div v-if="images.length" class="cpe__images">
      <span v-for="(url, index) in images" :key="`${url}-${index}`" class="cpe__tile">
        <ReworkCommunityMedia :src="url" alt="" />
        <button type="button" class="cpe__rm" :aria-label="`${t('rework.forum.thread.remove')} ${index + 1}`" :disabled="saving" @click="images.splice(index, 1)"><ReworkIcon name="close" /></button>
      </span>
    </div>
    <div class="cpe__foot">
      <span class="cpe__count num" aria-hidden="true">{{ body.length }} / 1000</span>
      <button type="button" class="rw-btn rw-btn--sm rw-btn--ghost" :disabled="saving" @click="emit('cancel')">{{ t("common.cancel") }}</button>
      <button type="submit" class="rw-btn rw-btn--sm rw-btn--primary" :disabled="saving || empty" :aria-busy="saving || undefined">
        {{ saving ? t("rework.forum.tools.saving") : t("rework.forum.tools.save") }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.cpe {
  display: grid;
  gap: var(--sp-2);
  font-family: var(--font-ui);
}
.cpe__field {
  width: 100%;
  box-sizing: border-box;
}
.cpe__images {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.cpe__tile {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: var(--r-ctl);
  overflow: hidden;
  background: var(--bg-sunk);
}
.cpe__tile :deep(.cmd) {
  height: 100%;
}
.cpe__tile :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cpe__rm {
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
.cpe__rm :deep(svg) {
  width: 18px;
  height: 18px;
  padding: 3px;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 0 0 1px var(--line);
}
.cpe__rm:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -4px;
}
.cpe__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sp-2);
}
.cpe__count {
  margin-right: auto;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
</style>
