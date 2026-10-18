<script setup lang="ts">
import { computed, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { developerApis, developerApiOrigin, developerApiExamples, developerApiRequestPath, developerGuideCopy } from '~/utils/developer-api-guide';
const props = defineProps<{ locale: string; applicationStatus: string; tokenActive: boolean }>();
const language = computed(() => props.locale === 'ja' ? 'ja' : 'zh');
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
  <el-card class="developer-guide" data-developer-guide>
    <h3>{{ copy.title }}</h3>
    <p v-if="applicationStatus !== 'approved'" class="guide-alert" role="status">{{ copy.requiresApproval }}</p>
    <p v-else-if="!tokenActive" class="guide-alert" role="status">{{ copy.inactive }}</p>
    <nav class="api-overview" :aria-label="copy.title">
      <a v-for="api in examples" :key="api.id" :href="`#developer-api-${api.id}`" class="api-overview-item" @click.prevent="openApi(api.id)">
        <strong>{{ api.name[language] }}</strong>
        <span>{{ api.protected ? copy.protected : copy.public }}</span>
        <code>GET {{ developerApiRequestPath(api) }}</code>
        <span>{{ api.purpose[language] }}</span>
      </a>
    </nav>

    <details class="guide-details" data-token-help>
      <summary>{{ copy.active }}</summary>
      <p>{{ copy.tokenHelp }}</p>
      <p>{{ copy.setup }}</p>
      <div class="sample-header"><el-button plain :aria-label="`${copy.copy} (environment)`" @click="copyExample(setupExample)">{{ copy.copy }}</el-button></div>
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
                <div class="sample-header"><el-button plain :aria-label="`${copy.copy} (${api.id} ${copy[kind]})`" @click="copyExample(api.samples[kind])">{{ copy.copy }}</el-button></div>
                <pre tabindex="0" :aria-label="`${api.name[language]} ${copy[kind]}`"><code>{{ api.samples[kind] }}</code></pre>
              </div>
            </el-tab-pane>
          </el-tabs>
          <details class="json-example" data-example="json">
            <summary>{{ copy.json }}</summary>
            <div class="sample-header"><el-button plain :aria-label="`${copy.copy} (${api.id} ${copy.json})`" @click="copyExample(api.samples.json)">{{ copy.copy }}</el-button></div>
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
  </el-card>
</template>

<style scoped>
.developer-guide { min-width: 0; color: var(--el-text-color-primary); }
h3 { margin: 0; }
p { line-height: 1.8; overflow-wrap: anywhere; }
.api-overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; margin: 18px 0; }
.api-overview-item { display: grid; gap: 8px; padding: 14px; border: 1px solid var(--el-border-color); border-radius: 12px; color: inherit; text-decoration: none; overflow-wrap: anywhere; min-width: 0; }
.api-overview-item:hover { border-color: var(--el-color-primary); }
.api-overview-item span { font-size: 14px; line-height: 1.7; }
.guide-details { margin-top: 14px; border-top: 1px solid var(--el-border-color); padding-top: 8px; scroll-margin-top: 90px; min-width: 0; }
summary { cursor: pointer; min-height: 44px; align-content: center; font-weight: 600; overflow-wrap: anywhere; }
.auth-label { font-weight: 400; font-size: 13px; margin-inline-start: 10px; }
.guide-alert { color: var(--el-color-warning-dark-2); }
.sample-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; margin-top: 14px; }
.el-button { min-height: 44px; }
pre { max-width: 100%; overflow-x: auto; padding: 14px; border-radius: 10px; background: var(--el-fill-color-light); color: var(--el-text-color-primary); font-size: 13px; line-height: 1.65; white-space: pre; }
code { overflow-wrap: anywhere; }
.field-table { max-width: 100%; overflow-x: auto; }
table { border-collapse: collapse; width: 100%; min-width: 540px; line-height: 1.7; font-size: 14px; }
th, td { text-align: start; vertical-align: top; padding: 10px; border-bottom: 1px solid var(--el-border-color); overflow-wrap: anywhere; }
th:first-child { width: 27%; }

.api-panel { border: 1px solid var(--el-border-color); border-radius: 12px; margin-top: 18px; min-width: 0; scroll-margin-top: 90px; }
.api-panel-title { padding: 14px 18px; font-size: 17px; background: var(--el-fill-color-light); border-radius: 12px; }
.api-panel[open] > .api-panel-title { border-bottom: 1px solid var(--el-border-color); border-radius: 12px 12px 0 0; }
.api-panel-body { padding: 8px 22px 22px; min-width: 0; }
.guide-section { margin-top: 24px; min-width: 0; }
h4 { margin: 0 0 12px; font-size: 15px; }
.endpoint { font-size: 13px; padding-block: 10px; }
.code-tabs { min-width: 0; }
.code-tabs :deep(.el-tabs__item) { min-height: 44px; }
.code-tabs :deep(.el-tabs__content) { overflow: visible; }
.json-example { border-top: 1px dashed var(--el-border-color); margin-top: 16px; padding-top: 8px; }
:where(a, summary, button, pre, .field-table):focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 3px; }
.code-tabs :deep([role="tab"]:focus-visible) { outline: 2px solid var(--el-color-primary); outline-offset: -3px; }
@media (max-width: 600px) {
  .api-panel-title { padding: 12px; font-size: 16px; }
  .api-panel-body { padding: 4px 12px 16px; }
  .guide-section { margin-top: 20px; }
  pre { padding: 10px; }
  .auth-label { display: block; margin: 6px 0 0; }
}
</style>
