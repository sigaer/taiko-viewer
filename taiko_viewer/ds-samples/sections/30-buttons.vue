<script setup lang="ts">
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";

defineOptions({ name: "DsSampleButtons" });
</script>

<template>
  <DsSampleShell title="buttons">
    <DsSampleBlock name="primary / secondary / text">
      <el-button type="primary" data-testid="ds-btn-primary">primary</el-button>
      <el-button data-testid="ds-btn-secondary">secondary</el-button>
      <el-button text data-testid="ds-btn-text">text</el-button>
      <el-button link type="primary">link</el-button>
    </DsSampleBlock>
    <DsSampleBlock name="destructive">
      <el-button type="danger" data-testid="ds-btn-danger">danger</el-button>
    </DsSampleBlock>
    <DsSampleBlock name="plain / disabled / loading">
      <el-button type="primary" plain>primary plain</el-button>
      <el-button type="primary" disabled>primary disabled</el-button>
      <el-button disabled>secondary disabled</el-button>
      <el-button type="primary" loading>loading</el-button>
    </DsSampleBlock>
    <DsSampleBlock name="stage">
      <div class="stage ds-stage-buttons">
        <el-button type="primary">primary</el-button>
        <el-button>secondary</el-button>
        <el-button text>text</el-button>
      </div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-stage-buttons {
  display: flex;
  gap: var(--sp-3);
  padding: var(--sp-4);
  border-radius: var(--r-panel);
}
</style>
