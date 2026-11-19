<script setup lang="ts">
// ReworkSyncKinoko — "从菌菌控制台迁移" of /account/sync: the API key (a password field with a show toggle, never
// autofilled or stored by the page), the target binding, and the two imports. The form submits the current-score
// import (Enter in the key field does the same, as before); the full-history import is the second button. Disabled
// conditions are the page's original ones; `notice` is the result line of the page's last import.
import type { PropType } from "vue";

type Notice = { level: "success" | "warning" | "error"; message: string; field?: "key" } | null;
const props = defineProps({
  apiKey: { type: String, required: true },
  cooldown: { type: Number, required: true },
  pending: { type: Boolean, default: false },
  importing: { type: Boolean, default: false },
  importingHistory: { type: Boolean, default: false },
  hasBinding: { type: Boolean, default: false },
  target: { type: String, default: "" },
  notice: { type: Object as PropType<Notice>, default: null }
});
const emit = defineEmits<{ "update:apiKey": [value: string]; import: []; importHistory: [] }>();
const { t } = useI18n();
const k = (key: string, values?: Record<string, unknown>) => t(`rework.account.sync.${key}`, values || {});
const show = ref(false);
const keyError = computed(() => (props.notice?.field === "key" ? props.notice.message : ""));
const input = ref<HTMLInputElement | null>(null);
defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <section class="rs-kinoko" aria-labelledby="sync-kinoko-title">
    <h2 id="sync-kinoko-title" class="rs-kinoko__title">{{ k("kinokoTitle") }}</h2>
    <p class="rs-kinoko__desc">{{ k("kinokoDesc") }}</p>
    <p v-if="hasBinding" class="rs-kinoko__target">{{ k("kinokoTarget", { target }) }}</p>
    <form class="rs-kinoko__form kinoko-form" novalidate @submit.prevent="emit('import')">
      <div class="rw-field">
        <label class="rw-field__label" for="sync-kinoko-key">{{ k("kinokoKey") }}</label>
        <div class="rw-pw">
          <input
            id="sync-kinoko-key"
            ref="input"
            class="rw-input rw-input--block"
            :type="show ? 'text' : 'password'"
            :value="apiKey"
            :disabled="pending || importing || importingHistory"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            :placeholder="k('kinokoKeyPlaceholder')"
            :aria-invalid="keyError ? 'true' : undefined"
            :aria-describedby="keyError ? 'sync-kinoko-key-error' : 'sync-kinoko-hint'"
            @input="emit('update:apiKey', ($event.target as HTMLInputElement).value)"
          />
          <button type="button" :aria-pressed="show" :aria-label="k('showKey')" @click="show = !show"><ReworkIcon name="eye" /></button>
        </div>
        <p v-if="keyError" id="sync-kinoko-key-error" class="rw-field__error" role="alert">{{ keyError }}</p>
      </div>
      <div class="rs-kinoko__actions kinoko-actions">
        <button
          type="submit"
          class="rw-btn"
          :class="{ 'is-busy': importing }"
          :disabled="!hasBinding || cooldown > 0 || importingHistory || importing"
          :aria-busy="importing || undefined"
          data-kinoko-import
        >
          {{ cooldown > 0 ? k("coolingDown", { seconds: cooldown }) : k("kinokoStart") }}
        </button>
        <button
          type="button"
          class="rw-btn"
          :class="{ 'is-busy': importingHistory }"
          :disabled="!hasBinding || cooldown > 0 || importing || importingHistory"
          :aria-busy="importingHistory || undefined"
          data-kinoko-history
          @click="emit('importHistory')"
        >
          {{ cooldown > 0 ? k("coolingDown", { seconds: cooldown }) : k("kinokoHistoryStart") }}
        </button>
      </div>
      <p id="sync-kinoko-hint" class="rw-field__hint kinoko-history-hint">{{ k("kinokoHistoryHint") }}</p>
    </form>
    <p
      v-if="notice && !keyError"
      class="rw-alert"
      :class="notice.level === 'success' ? 'rw-alert--ok' : notice.level === 'warning' ? 'rw-alert--warn' : ''"
      :role="notice.level === 'error' ? 'alert' : 'status'"
      data-kinoko-notice
    >
      {{ notice.message }}
    </p>
  </section>
</template>

<style scoped>
.rs-kinoko {
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
.rs-kinoko__title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
  line-height: var(--lh-snug);
}
.rs-kinoko__desc,
.rs-kinoko__target {
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.rs-kinoko__desc {
  margin-top: calc(-1 * var(--sp-2));
}
.rs-kinoko__target {
  color: var(--ink);
}
.rs-kinoko__form {
  display: grid;
  gap: var(--sp-3);
  min-width: 0;
}
.rs-kinoko__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
@media (max-width: 767px) {
  .rs-kinoko {
    padding: var(--sp-4);
  }
  .rs-kinoko__actions .rw-btn {
    flex: 1 1 100%;
  }
}
</style>
