<script setup lang="ts">
// ReworkDeveloperReview — /account/developer/review for reviewers: the pending applications (applicant, e-mails,
// time, reason, screenshots) with approve and reject, and the recent decisions. Approve and reject open the page's
// prompts (unchanged: an optional note / a required reason); while one application is being decided every decision
// button is disabled and that application's buttons show it.
import type { PropType } from "vue";
import type { ReviewApplication, ReviewPayload } from "~/utils/rework/developer";

defineProps({
  state: { type: Object as PropType<ReviewPayload>, required: true },
  processingId: { type: Number as PropType<number | null>, default: null }
});
const emit = defineEmits<{ approve: [application: ReviewApplication]; reject: [application: ReviewApplication] }>();
const { t, te } = useI18n();
const { formatDateTime } = useViewerDateTime();
const k = (key: string) => t(`rework.account.developerReview.${key}`);
const statusLabel = (status: string) => (te(`rework.account.developer.statusLabel.${status}`) ? t(`rework.account.developer.statusLabel.${status}`) : status);
</script>

<template>
  <section class="rdr-sec" aria-labelledby="developer-review-pending">
    <div class="rdr-sec__head">
      <h2 id="developer-review-pending" class="rdr-sec__title">{{ k("pendingTitle") }}</h2>
      <span class="rw-count num">{{ state.pending.length }}</span>
    </div>
    <p class="rdr-sec__hint">{{ k("approveHint") }}</p>
    <p v-if="!state.pending.length" class="rdr-sec__empty">{{ k("noPending") }}</p>
    <ul v-else class="rdr-list">
      <li v-for="application in state.pending" :key="application.id">
        <article class="rdr-app application-item" :aria-labelledby="`developer-application-${application.id}`" :data-application-id="application.id">
          <header class="rdr-app__head">
            <h3 :id="`developer-application-${application.id}`" class="rdr-app__title">
              <span class="num">#{{ application.id }}</span> · {{ application.applicant?.username || k("unknownUser") }}
            </h3>
            <time class="rdr-app__time" :datetime="application.createdAt">{{ formatDateTime(application.createdAt) }}</time>
          </header>
          <p class="rdr-app__meta">{{ application.applicant?.email || "—" }} · {{ application.replyEmail }}</p>
          <p class="rdr-app__reason application-item__reason">{{ application.reason }}</p>
          <ul v-if="application.imageUrls.length" class="rdr-app__images">
            <li v-for="url in application.imageUrls" :key="url">
              <a :href="url" target="_blank" rel="noopener noreferrer"><img :src="url" :alt="t('rework.account.developer.imageAlt')" loading="lazy" /></a>
            </li>
          </ul>
          <div class="rdr-app__actions">
            <button
              type="button"
              class="rw-btn rw-btn--primary"
              :class="{ 'is-busy': processingId === application.id }"
              :disabled="processingId !== null"
              :aria-busy="processingId === application.id || undefined"
              data-review-approve
              @click="emit('approve', application)"
            >
              {{ k("approve") }}
            </button>
            <button
              type="button"
              class="rw-btn rw-btn--danger"
              :disabled="processingId !== null"
              data-review-reject
              @click="emit('reject', application)"
            >
              {{ k("reject") }}
            </button>
          </div>
        </article>
      </li>
    </ul>
  </section>

  <section class="rdr-sec" aria-labelledby="developer-review-history">
    <h2 id="developer-review-history" class="rdr-sec__title">{{ k("historyTitle") }}</h2>
    <p v-if="!state.history.length" class="rdr-sec__empty">{{ k("noHistory") }}</p>
    <ul v-else class="rdr-history">
      <li v-for="item in state.history" :key="item.id" class="history-item">
        <div class="rdr-history__head">
          <strong><span class="num">#{{ item.id }}</span> · {{ item.applicant?.username || k("unknownUser") }}</strong>
          <span class="rw-tag" :class="item.status === 'approved' ? 'rw-tag--ok' : item.status === 'rejected' ? 'rw-tag--warn' : ''">{{ statusLabel(item.status) }}</span>
        </div>
        <p class="rdr-history__line">{{ item.replyEmail }}</p>
        <p v-if="item.reviewNote" class="rdr-history__note history-item__note">{{ item.reviewNote }}</p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.rdr-sec {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  min-width: 0;
  color: var(--ink);
  font-family: var(--font-ui);
}
.rdr-sec__head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
}
.rdr-sec__title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
}
.rdr-sec__hint,
.rdr-sec__empty {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.rdr-list,
.rdr-history,
.rdr-app__images {
  margin: 0;
  padding: 0;
  list-style: none;
}
.rdr-list {
  display: grid;
  gap: var(--sp-3);
}
.rdr-app {
  display: grid;
  gap: var(--sp-3);
  min-width: 0;
  padding: var(--sp-4) var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.rdr-app__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-1) var(--sp-3);
}
.rdr-app__title {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: 700;
  overflow-wrap: anywhere;
}
.rdr-app__time,
.rdr-app__meta {
  font-size: var(--fs-13);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.rdr-app__meta {
  margin: calc(-1 * var(--sp-2)) 0 0;
}
.rdr-app__reason {
  margin: 0;
  padding: var(--sp-3);
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.rdr-app__images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--sp-2);
}
.rdr-app__images a {
  display: block;
  border-radius: var(--r-ctl);
}
.rdr-app__images a:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.rdr-app__images img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.rdr-app__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--sp-2);
}
.rdr-history {
  display: grid;
  border-top: 1px solid var(--line);
}
.history-item {
  display: grid;
  gap: var(--sp-1);
  padding: var(--sp-3) 0;
  border-bottom: 1px solid var(--line);
  min-width: 0;
}
.rdr-history__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  overflow-wrap: anywhere;
}
.rdr-history__line,
.rdr-history__note {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.rdr-history__note {
  color: var(--ink);
  white-space: pre-wrap;
}
@media (max-width: 767px) {
  .rdr-app {
    padding: var(--sp-4);
  }
  .rdr-app__actions .rw-btn {
    flex: 1 1 calc(50% - var(--sp-2));
  }
}
</style>
