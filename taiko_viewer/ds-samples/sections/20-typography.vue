<script setup lang="ts">
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";

defineOptions({ name: "DsSampleTypography" });

const scale = ["--fs-11", "--fs-12", "--fs-13", "--fs-14", "--fs-16", "--fs-18", "--fs-22", "--fs-28", "--fs-36", "--fs-48", "--fs-64"];
</script>

<template>
  <DsSampleShell title="typography">
    <DsSampleBlock name="--font-ui / --fs-*">
      <ul class="ds-scale">
        <li v-for="token in scale" :key="token" :style="{ fontSize: `var(${token})` }">
          <code>{{ token }}</code> <span data-ds-specimen>Taiko 0123456789 太鼓の達人 太鼓达人</span>
        </li>
      </ul>
    </DsSampleBlock>
    <DsSampleBlock name="--font-num">
      <p class="num ds-num-row">1,004,290 · 98.76% · 11.97 · ★10</p>
    </DsSampleBlock>
    <DsSampleBlock name="number hierarchy">
      <div class="ds-hier" data-testid="ds-number-hierarchy">
        <span class="num ds-hier__main">13.42</span>
        <span class="num ds-hier__aux">/ 14.00</span>
        <span class="num ds-hier__aux">98.76%</span>
        <span class="num ds-hier__up"><span aria-hidden="true">▲</span>0.31</span>
        <span class="num ds-hier__down"><span aria-hidden="true">▼</span>0.12</span>
        <span class="ds-hier__na">—</span>
      </div>
    </DsSampleBlock>
    <DsSampleBlock name=":lang(ja)">
      <p lang="ja" class="ds-ja" data-ds-specimen>ドンだフルコンボ 1234</p>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-scale {
  margin: 0;
  padding: 0;
  list-style: none;
  line-height: var(--lh-snug);
  overflow-wrap: anywhere;
}
.ds-scale code {
  display: inline-block;
  min-width: 72px;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.ds-num-row {
  margin: 0;
  font-size: var(--fs-22);
}
.ds-hier {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--sp-3);
}
.ds-hier__main {
  font-size: var(--fs-48);
  font-weight: 700;
  color: var(--emph-num);
}
.ds-hier__aux {
  font-size: var(--fs-18);
  font-weight: 500;
  color: var(--ink-2);
}
.ds-hier__up {
  color: var(--ok);
}
.ds-hier__down {
  color: var(--ink-2);
}
.ds-hier__na {
  color: var(--ink-3);
}
.ds-ja {
  margin: 0;
  font-size: var(--fs-22);
}
</style>
