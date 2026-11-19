<script setup lang="ts">
// ReworkDeveloperApplyForm — the developer application form of /account/developer (shown only while the page's
// canSubmitApplication holds, as before): reply e-mail, reason (4,000 characters), up to four screenshots (the page
// keeps the first four chosen), submit. The file input belongs to the page (fileInputRef), which clears and opens it.
// `error` is the field the page's validation stopped at; the toast stays.
import type { PropType } from "vue";

const props = defineProps({
  replyEmail: { type: String, required: true },
  reason: { type: String, required: true },
  files: { type: Array as PropType<File[]>, required: true },
  canSubmit: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  error: { type: Object as PropType<{ field: "reason" | "replyEmail"; message: string } | null>, default: null },
  fileInputRef: { type: Function as PropType<(el: Element | null) => void>, required: true }
});
const emit = defineEmits<{ "update:replyEmail": [value: string]; "update:reason": [value: string]; choose: []; change: [event: Event]; submit: [] }>();
const { t } = useI18n();
const k = (key: string, values?: Record<string, unknown>) => t(`rework.account.developer.${key}`, values || {});
const setFileInput = (el: unknown) => props.fileInputRef((el as Element | null) ?? null);
</script>

<template>
  <section class="rd-apply" aria-labelledby="developer-apply-title">
    <h2 id="developer-apply-title" class="rd-apply__title">{{ k("submitTitle") }}</h2>
    <p class="rd-apply__desc">{{ k("submitDesc") }}</p>
    <form class="rd-apply__form" novalidate @submit.prevent="emit('submit')">
      <div class="rw-field">
        <label class="rw-field__label" for="developer-reply-email">{{ k("replyEmail") }}</label>
        <input
          id="developer-reply-email"
          class="rw-input rw-input--block"
          type="email"
          inputmode="email"
          autocomplete="email"
          :value="replyEmail"
          :placeholder="k('replyEmailPlaceholder')"
          :disabled="!canSubmit"
          :aria-invalid="error?.field === 'replyEmail' ? 'true' : undefined"
          :aria-describedby="error?.field === 'replyEmail' ? 'developer-reply-email-error' : undefined"
          @input="emit('update:replyEmail', ($event.target as HTMLInputElement).value)"
        />
        <p v-if="error?.field === 'replyEmail'" id="developer-reply-email-error" class="rw-field__error" role="alert">{{ error.message }}</p>
      </div>
      <div class="rw-field">
        <label class="rw-field__label" for="developer-reason">{{ k("reason") }}</label>
        <textarea
          id="developer-reason"
          class="rw-input rw-textarea rw-input--block"
          rows="6"
          maxlength="4000"
          :value="reason"
          :placeholder="k('reasonPlaceholder')"
          :disabled="!canSubmit"
          :aria-invalid="error?.field === 'reason' ? 'true' : undefined"
          :aria-describedby="error?.field === 'reason' ? 'developer-reason-error developer-reason-count' : 'developer-reason-count'"
          @input="emit('update:reason', ($event.target as HTMLTextAreaElement).value)"
        />
        <p class="rd-apply__count">
          <span v-if="error?.field === 'reason'" id="developer-reason-error" class="rw-field__error" role="alert">{{ error.message }}</span>
          <span id="developer-reason-count" class="rw-count num">{{ reason.length }} / 4000</span>
        </p>
      </div>
      <div class="rw-field">
        <span id="developer-images-label" class="rw-field__label">{{ k("images") }}</span>
        <input :ref="setFileInput" class="rd-apply__file" type="file" accept="image/*" multiple tabindex="-1" aria-hidden="true" @change="emit('change', $event)" />
        <div class="rd-apply__picker">
          <button type="button" class="rw-btn" :disabled="!canSubmit" aria-describedby="developer-images-label developer-images-state" @click="emit('choose')">
            <ReworkIcon name="image" />{{ k("chooseImages") }}
          </button>
          <span id="developer-images-state" class="rd-apply__state">{{ files.length ? k("selectedImages", { count: files.length }) : k("noImages") }}</span>
        </div>
        <ul v-if="files.length" class="rd-apply__files image-name-list">
          <li v-for="file in files" :key="file.name">{{ file.name }}</li>
        </ul>
      </div>
      <div>
        <button
          type="submit"
          class="rw-btn rw-btn--primary"
          :class="{ 'is-busy': submitting }"
          :disabled="!canSubmit || submitting"
          :aria-busy="submitting || undefined"
          data-developer-submit
        >
          {{ canSubmit ? k("submit") : k("disabledSubmit") }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.rd-apply {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-width: 0;
  padding: var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-ui);
}
.rd-apply__title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
}
.rd-apply__desc {
  margin: calc(-1 * var(--sp-2)) 0 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  color: var(--ink-2);
}
.rd-apply__form {
  display: grid;
  gap: var(--sp-4);
  min-width: 0;
}
.rd-apply__count {
  display: flex;
  justify-content: space-between;
  gap: var(--sp-3);
  margin: 0;
}
.rd-apply__count .rw-count {
  margin-left: auto;
}
.rd-apply__file {
  display: none;
}
.rd-apply__picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2) var(--sp-3);
}
.rd-apply__picker .rw-btn svg {
  width: 18px;
  height: 18px;
}
.rd-apply__state {
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.rd-apply__files {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.rd-apply__files li {
  max-width: 100%;
  padding: 4px 10px;
  border-radius: var(--tag-radius);
  background: var(--bg-sunk);
  color: var(--ink-2);
  font-size: var(--fs-13);
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .rd-apply {
    padding: var(--sp-4);
  }
  .rd-apply__form .rw-btn--primary {
    width: 100%;
  }
}
</style>
