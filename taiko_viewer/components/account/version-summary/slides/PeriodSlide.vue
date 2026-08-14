<script setup lang="ts">
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualPeriodOverviewScene from "../AnnualPeriodOverviewScene.vue";

defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();
</script>

<template>
  <AnnualPeriodOverviewScene
    :summary="summary"
    :period-page-index="pageIndex"
    :page-total="pageTotal"
    :active="active"
    :reduced-motion="reducedMotion"
    :transition-time="0"
  />
</template>
