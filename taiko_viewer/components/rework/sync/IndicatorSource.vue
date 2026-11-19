<script setup lang="ts">
// ReworkSyncIndicatorSource — renders nothing. Publishes what /account/sync currently knows to the shell's sync
// control (utils/rework/sync.ts syncIndicatorKind): the last read overview of the signed-in account and binding, and
// whether one of the page's sync / import requests is in flight. No request of its own. While the overview is
// re-read (null) the last settled state is kept; the shell ignores a state of another account or binding generation.
import type { PropType } from "vue";
import { SYNC_INDICATOR_KEY, syncIndicatorKind, type SyncIndicatorState, type SyncOverviewPayload } from "~/utils/rework/sync";

const props = defineProps({
  overview: { type: Object as PropType<SyncOverviewPayload | null>, default: null },
  busy: { type: Boolean, default: false }
});
const { accountUser } = useAccountState();
const generation = useState("account-binding-generation", () => 0);
const indicator = useState<SyncIndicatorState | null>(SYNC_INDICATOR_KEY, () => null);
watch(
  () => [props.overview, props.busy, accountUser.value?.id, generation.value] as const,
  ([overview, busy, userId]) => {
    if (!userId) return;
    const previous = indicator.value && indicator.value.userId === userId && indicator.value.generation === generation.value ? indicator.value : null;
    const settled = overview ? (syncIndicatorKind(overview, false) as SyncIndicatorState["settled"]) : previous?.settled ?? null;
    const kind = busy ? "running" : settled;
    if (!kind) {
      if (previous) indicator.value = null;
      return;
    }
    indicator.value = { userId, generation: generation.value, kind, settled };
  },
  { immediate: true }
);
</script>

<template>
  <span hidden />
</template>
