<script setup lang="ts">
// P0-28 browser example: a style that depends on an attribute of <html>, written the way the conventions
// require — a plain scoped selector with the root attribute in front of it — NOT `:global(html[…]) .x`
// (Vue keeps only the :global() part and the rule would land on <html> itself).
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";

defineOptions({ name: "DsSampleRootAttribute" });

const on = ref(false);
const toggle = () => {
  on.value = !on.value;
  document.documentElement.toggleAttribute("data-ds-probe", on.value);
};
onDeactivated(() => {
  on.value = false;
  document.documentElement.removeAttribute("data-ds-probe");
});
onBeforeUnmount(() => document.documentElement.removeAttribute("data-ds-probe"));
</script>

<template>
  <DsSampleShell title="root-attribute">
    <DsSampleBlock name="html[data-ds-probe] .ds-probe">
      <el-button data-testid="ds-probe-toggle" @click="toggle">data-ds-probe: {{ on ? "on" : "off" }}</el-button>
      <div class="ds-probe" data-testid="ds-probe">probe</div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-probe {
  padding: var(--sp-3) var(--sp-4);
  border: 2px solid var(--line);
  border-radius: var(--r-ctl);
}
html[data-ds-probe] .ds-probe {
  border-color: var(--brand-primary);
  outline: 4px solid var(--brand-primary);
}
</style>
