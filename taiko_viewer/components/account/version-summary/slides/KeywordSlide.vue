<script setup lang="ts">
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualKeywordSigilScene from "../AnnualKeywordSigilScene.vue";

defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

</script>

<template>
  <AnnualKeywordSigilScene
    :summary="summary"
    :active="active"
    :reduced-motion="reducedMotion"
  />
</template>
