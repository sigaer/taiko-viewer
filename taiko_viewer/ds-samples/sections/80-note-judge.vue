<script setup lang="ts">
// P0-15 samples: DsNote and DsJudgeBar. Invented counts.
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";
import DsNote from "~/components/ds/Note.vue";
import DsJudgeBar from "~/components/ds/JudgeBar.vue";

defineOptions({ name: "DsSampleNoteJudge" });

const types = ["don", "ka", "roll", "ghost"] as const;
const judges = [
  { state: "normal", good: 688, ok: 41, ng: 3 },
  { state: "ok = 0", good: 712, ok: 0, ng: 20 },
  { state: "ng = 0", good: 690, ok: 42, ng: 0 },
  { state: "good = 0", good: 0, ok: 300, ng: 432 },
  { state: "all-perfect", good: 1024, ok: 0, ng: 0 },
  { state: "all 0", good: 0, ok: 0, ng: 0 },
  { state: "missing", good: null, ok: null, ng: null },
  { state: "extreme", good: 1_234_567, ok: 1, ng: 1 }
];
</script>

<template>
  <DsSampleShell title="note / judge-bar">
    <DsSampleBlock name="DsNote · don / ka / roll / ghost">
      <figure v-for="ty in types" :key="ty" class="ds-cell">
        <DsNote :type="ty" :data-testid="`ds-note-${ty}`" />
        <figcaption>{{ ty }}</figcaption>
      </figure>
    </DsSampleBlock>
    <DsSampleBlock name="DsNote · big">
      <figure v-for="ty in types" :key="ty" class="ds-cell">
        <DsNote :type="ty" big />
        <figcaption>big {{ ty }}</figcaption>
      </figure>
    </DsSampleBlock>
    <DsSampleBlock name="DsNote · fc / dfc">
      <figure class="ds-cell"><DsNote marker="fc" /><figcaption>fc</figcaption></figure>
      <figure class="ds-cell"><DsNote marker="fc" big /><figcaption>big fc</figcaption></figure>
      <figure class="ds-cell"><DsNote marker="dfc" /><figcaption>dfc</figcaption></figure>
      <figure class="ds-cell"><DsNote marker="dfc" big /><figcaption>big dfc</figcaption></figure>
      <figure class="ds-cell"><DsNote type="ka" marker="fc" big /><figcaption>big ka fc</figcaption></figure>
    </DsSampleBlock>
    <DsSampleBlock name="DsNote · labelled">
      <DsNote labelled data-testid="ds-note-labelled-don" />
      <DsNote type="ka" big labelled />
      <DsNote type="ghost" labelled />
      <DsNote marker="dfc" big labelled />
    </DsSampleBlock>
    <DsSampleBlock name="DsNote · stage">
      <div class="stage ds-stage-row">
        <DsNote v-for="ty in types" :key="ty" :type="ty" big />
        <DsNote marker="fc" big />
        <DsNote marker="dfc" big />
      </div>
    </DsSampleBlock>
    <DsSampleBlock v-for="j in judges" :key="j.state" :name="`DsJudgeBar · ${j.state}`">
      <div class="ds-judge-cell">
        <DsJudgeBar :good="j.good" :ok="j.ok" :ng="j.ng" :data-testid="`ds-judge-${j.state}`" />
      </div>
    </DsSampleBlock>
    <DsSampleBlock name="DsJudgeBar · stage">
      <div class="stage ds-stage-pad ds-judge-cell">
        <DsJudgeBar :good="688" :ok="41" :ng="3" />
      </div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-cell {
  display: grid;
  justify-items: center;
  gap: var(--sp-1);
  margin: 0;
  min-inline-size: 64px;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.ds-stage-row {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-4);
  border-radius: var(--r-panel);
}
.ds-stage-pad {
  padding: var(--sp-4);
  border-radius: var(--r-panel);
}
.ds-judge-cell {
  inline-size: 320px;
  max-inline-size: 100%;
}
</style>
