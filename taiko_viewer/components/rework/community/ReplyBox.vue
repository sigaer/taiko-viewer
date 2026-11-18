<script setup lang="ts">
// ReworkCommunityReplyBox — the thread's reply composer. Requests, limits and messages are the page's
// (pages/forum/thread/[id].vue); this is the presentation:
//   collapsed  one line and a send button that opens it; focusing the line opens it too
//   expanded   who it answers (and clearing that), the text (1000 characters), up to 4 images, publish
// Position: ≥ 768 sticky at the bottom of the reply section; < 768 fixed above the bottom navigation, and while the
// soft keyboard is open (the layout sets html[data-kb] and --kb-h from visualViewport, and hides the navigation)
// docked on the keyboard without the safe-area inset. The rule is a plain `html[data-kb] .crb` selector so the
// compiled scoped CSS keeps the .crb part (never `:global(html[data-kb]) .crb`, which compiles to `html[data-kb]`).
// Real-device behaviour (iOS Safari, Android Chrome) is not verified here: see stage-3-progress.md 切片 D, P0.
import type { PropType } from "vue";

const props = defineProps({
  body: { type: String, default: "" },
  images: { type: Array as PropType<string[]>, default: () => [] },
  targetLabel: { type: String, default: "" },
  hasTarget: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  uploading: { type: Boolean, default: false },
  signedIn: { type: Boolean, default: true },
  /** sign-in return path (this thread) */
  redirect: { type: String, default: "" }
});
const emit = defineEmits<{
  "update:body": [value: string];
  "update:expanded": [value: boolean];
  submit: [];
  upload: [event: Event];
  remove: [index: number];
  clearTarget: [];
}>();
const { t } = useI18n();
const field = ref<HTMLTextAreaElement | null>(null);
const fieldId = useId();
defineExpose({ focus: () => field.value?.focus() });
const open = () => {
  emit("update:expanded", true);
  nextTick(() => field.value?.focus());
};
</script>

<template>
  <section class="crb" :class="{ 'is-expanded': expanded && signedIn }" :aria-label="t('rework.forum.thread.publishReply')" data-reply-box>
    <ReworkGate v-if="!signedIn" need="login" variant="row" :redirect="redirect" :title="t('rework.forum.thread.replyLogin')" :register="false" compact />
    <template v-else>
      <div v-if="expanded" class="crb__head">
        <p class="crb__to">
          <span v-if="targetLabel">{{ t("rework.forum.thread.replyTarget", { label: targetLabel }) }}</span>
          <span v-else>{{ t("rework.forum.thread.publishReply") }}</span>
        </p>
        <button v-if="hasTarget" type="button" class="rw-btn rw-btn--sm rw-btn--ghost" @click="emit('clearTarget')">{{ t("rework.forum.thread.cancelTarget") }}</button>
        <button type="button" class="rw-btn rw-btn--sm rw-btn--ghost" @click="emit('update:expanded', false)">{{ t("common.cancel") }}</button>
      </div>
      <div class="crb__row">
        <label :for="fieldId" class="rw-vh">{{ t("rework.forum.thread.publishReply") }}</label>
        <textarea
          :id="fieldId"
          ref="field"
          class="crb__field"
          :value="body"
          :rows="expanded ? 5 : 1"
          maxlength="1000"
          :disabled="locked || submitting"
          :placeholder="locked ? t('rework.forum.thread.locked') : t('rework.forum.thread.replyPlaceholder')"
          @input="emit('update:body', ($event.target as HTMLTextAreaElement).value)"
          @focus="emit('update:expanded', true)"
        />
        <button v-if="!expanded" type="button" class="crb__open" :aria-label="t('rework.forum.thread.publishReply')" :disabled="locked" @click="open">
          <ReworkIcon name="send" />
        </button>
      </div>
      <template v-if="expanded">
        <div v-if="images.length" class="crb__images">
          <span v-for="(url, index) in images" :key="`${url}-${index}`" class="crb__tile">
            <ForumSafeImage :src="url" alt="" />
            <button type="button" class="crb__rm" :aria-label="`${t('rework.forum.thread.remove')} ${index + 1}`" :disabled="submitting" @click="emit('remove', index)"><ReworkIcon name="close" /></button>
          </span>
        </div>
        <div class="crb__foot">
          <label class="rw-btn rw-btn--sm crb__upload" :class="{ 'is-off': locked || submitting || uploading || images.length >= 4 }">
            <input type="file" accept="image/*" multiple :disabled="locked || submitting || uploading || images.length >= 4" @change="emit('upload', $event)" />
            <ReworkIcon name="image" />{{ uploading ? t("rework.forum.thread.uploading") : t("rework.forum.thread.addImage", { count: images.length }) }}
          </label>
          <span class="crb__count num" aria-hidden="true">{{ body.length }} / 1000</span>
          <button type="button" class="rw-btn rw-btn--primary crb__send" :disabled="locked || uploading || submitting" :aria-busy="submitting || undefined" @click="emit('submit')">
            {{ locked ? t("rework.forum.thread.locked") : submitting ? t("rework.forum.thread.sending") : t("rework.forum.thread.submit") }}
          </button>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.crb {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: grid;
  gap: var(--sp-2);
  margin-top: var(--sp-4);
  padding: var(--sp-3) 0 var(--sp-4);
  border-top: 1px solid var(--line-strong);
  background: var(--bg);
  font-family: var(--font-ui);
  color: var(--ink);
}
.crb__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-2);
}
.crb__to {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--link);
  overflow-wrap: anywhere;
}
.crb__row {
  display: flex;
  align-items: flex-end;
  gap: var(--sp-2);
}
.crb__field {
  flex: 1;
  min-width: 0;
  min-height: var(--hit);
  max-height: 40vh;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-ctl);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-16);
  line-height: 1.5;
  resize: vertical;
}
.crb:not(.is-expanded) .crb__field {
  resize: none;
  overflow: hidden;
}
.crb__field:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
  border-color: var(--input-focus-line);
}
.crb__field:disabled {
  background: var(--bg-sunk);
  color: var(--ink-2);
}
.crb__open {
  flex: none;
  display: grid;
  place-items: center;
  width: var(--hit);
  height: var(--hit);
  border: 0;
  border-radius: var(--r-ctl);
  background: var(--action-bg);
  color: var(--ink-inv);
  cursor: pointer;
}
.crb__open:hover {
  background: var(--action-bg-hover);
}
.crb__open:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.crb__open:disabled {
  background: var(--bg-sunk);
  color: var(--ink-3);
  cursor: default;
}
.crb__images {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.crb__tile {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: var(--r-ctl);
  overflow: hidden;
  background: var(--bg-sunk);
}
.crb__tile :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.crb__rm {
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
.crb__rm :deep(svg) {
  width: 18px;
  height: 18px;
  padding: 3px;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 0 0 1px var(--line);
}
.crb__rm:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -4px;
}
.crb__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2) var(--sp-3);
}
.crb__upload {
  position: relative;
  gap: 6px;
  cursor: pointer;
}
.crb__upload :deep(svg) {
  width: 16px;
  height: 16px;
}
.crb__upload input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.crb__upload:focus-within {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.crb__upload.is-off {
  color: var(--ink-3);
  cursor: default;
}
.crb__count {
  margin-left: auto;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.crb :deep(.rw-gate) {
  padding: 0;
}
@media (max-width: 767px) {
  .crb {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(65px + env(safe-area-inset-bottom, 0px));
    z-index: var(--z-bar);
    margin: 0;
    padding: var(--sp-2) var(--sp-4);
    background: var(--surface);
    box-shadow: 0 -1px 0 var(--line);
    border-top: 0;
  }
  .crb.is-expanded {
    max-height: min(62vh, 460px);
    overflow-y: auto;
  }
  .crb__send {
    flex: 1 1 auto;
  }
}
/* Soft keyboard open (html[data-kb], written by layouts/default.vue): the bottom navigation is hidden, so the box
   docks on the keyboard (--kb-h is the covered height, 0 when the browser resizes the layout instead) and drops the
   safe-area inset. Plain root selector + class: compiles to `html[data-kb] .crb[data-v-…]`. */
@media (max-width: 767px) {
  html[data-kb] .crb {
    bottom: var(--kb-h, 0px);
  }
  html[data-kb] .crb.is-expanded {
    max-height: 50vh;
  }
}
</style>
