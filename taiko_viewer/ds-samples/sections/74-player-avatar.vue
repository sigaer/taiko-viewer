<script setup lang="ts">
import { ref } from "vue";
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";
import data from "../data/atoms.json";

defineOptions({ name: "DsSamplePlayerAvatar" });

const sizes = [24, 32, 44, 72, 96] as const;
const inputs = [
  { key: "uploaded", src: data.avatars.square },
  { key: "non-square", src: data.avatars.nonSquare },
  { key: "broken", src: data.avatars.broken },
  { key: "server-default", src: data.avatars.serverDefault },
  { key: "none", src: null }
];
const swapped = ref(false);
</script>

<template>
  <DsSampleShell title="player-avatar">
    <DsSampleBlock v-for="input in inputs" :key="input.key" :name="`${input.key} · 24 / 32 / 44 / 72 / 96`">
      <div class="ds-s-row" :data-testid="`avatar-${input.key}`">
        <DsPlayerAvatar v-for="size in sizes" :key="size" :src="input.src" :size="size" />
      </div>
    </DsSampleBlock>
    <DsSampleBlock name="src change (uploaded ↔ broken)">
      <div class="ds-s-row" data-testid="avatar-swap">
        <DsPlayerAvatar :src="swapped ? data.avatars.broken : data.avatars.square" :size="44" />
        <el-button size="small" data-testid="avatar-swap-btn" @click="swapped = !swapped">swap</el-button>
      </div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-s-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-4);
  width: 100%;
}
</style>
