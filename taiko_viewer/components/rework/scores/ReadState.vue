<script setup lang="ts">
// A failed personal score read, presented by what it means (utils/rework/scores.ts accountReadKind):
// no bound ID → ReworkGate binding; no score data yet → empty + sync; anything else → failed + retry.
import { computed } from "vue";
import { accountReadKind } from "~/utils/rework/scores";

const props = defineProps({
  status: { type: Number, default: 0 },
  /** server statusMessage of the failure */
  message: { type: String, default: "" },
  /** title of the plain failure */
  failedTitle: { type: String, required: true }
});
const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n();
const localePath = useLocalePath();
const kind = computed(() => accountReadKind(props.status, props.message));
</script>

<template>
  <ReworkGate v-if="kind === 'binding'" class="rs-gate" need="binding" />
  <ReworkState v-else-if="kind === 'noData'" kind="empty" :title="t('rework.imageTool.noData')">
    <NuxtLink class="rw-btn rw-btn--primary" :to="localePath('/account/sync')">{{ t("account.sync") }}</NuxtLink>
  </ReworkState>
  <ReworkState v-else kind="failed" :title="failedTitle" @retry="emit('retry')" />
</template>

<style scoped>
.rs-gate {
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
</style>
