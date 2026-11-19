<script setup lang="ts">
// ReworkDeveloperApplications — the current application (time, reply e-mail, reason, screenshots, the reviewer's
// note) and the application history of /account/developer, as returned by GET /api/account/developer.
import type { PropType } from "vue";
import type { DeveloperPayload } from "~/utils/rework/developer";

defineProps({ state: { type: Object as PropType<DeveloperPayload>, required: true } });
const { t, te } = useI18n();
const { formatDateTime } = useViewerDateTime();
const k = (key: string) => t(`rework.account.developer.${key}`);
const statusLabel = (status: string) => (te(`rework.account.developer.statusLabel.${status}`) ? k(`statusLabel.${status}`) : status);
</script>

<template>
  <section class="rd-apps" aria-labelledby="developer-state-title">
    <h2 id="developer-state-title" class="rd-apps__title">{{ k("stateTitle") }}</h2>
    <p v-if="!state.currentApplication" class="rd-apps__empty">{{ k("noApplication") }}</p>
    <article v-else class="rd-apps__current application-card">
      <dl class="rw-facts">
        <div>
          <dt>{{ k("submittedAt") }}</dt>
          <dd>{{ formatDateTime(state.currentApplication.createdAt) }}</dd>
        </div>
        <div>
          <dt>{{ k("replyEmail") }}</dt>
          <dd class="rd-apps__wrap">{{ state.currentApplication.replyEmail }}</dd>
        </div>
      </dl>
      <p class="rd-apps__reason application-reason">{{ state.currentApplication.reason }}</p>
      <ul v-if="state.currentApplication.imageUrls.length" class="rd-apps__images">
        <li v-for="url in state.currentApplication.imageUrls" :key="url">
          <a :href="url" target="_blank" rel="noopener noreferrer"><img :src="url" :alt="k('imageAlt')" loading="lazy" /></a>
        </li>
      </ul>
      <div v-if="state.currentApplication.reviewNote" class="rd-apps__note review-note">
        <strong>{{ k("reviewFeedback") }}</strong>
        <p>{{ state.currentApplication.reviewNote }}</p>
      </div>
    </article>

    <h3 class="rd-apps__subtitle">{{ k("history") }}</h3>
    <p v-if="!state.history.length" class="rd-apps__empty">{{ k("noHistory") }}</p>
    <ul v-else class="rd-apps__history history-list">
      <li v-for="item in state.history" :key="item.id" class="history-item">
        <span class="rw-tag">{{ statusLabel(item.status) }}</span>
        <span class="rd-apps__wrap">{{ item.replyEmail }}</span>
        <time class="rd-apps__time num" :datetime="item.createdAt">{{ formatDateTime(item.createdAt) }}</time>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.rd-apps {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  min-width: 0;
  padding: var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-ui);
}
.rd-apps__title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
}
.rd-apps__subtitle {
  margin: var(--sp-3) 0 0;
  font-size: var(--fs-16);
  font-weight: 700;
}
.rd-apps__empty {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.rd-apps__current {
  display: grid;
  gap: var(--sp-3);
  min-width: 0;
}
.rd-apps__wrap {
  overflow-wrap: anywhere;
}
.rd-apps__reason {
  margin: 0;
  padding: var(--sp-3);
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.rd-apps__images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.rd-apps__images a {
  display: block;
  border-radius: var(--r-ctl);
}
.rd-apps__images a:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.rd-apps__images img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.rd-apps__note {
  padding-left: var(--sp-3);
  border-left: 3px solid var(--info-line);
}
.rd-apps__note p {
  margin: var(--sp-1) 0 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.rd-apps__history {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.history-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-1) var(--sp-3);
  min-height: var(--hit);
  padding: var(--sp-2) 0;
  border-top: 1px solid var(--line);
  font-size: var(--fs-14);
}
.rd-apps__time {
  margin-left: auto;
  color: var(--ink-2);
  font-weight: 500;
}
@media (max-width: 767px) {
  .rd-apps {
    padding: var(--sp-4);
  }
}
</style>
