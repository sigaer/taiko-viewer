<script setup lang="ts">
// ReworkDeveloperStatus — the state block of /account/developer: the application state, the developer token's mask
// and last use (the plaintext is only sent by e-mail on approval; this page never shows it), and the reviewer's link
// to the approval page (only when the API says this account can review).
import type { PropType } from "vue";
import type { DeveloperPayload } from "~/utils/rework/developer";

const props = defineProps({ state: { type: Object as PropType<DeveloperPayload>, required: true } });
const { t, te } = useI18n();
const localePath = useLocalePath();
const { formatDateTime } = useViewerDateTime();
const k = (key: string) => t(`rework.account.developer.${key}`);
const status = computed(() => props.state.currentApplication?.status || "");
const statusLabel = computed(() =>
  !status.value ? k("notApplied") : te(`rework.account.developer.statusLabel.${status.value}`) ? k(`statusLabel.${status.value}`) : status.value
);
const tone = computed(() => (status.value === "approved" ? "rw-tag--ok" : status.value === "pending" ? "rw-tag--info" : status.value === "rejected" ? "rw-tag--warn" : ""));
</script>

<template>
  <section class="rd-status" :aria-label="k('currentStatus')">
    <dl class="rw-facts">
      <div>
        <dt>{{ k("currentStatus") }}</dt>
        <dd><span class="rw-tag" :class="tone" data-developer-status>{{ statusLabel }}</span></dd>
      </div>
      <div>
        <dt>{{ k("tokenMask") }}</dt>
        <dd><code class="rd-status__mask">{{ state.token?.tokenMask || k("notIssued") }}</code></dd>
      </div>
      <div>
        <dt>{{ k("lastUsed") }}</dt>
        <dd>{{ state.token?.lastUsedAt ? formatDateTime(state.token.lastUsedAt) : "—" }}</dd>
      </div>
    </dl>
    <NuxtLink v-if="state.canReview" class="rw-btn rw-btn--sm review-link" :to="localePath('/account/developer/review')">{{ k("reviewLink") }}</NuxtLink>
  </section>
</template>

<style scoped>
.rd-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3) var(--sp-5);
  min-width: 0;
  padding: var(--sp-4) var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-ui);
}
.rd-status .rw-facts {
  flex: 1 1 420px;
}
.rd-status__mask {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .rd-status {
    padding: var(--sp-4);
  }
}
</style>
