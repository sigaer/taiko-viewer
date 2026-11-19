<script setup lang="ts">
// The result of a server-rendered score image (B30, rating trend, song progress). The image is the existing
// endpoint's output, shown as it is (scaled down to the panel width, never wider than the page) with its actions:
// open the original in a new tab and save it. States: waiting for the first generation (or changed parameters),
// generating (a placeholder that keeps the space), and a failed read presented by what it means — no bound ID
// (ReworkGate binding), no score data yet (empty + sync), anything else (failed + retry).
// `actions` slot: extra controls in the panel head (the progress pager).
import { computed } from "vue";
import { accountReadKind } from "~/utils/rework/scores";

const props = defineProps({
  url: { type: String, default: "" },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  status: { type: Number, default: 0 },
  /** shown before the first image or after the parameters changed; empty: nothing */
  idleText: { type: String, default: "" },
  alt: { type: String, required: true },
  summary: { type: String, default: "" },
  /** file name for "save"; empty: no save link */
  download: { type: String, default: "" }
});
const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n();
const localePath = useLocalePath();
const failure = computed(() => (props.error ? accountReadKind(props.status, props.error) : null));
</script>

<template>
  <ReworkGate v-if="failure === 'binding'" class="ir-gate" need="binding" />
  <ReworkPanel v-else class="ir" :title="t('rework.imageTool.result')" :aria-busy="loading">
    <template v-if="url || $slots.actions" #actions>
      <slot name="actions" />
      <template v-if="url && !loading">
        <a class="rw-btn rw-btn--sm" :href="url" target="_blank" rel="noopener"><ReworkIcon name="open" />{{ t("rework.imageTool.open") }}</a>
        <a v-if="download" class="rw-btn rw-btn--sm" :href="url" :download="download"><ReworkIcon name="download" />{{ t("rework.imageTool.download") }}</a>
      </template>
    </template>
    <p v-if="summary && (url || loading)" class="ir-summary">{{ summary }}</p>
    <div v-if="loading" class="ir-wait" role="status" aria-busy="true">
      <span>{{ t("rework.imageTool.loading") }}</span>
    </div>
    <ReworkState v-else-if="failure === 'noData'" kind="empty" compact :title="t('rework.imageTool.noData')">
      <NuxtLink class="rw-btn rw-btn--primary" :to="localePath('/account/sync')">{{ t("account.sync") }}</NuxtLink>
    </ReworkState>
    <ReworkState v-else-if="failure === 'failed'" kind="failed" compact :title="error" @retry="emit('retry')" />
    <a v-else-if="url" class="ir-frame" :href="url" target="_blank" rel="noopener" :aria-label="t('rework.imageTool.openLabel', { name: alt })">
      <img class="ir-img" :src="url" :alt="summary ? `${alt} · ${summary}` : alt" />
    </a>
    <ReworkState v-else-if="idleText" kind="empty" compact :title="idleText" />
  </ReworkPanel>
</template>

<style scoped>
.ir {
  min-width: 0;
}
.ir-summary {
  margin: calc(var(--sp-2) * -1) 0 var(--sp-3);
  font-size: var(--fs-13);
  color: var(--ink-3);
  overflow-wrap: anywhere;
}
.ir-wait {
  display: grid;
  place-items: center;
  min-height: 280px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  color: var(--ink-3);
  font-size: var(--fs-14);
}
.ir-frame {
  display: block;
  width: fit-content;
  max-width: 100%;
  margin-inline: auto;
  border-radius: var(--r-ctl);
}
.ir-frame:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}
.ir-img {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: var(--r-ctl);
}
.ir-gate {
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
</style>
