<script setup lang="ts">
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualRatingRankScene from "../AnnualRatingRankScene.vue";

defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();
</script>

<template>
  <AnnualRatingRankScene
    :summary="summary"
    :page-index="pageIndex"
    :page-total="pageTotal"
    :active="active"
    :reduced-motion="reducedMotion"
  />
</template>
