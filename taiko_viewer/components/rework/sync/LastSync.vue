<script setup lang="ts">
// ReworkSyncLastSync — "最近一次同步" of /account/sync: the time, the overall result (the page's buildSyncFeedback
// text), the compressed size and ratio, and every target's own result (HTTP status, message, size, song count).
// Only what GET /api/account/sync/targets returns as lastSync; there is no history beyond the last request.
import type { PropType } from "vue";
import { syncOutcome, type SyncLog } from "~/utils/rework/sync";

const props = defineProps({
  log: { type: Object as PropType<SyncLog | null>, default: null },
  feedback: { type: String, default: "" },
  ratio: { type: String, default: "" }
});
const { t } = useI18n();
const { formatDateTime } = useViewerDateTime();
const k = (key: string) => t(`rework.account.sync.${key}`);
const outcome = computed(() => (props.log ? syncOutcome(props.log.status) : null));
</script>

<template>
  <section id="sync-last-result" class="rs-last" aria-labelledby="sync-last-title">
    <h2 id="sync-last-title" class="rs-last__title" tabindex="-1">{{ k("lastSync") }}</h2>
    <p v-if="!log" class="rs-last__empty">{{ k("noHistory") }}</p>
    <template v-else>
      <dl class="rw-facts">
        <div>
          <dt>{{ k("syncTime") }}</dt>
          <dd><time class="num" :datetime="log.createdAt">{{ formatDateTime(log.createdAt) }}</time></dd>
        </div>
        <div>
          <dt>{{ k("compressedSize") }}</dt>
          <dd><span class="num">{{ log.compressedBytes }} / {{ log.originalBytes }}</span> bytes</dd>
        </div>
        <div>
          <dt>{{ k("compressedRate") }}</dt>
          <dd class="num">{{ ratio || "—" }}</dd>
        </div>
      </dl>
      <div class="rs-last__overall" :class="`is-${outcome}`">
        <span class="rs-last__overall-label">{{ k("overallStatus") }}</span>
        <p class="rs-last__overall-text">{{ feedback }}</p>
      </div>
      <ul class="rs-last__results">
        <li v-for="result in log.results" :key="`${log.id}-${result.targetId}`" class="result-item">
          <div class="result-item__head">
            <strong>{{ result.label }}</strong>
            <span class="rw-tag" :class="result.ok ? 'rw-tag--ok' : 'rs-tag--danger'">
              <ReworkIcon :name="result.ok ? 'check' : 'warn'" />{{ result.ok ? k("success") : k("failed") }}
            </span>
          </div>
          <p class="result-item__line"><span class="num">HTTP {{ result.statusCode }}</span> · {{ result.message }}</p>
          <p v-if="result.songCount !== null || result.decompressedBytes > 0" class="result-item__line">
            {{ k("decompressed") }} <span class="num">{{ result.decompressedBytes || "—" }}</span> bytes · {{ k("songs") }}
            <span class="num">{{ result.songCount ?? "—" }}</span>
          </p>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.rs-last {
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
  scroll-margin-top: calc(var(--bar-h) + var(--sp-6));
}
.rs-last__title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
  line-height: var(--lh-snug);
}
.rs-last__title:focus {
  outline: none;
}
.rs-last__title:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
  border-radius: var(--r-xs);
}
.rs-last__empty {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.rs-last__overall {
  display: grid;
  gap: 2px;
  padding-left: var(--sp-3);
  border-left: 3px solid var(--ok);
}
.rs-last__overall.is-partial {
  border-left-color: var(--warn);
}
.rs-last__overall.is-failed {
  border-left-color: var(--danger);
}
.rs-last__overall-label {
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.rs-last__overall-text {
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  overflow-wrap: anywhere;
}
.rs-last__results {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.result-item {
  display: grid;
  gap: var(--sp-1);
  padding: var(--sp-3) 0;
  border-top: 1px solid var(--line);
  min-width: 0;
}
.result-item__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}
.result-item__head strong {
  overflow-wrap: anywhere;
}
.result-item__line {
  margin: 0;
  font-size: var(--fs-13);
  line-height: var(--lh-snug);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.rs-tag--danger {
  background: var(--danger-wash);
  color: var(--ink);
}
@media (max-width: 767px) {
  .rs-last {
    padding: var(--sp-4);
  }
}
</style>
