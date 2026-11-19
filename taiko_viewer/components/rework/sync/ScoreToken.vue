<script setup lang="ts">
// ReworkSyncScoreToken — "网页成绩 token" of /account/sync. Reading first (mask, issue time, last use, state), then
// the one-time plaintext block (only while the page holds the token it was just given; never stored or re-read),
// then the actions: issue / rotate, and revoke as a separate destructive action (danger outline; the page asks for
// confirmation first, unchanged). The disabled conditions are the page's original ones.
import type { PropType } from "vue";
import type { SyncOverviewPayload } from "~/utils/rework/sync";

const props = defineProps({
  overview: { type: Object as PropType<SyncOverviewPayload>, required: true },
  /** the plaintext token of this page view's last issue / rotation ("" otherwise) */
  issued: { type: String, default: "" },
  busy: { type: Boolean, default: false },
  pending: { type: Boolean, default: false },
  error: { type: String, default: "" }
});
const emit = defineEmits<{ issue: []; revoke: []; copy: [] }>();
const { t } = useI18n();
const localePath = useLocalePath();
const { formatDateTime } = useViewerDateTime();
const k = (key: string) => t(`rework.account.sync.${key}`);
const token = computed(() => props.overview.scoreToken);
</script>

<template>
  <section class="rs-token" aria-labelledby="sync-token-title">
    <div class="rs-token__head">
      <h2 id="sync-token-title" class="rs-token__title">
        {{ k("scoreTokenTitle") }}
        <span v-if="!overview.currentBinding?.isManual && !(overview.currentBinding && !overview.scoreTokenAvailable)" class="rw-tag" :class="token?.exists ? 'rw-tag--ok' : ''" data-token-state>{{ token?.exists ? k("scoreTokenReady") : k("scoreTokenEmpty") }}</span>
      </h2>
      <NuxtLink class="rw-link rs-token__docs" :to="localePath('/docs/score-token')">{{ k("scoreTokenDocs") }}</NuxtLink>
    </div>
    <p class="rs-token__desc">{{ k("scoreTokenDesc") }}</p>

    <p v-if="overview.currentBinding?.isManual" class="rw-alert rw-alert--info" role="note">{{ k("scoreTokenManual") }}</p>
    <p v-else-if="overview.currentBinding && !overview.scoreTokenAvailable" class="rw-alert rw-alert--warn" role="note">{{ k("scoreTokenUnavailable") }}</p>
    <template v-else>
      <dl class="rw-facts rs-token__facts">
        <div class="rs-token__mask-row">
          <dt>{{ k("scoreTokenMask") }}</dt>
          <dd><code class="rs-token__mask" data-token-mask>{{ token?.tokenMask || k("scoreTokenEmpty") }}</code></dd>
        </div>
        <div>
          <dt>{{ k("scoreTokenCreated") }}</dt>
          <dd>{{ token?.createdAt ? formatDateTime(token.createdAt) : "—" }}</dd>
        </div>
        <div>
          <dt>{{ k("scoreTokenLastUsed") }}</dt>
          <dd>{{ token?.lastUsedAt ? formatDateTime(token.lastUsedAt) : k("scoreTokenNeverUsed") }}</dd>
        </div>
      </dl>

      <div v-if="issued" class="rs-token__reveal token-reveal" role="status">
        <p class="rs-token__reveal-text">{{ k("scoreTokenReveal") }}</p>
        <div class="rs-token__value-row">
          <code class="rs-token__value" tabindex="0" data-token-value>{{ issued }}</code>
          <button type="button" class="rw-btn" @click="emit('copy')"><ReworkIcon name="copy" />{{ k("scoreTokenCopy") }}</button>
        </div>
      </div>

      <p v-if="error" class="rw-alert" role="alert">{{ error }}</p>

      <div class="rs-token__actions">
        <button
          type="button"
          class="rw-btn"
          :class="{ 'is-busy': busy }"
          :disabled="pending || !overview.currentBinding || !overview.scoreTokenAvailable || busy"
          :aria-busy="busy || undefined"
          data-token-issue
          @click="emit('issue')"
        >
          <ReworkIcon v-if="!busy" name="key" />{{ token?.exists ? k("scoreTokenRotate") : k("scoreTokenIssue") }}
        </button>
        <button
          v-if="token?.exists"
          type="button"
          class="rw-btn rw-btn--danger rs-token__revoke"
          :disabled="pending || busy"
          data-token-revoke
          @click="emit('revoke')"
        >
          {{ k("scoreTokenRevoke") }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.rs-token {
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
.rs-token__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-1) var(--sp-4);
}
.rs-token__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
  line-height: var(--lh-snug);
}
.rs-token__docs {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-14);
}
.rs-token__desc {
  margin: calc(-1 * var(--sp-2)) 0 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.rs-token__mask-row {
  grid-column: 1 / -1;
}
.rs-token__mask,
.rs-token__value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0;
}
.rs-token__mask {
  overflow-wrap: anywhere;
}
.rs-token__reveal {
  display: grid;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--warn);
  border-radius: var(--r-ctl);
  background: var(--warn-wash);
}
.rs-token__reveal-text {
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
}
.rs-token__value-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
}
.rs-token__value {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  padding: 10px var(--sp-3);
  border-radius: var(--r-ctl);
  background: var(--surface);
  color: var(--ink);
  white-space: nowrap;
}
.rs-token__value:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.rs-token__reveal .rw-btn svg,
.rs-token__actions .rw-btn svg {
  width: 18px;
  height: 18px;
}
.rs-token__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.rs-token__revoke {
  margin-left: auto;
}
@media (max-width: 767px) {
  .rs-token {
    padding: var(--sp-4);
  }
  .rs-token__value-row {
    flex-wrap: wrap;
  }
  .rs-token__value-row .rw-btn,
  .rs-token__actions .rw-btn {
    flex: 1 1 100%;
  }
  .rs-token__revoke {
    margin-left: 0;
  }
}
</style>
