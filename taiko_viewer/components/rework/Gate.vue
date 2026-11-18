<script setup lang="ts">
// ReworkGate — the single sign-in / binding prompt of reworked pages. It replaces components/tools/AccountToolGate.vue
// and per-page prompts as pages are reworked (slice A: the song detail score panel).
//   need = null      the content (default slot) is shown
//   need = "login"   sign-in prompt: log in (back to `redirect` afterwards) and, unless `register` is false, register
//   need = "binding" binding prompt: go to the profile page, where the Donder Hiroba ID is bound
// variant = "block" (default) title, text and actions stacked; "row" one line of text and the action(s) beside it,
//   wrapping only when the line is too narrow (a guest prompt inside the page flow, without a card or heading).
// The caller decides `need` from its own account state; the gate does not fetch anything.
// `primary` is emitted when the main action (log in / bind) is followed (analytics of the caller); extra actions go
// in the `actions` slot after the built-in ones (slice C: the home page's "my scores" link).
import type { PropType } from "vue";

const props = defineProps({
  need: { type: String as PropType<"login" | "binding" | null>, default: null },
  title: { type: String, default: "" },
  text: { type: String, default: "" },
  /** login: where to return after signing in (an unlocalized or localized path); defaults to the current page */
  redirect: { type: String, default: "" },
  register: { type: Boolean, default: true },
  compact: { type: Boolean, default: false },
  variant: { type: String as PropType<"block" | "row">, default: "block" }
});
const emit = defineEmits<{ primary: [] }>();
const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const loginTo = computed(() => ({ path: localePath("/account/login"), query: { redirect: props.redirect || route.fullPath } }));
const heading = computed(() => props.title || t(props.need === "binding" ? "rework.gate.bindingTitle" : "rework.gate.loginTitle"));
</script>

<template>
  <slot v-if="!need" />
  <div v-else class="rw-gate" :class="[`rw-gate--${variant}`, { 'is-compact': compact }]" :data-need="need">
    <p class="rw-gate__title">{{ heading }}</p>
    <p v-if="text" class="rw-gate__text">{{ text }}</p>
    <div class="rw-gate__actions">
      <template v-if="need === 'login'">
        <NuxtLink class="rw-btn rw-btn--primary" :class="{ 'rw-btn--sm': variant === 'row' }" :to="loginTo" @click="emit('primary')">{{ t("rework.gate.login") }}</NuxtLink>
        <NuxtLink v-if="register" class="rw-btn" :to="localePath('/account/register')">{{ t("rework.gate.register") }}</NuxtLink>
      </template>
      <NuxtLink v-else class="rw-btn rw-btn--primary" :to="localePath('/account/profile')" @click="emit('primary')">{{ t("rework.gate.bind") }}</NuxtLink>
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.rw-gate {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-6) var(--sp-4);
  font-family: var(--font-ui);
}
.rw-gate.is-compact {
  padding: var(--sp-2) 0;
}
.rw-gate__title {
  margin: 0;
  font-size: var(--fs-16);
  line-height: var(--lh-snug);
  color: var(--ink);
}
.rw-gate__text {
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  color: var(--ink-2);
}
.rw-gate--row {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2) var(--sp-4);
  padding: var(--sp-3) var(--sp-4);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.rw-gate--row .rw-gate__title {
  flex: 1 1 12em;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.rw-gate--row .rw-gate__text {
  display: none;
}
.rw-gate__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
</style>
