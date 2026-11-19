<script setup lang="ts">
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";
import DsSwatch from "../_shared/DsSwatch.vue";

defineOptions({ name: "DsSampleTokens" });

const groups: Array<{ name: string; tokens: string[]; stage?: boolean }> = [
  { name: "brand", tokens: ["--brand-primary", "--brand-hover", "--brand-soft", "--brand-on-primary", "--brand-focus"] },
  { name: "lightness", tokens: ["--bg-sunk", "--bg", "--surface", "--surface-2", "--overlay-bg"] },
  { name: "line / ink", tokens: ["--line", "--line-strong", "--ctl-border", "--ink", "--ink-2", "--ink-3"] },
  { name: "status", tokens: ["--ok", "--ok-wash", "--warn", "--warn-wash", "--danger", "--danger-wash"] },
  {
    name: "role",
    tokens: ["--action-bg", "--action-bg-hover", "--action-ink", "--link", "--selected-bg", "--selected-ink", "--selected-line", "--seg-on-bg", "--tab-line", "--nav-active-bg", "--focus-ring", "--input-focus-line", "--info-wash", "--info-ink", "--row-sel-bg", "--tag-info-bg", "--emph-num", "--series", "--toast-surface"]
  },
  { name: "domain: notes", tokens: ["--don", "--don-data", "--ka", "--roll", "--lane", "--lane-ka"] },
  { name: "domain: judge", tokens: ["--judge-good", "--judge-ok", "--judge-ng"] },
  { name: "domain: difficulty", tokens: ["--diff-easy", "--diff-normal", "--diff-hard", "--diff-oni", "--diff-ura"] },
  { name: "domain: crown / rank", tokens: ["--crown-clear", "--crown-fc", "--rank-iki1", "--rank-miyabi1", "--rank-kiwami", "--plate-ink"] },
  { name: "stage", tokens: ["--bg", "--surface", "--ink", "--ink-2", "--brand-primary", "--brand-soft", "--action-bg", "--don-data"], stage: true }
];
</script>

<template>
  <DsSampleShell title="tokens">
    <DsSampleBlock v-for="group in groups" :key="group.name" :name="group.name">
      <div :class="group.stage ? 'stage ds-stage-sample' : 'ds-tokens'">
        <DsSwatch v-for="token in group.tokens" :key="token" :token="token" />
      </div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-tokens,
.ds-stage-sample {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-4);
}
.ds-stage-sample {
  padding: var(--sp-4);
  border-radius: var(--r-panel);
}
</style>
