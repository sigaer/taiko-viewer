<script setup lang="ts">
// ReworkScoreTokenDocs — the body of the public page /docs/score-token: the user guide (steps, safety note) and the
// developer reference (method, endpoint, content type, request and response examples, errors, constraints). Code
// blocks scroll inside themselves (keyboard: they take focus), never the page. The examples hold no real token.
import type { PropType } from "vue";

type DocsCopy = {
  userTitle: string;
  steps: string[];
  safetyTitle: string;
  safety: string;
  devTitle: string;
  requestTitle: string;
  responseTitle: string;
  responseNote: string;
  errorsTitle: string;
  notesTitle: string;
  notes: string[];
  errors: Array<{ code: string; text: string }>;
};
defineProps({
  copy: { type: Object as PropType<DocsCopy>, required: true },
  requestExample: { type: String, required: true },
  responseExample: { type: String, required: true }
});
</script>

<template>
  <section class="rtd-sec docs-section" aria-labelledby="token-docs-user">
    <h2 id="token-docs-user" class="rtd-sec__title">{{ copy.userTitle }}</h2>
    <ol class="rtd-steps step-list">
      <li v-for="(step, index) in copy.steps" :key="step">
        <span class="rtd-steps__n num" aria-hidden="true">{{ index + 1 }}</span>
        <p>{{ step }}</p>
      </li>
    </ol>
    <aside class="rtd-safety safety-note" :aria-label="copy.safetyTitle">
      <strong><ReworkIcon name="warn" class="rtd-safety__icon" />{{ copy.safetyTitle }}</strong>
      <p>{{ copy.safety }}</p>
    </aside>
  </section>

  <section class="rtd-sec docs-section api-section" aria-labelledby="token-docs-dev">
    <h2 id="token-docs-dev" class="rtd-sec__title">{{ copy.devTitle }}</h2>
    <dl class="rtd-facts api-facts">
      <div><dt>Method</dt><dd><code>POST</code></dd></div>
      <div><dt>Endpoint</dt><dd><code>https://sakura-bot.cn/api/public-score/by-token</code></dd></div>
      <div><dt>Content-Type</dt><dd><code>application/json</code></dd></div>
    </dl>

    <h3 class="rtd-sec__sub">{{ copy.requestTitle }}</h3>
    <pre class="rtd-code" tabindex="0" :aria-label="copy.requestTitle"><code>{{ requestExample }}</code></pre>
    <h3 class="rtd-sec__sub">{{ copy.responseTitle }}</h3>
    <pre class="rtd-code" tabindex="0" :aria-label="copy.responseTitle"><code>{{ responseExample }}</code></pre>
    <p class="rtd-note response-note">{{ copy.responseNote }}</p>

    <h3 class="rtd-sec__sub">{{ copy.errorsTitle }}</h3>
    <table class="rtd-errors error-table">
      <tbody>
        <tr v-for="row in copy.errors" :key="row.code">
          <th scope="row"><code>{{ row.code }}</code></th>
          <td>{{ row.text }}</td>
        </tr>
      </tbody>
    </table>

    <h3 class="rtd-sec__sub">{{ copy.notesTitle }}</h3>
    <ul class="rtd-notes">
      <li v-for="note in copy.notes" :key="note">{{ note }}</li>
    </ul>
  </section>
</template>

<style scoped>
.rtd-sec {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  min-width: 0;
  padding-top: var(--sp-5);
  border-top: 1px solid var(--line);
  color: var(--ink);
  font-family: var(--font-ui);
}
.rtd-sec__title {
  margin: 0;
  font-size: var(--fs-22);
  font-weight: 700;
  line-height: var(--lh-snug);
}
.rtd-sec__sub {
  margin: var(--sp-3) 0 0;
  font-size: var(--fs-16);
  font-weight: 700;
}
.rtd-steps {
  display: grid;
  gap: var(--sp-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.rtd-steps li {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: start;
  gap: var(--sp-3);
}
.rtd-steps__n {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg-sunk);
  border: 1px solid var(--line-strong);
  font-size: var(--fs-14);
}
.rtd-steps p {
  margin: 3px 0 0;
  font-size: var(--fs-16);
  line-height: var(--lh-body);
  overflow-wrap: anywhere;
}
.rtd-safety {
  display: grid;
  gap: var(--sp-1);
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--warn);
  border-radius: var(--r-ctl);
  background: var(--warn-wash);
}
.rtd-safety strong {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}
.rtd-safety__icon {
  width: 18px;
  height: 18px;
}
.rtd-safety p {
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  overflow-wrap: anywhere;
}
.rtd-facts {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) 180px;
  margin: 0;
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  overflow: hidden;
}
.rtd-facts > div {
  display: grid;
  gap: var(--sp-1);
  min-width: 0;
  padding: var(--sp-3);
  background: var(--surface);
}
.rtd-facts > div + div {
  border-left: 1px solid var(--line);
}
.rtd-facts dt {
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.rtd-facts dd {
  margin: 0;
  min-width: 0;
}
.rtd-facts code,
.rtd-code,
.rtd-errors code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0;
}
.rtd-facts code {
  overflow-wrap: anywhere;
}
.rtd-code {
  max-width: 100%;
  margin: 0;
  overflow-x: auto;
  padding: var(--sp-4);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  color: var(--ink);
  font-size: var(--fs-13);
  line-height: 1.7;
  white-space: pre;
}
.rtd-code:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.rtd-note {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.rtd-errors {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-14);
}
.rtd-errors th,
.rtd-errors td {
  padding: var(--sp-2) var(--sp-3) var(--sp-2) 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}
.rtd-errors th {
  width: 64px;
  font-weight: 600;
}
.rtd-notes {
  display: grid;
  gap: var(--sp-2);
  margin: 0;
  padding-left: 22px;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  color: var(--ink-2);
}
@media (max-width: 767px) {
  .rtd-facts {
    grid-template-columns: minmax(0, 1fr);
  }
  .rtd-facts > div + div {
    border-left: 0;
    border-top: 1px solid var(--line);
  }
}
</style>
