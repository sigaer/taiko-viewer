<script setup lang="ts">
// The developer API guide of /account/developer (moved from components/account/DeveloperApiGuide.vue in slice E2; the
// script is unchanged). Static documentation from utils/developer-api-guide.ts: an overview of the four APIs (a link
// opens and focuses that API's panel), token setup, and per API the endpoint, parameters, fields, cURL / Python
// examples (tabs), a JSON example and errors. Code blocks and the field table scroll inside themselves and take focus;
// the copy buttons copy the example only (never a token: the examples hold placeholders). No request of its own.
// The data-* hooks and class names are read by tests/developerApiGuideUi.test.mjs. Only the language selection line
// changed (same result for zh / ja).
import { computed, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { developerApis, developerApiOrigin, developerApiExamples, developerApiRequestPath, developerGuideCopy } from '~/utils/developer-api-guide';
const props = defineProps<{ locale: string; applicationStatus: string; tokenActive: boolean }>();
// The page passes the site locale (zh / ja); the guide's texts are keyed the same way, zh otherwise.
const language = computed(() => (Object.hasOwn(developerGuideCopy, props.locale) ? props.locale : 'zh') as keyof typeof developerGuideCopy);
const copy = computed(() => developerGuideCopy[language.value]);
const setupExample = 'export TAIKO_SOURCE_ID=\'YOUR_SOURCE_ID\'\nexport TAIKO_VIEWER_DEVELOPER_TOKEN=\'YOUR_DEVELOPER_TOKEN\'';
const examples = developerApis.map(api => ({ ...api, samples: developerApiExamples(api) }));
const panels = new Map<string, HTMLDetailsElement>();
const activeExamples = reactive<Record<string, string>>(Object.fromEntries(developerApis.map(api => [api.id, 'curl'])));
function setPanel(id: string, element: unknown) {
  if (element instanceof HTMLDetailsElement) panels.set(id, element);
  else panels.delete(id);
}
function openApi(id: string) {
  const panel = panels.get(id);
  if (!panel) return;
  panel.open = true;
  panel.scrollIntoView({ block: 'start' });
  panel.querySelector('summary')?.focus({ preventScroll: true });
}
async function copyExample(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    ElMessage.success(copy.value.copied);
  } catch {
    ElMessage.warning(copy.value.copyFailed);
  }
}
</script>

<template>
  <section class="developer-guide rdg" data-developer-guide aria-labelledby="developer-guide-title">
    <h2 id="developer-guide-title" class="rdg__title">{{ copy.title }}</h2>
    <p v-if="applicationStatus !== 'approved'" class="guide-alert rdg__alert" role="status">{{ copy.requiresApproval }}</p>
    <p v-else-if="!tokenActive" class="guide-alert rdg__alert" role="status">{{ copy.inactive }}</p>
    <nav class="api-overview" :aria-label="copy.title">
      <a v-for="api in examples" :key="api.id" :href="`#developer-api-${api.id}`" class="api-overview-item" @click.prevent="openApi(api.id)">
        <strong>{{ api.name[language] }}</strong>
        <span class="rdg__auth" :class="{ 'is-public': !api.protected }">{{ api.protected ? copy.protected : copy.public }}</span>
        <code>GET {{ developerApiRequestPath(api) }}</code>
        <span>{{ api.purpose[language] }}</span>
      </a>
    </nav>

    <details class="guide-details" data-token-help>
      <summary>{{ copy.active }}</summary>
      <p>{{ copy.tokenHelp }}</p>
      <p>{{ copy.setup }}</p>
      <div class="sample-header"><button type="button" class="rw-btn rw-btn--sm" :aria-label="`${copy.copy} (environment)`" @click="copyExample(setupExample)"><ReworkIcon name="copy" />{{ copy.copy }}</button></div>
      <pre tabindex="0"><code>{{ setupExample }}</code></pre>
    </details>

    <details v-for="api in examples" :id="`developer-api-${api.id}`" :key="api.id" :ref="el => setPanel(api.id, el)" class="api-panel" :data-api="api.id">
      <summary class="api-panel-title">{{ api.name[language] }} <span class="auth-label">{{ api.protected ? copy.protected : copy.public }}</span></summary>
      <div class="api-panel-body">
        <p class="endpoint"><code>GET {{ developerApiOrigin }}{{ developerApiRequestPath(api) }}</code></p>
        <p>{{ api.purpose[language] }}</p>
        <section class="guide-section">
          <h4>{{ copy.params }}</h4>
          <p>{{ api.protected ? copy.sourceParam : copy.noParams }}</p>
          <p>{{ api.note[language] }}</p>
        </section>
        <section class="guide-section">
          <h4>{{ copy.fields }}</h4>
          <div class="field-table" tabindex="0" :aria-label="copy.fields">
            <table>
              <thead><tr><th scope="col">{{ copy.field }}</th><th scope="col">{{ copy.type }}</th><th scope="col">{{ copy.meaning }}</th></tr></thead>
              <tbody><tr v-for="field in api.fields" :key="field.name"><th scope="row"><code>{{ field.name }}</code></th><td>{{ field.type }}</td><td>{{ field.description[language] }}</td></tr></tbody>
            </table>
          </div>
        </section>
        <section class="guide-section" data-examples>
          <h4>{{ copy.examples }}</h4>
          <p>{{ api.protected ? copy.setup : copy.publicSetup }}</p>
          <el-tabs v-model="activeExamples[api.id]" class="code-tabs">
            <el-tab-pane v-for="kind in (['curl', 'python'] as const)" :key="kind" :name="kind" :label="copy[kind]">
              <div :data-example="kind">
                <div class="sample-header"><button type="button" class="rw-btn rw-btn--sm" :aria-label="`${copy.copy} (${api.id} ${copy[kind]})`" @click="copyExample(api.samples[kind])"><ReworkIcon name="copy" />{{ copy.copy }}</button></div>
                <pre tabindex="0" :aria-label="`${api.name[language]} ${copy[kind]}`"><code>{{ api.samples[kind] }}</code></pre>
              </div>
            </el-tab-pane>
          </el-tabs>
          <details class="json-example" data-example="json">
            <summary>{{ copy.json }}</summary>
            <div class="sample-header"><button type="button" class="rw-btn rw-btn--sm" :aria-label="`${copy.copy} (${api.id} ${copy.json})`" @click="copyExample(api.samples.json)"><ReworkIcon name="copy" />{{ copy.copy }}</button></div>
            <pre tabindex="0" :aria-label="`${api.name[language]} ${copy.json}`"><code>{{ api.samples.json }}</code></pre>
          </details>
        </section>
        <section class="guide-section"><h4>{{ copy.errors }}</h4><p>{{ api.errors[language] }}</p></section>
      </div>
    </details>
    <details class="guide-details" data-common>
      <summary>{{ copy.common }}</summary>
      <p>{{ copy.safety }}</p><p>{{ copy.quota }}</p><p>{{ copy.busy }}</p><p>{{ copy.cache }}</p><p>{{ copy.version }}</p>
    </details>
  </section>
</template>

<style scoped>
.rdg {
  min-width: 0;
  padding: var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-ui);
}
.rdg__title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
  line-height: var(--lh-snug);
}
p {
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  overflow-wrap: anywhere;
}
.rdg__alert {
  margin-top: var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-ctl);
  background: var(--warn-wash);
  color: var(--ink);
}
.api-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: var(--sp-3);
  margin: var(--sp-4) 0;
}
.api-overview-item {
  display: grid;
  align-content: start;
  gap: 6px;
  min-width: 0;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  color: inherit;
  text-decoration: none;
  overflow-wrap: anywhere;
}
.api-overview-item:hover {
  border-color: var(--line-strong);
  background: var(--bg-sunk);
}
.api-overview-item strong {
  color: var(--link);
}
.api-overview-item > span:not(.rdg__auth) {
  font-size: var(--fs-13);
  line-height: var(--lh-snug);
  color: var(--ink-2);
}
.rdg__auth {
  justify-self: start;
  padding: 0 8px;
  border-radius: var(--tag-radius);
  background: var(--tag-info-bg);
  color: var(--tag-info-ink);
  font-weight: 600;
}
.rdg__auth.is-public {
  background: var(--ok-wash);
  color: var(--ink);
}
.api-overview-item code {
  font-size: var(--fs-12);
}
.guide-details {
  margin-top: var(--sp-3);
  padding-top: var(--sp-1);
  border-top: 1px solid var(--line);
  scroll-margin-top: calc(var(--bar-h) + var(--sp-6));
  min-width: 0;
}
summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-1) var(--sp-3);
  min-height: var(--hit);
  font-weight: 600;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.auth-label {
  font-weight: 400;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.sample-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}
.sample-header .rw-btn svg {
  width: 16px;
  height: 16px;
}
pre {
  max-width: 100%;
  margin: var(--sp-2) 0 0;
  overflow-x: auto;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  color: var(--ink);
  font-size: var(--fs-13);
  line-height: 1.65;
  white-space: pre;
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow-wrap: anywhere;
}
pre code {
  overflow-wrap: normal;
}
.field-table {
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
}
table {
  border-collapse: collapse;
  width: 100%;
  min-width: 540px;
  font-size: var(--fs-13);
  line-height: var(--lh-body);
}
th,
td {
  text-align: start;
  vertical-align: top;
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--line);
  overflow-wrap: anywhere;
}
thead th {
  background: var(--bg-sunk);
  font-weight: 600;
  color: var(--ink-2);
}
tbody tr:last-child > * {
  border-bottom: 0;
}
th:first-child {
  width: 27%;
}
.api-panel {
  margin-top: var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  min-width: 0;
  scroll-margin-top: calc(var(--bar-h) + var(--sp-6));
}
.api-panel-title {
  padding: var(--sp-2) var(--sp-4);
  font-size: var(--fs-16);
  border-radius: var(--r-ctl);
}
.api-panel-title:hover {
  background: var(--bg-sunk);
}
.api-panel[open] > .api-panel-title {
  border-bottom: 1px solid var(--line);
  border-radius: var(--r-ctl) var(--r-ctl) 0 0;
}
.api-panel-body {
  padding: var(--sp-1) var(--sp-4) var(--sp-4);
  min-width: 0;
}
.guide-section {
  margin-top: var(--sp-5);
  min-width: 0;
}
h4 {
  margin: 0;
  font-size: var(--fs-14);
  font-weight: 700;
}
.endpoint {
  font-size: var(--fs-13);
  padding-block: var(--sp-2);
}
.code-tabs {
  min-width: 0;
}
.code-tabs :deep(.el-tabs__item) {
  min-height: var(--hit);
}
.code-tabs :deep(.el-tabs__content) {
  overflow: visible;
}
.json-example {
  margin-top: var(--sp-3);
  padding-top: var(--sp-1);
  border-top: 1px dashed var(--line);
}
:where(a, summary, pre, .field-table):focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.code-tabs :deep([role="tab"]:focus-visible) {
  outline: 2px solid var(--focus-ring);
  outline-offset: -3px;
}
@media (max-width: 767px) {
  .rdg {
    padding: var(--sp-4);
  }
  .api-panel-title {
    padding: var(--sp-2) var(--sp-3);
  }
  .api-panel-body {
    padding: var(--sp-1) var(--sp-3) var(--sp-3);
  }
  pre {
    padding: var(--sp-3);
  }
}
</style>
