<script setup lang="ts">
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { PERIOD_OVERVIEW_DURATION_MS } from "~/utils/annualTransition";
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
    :period-page-index="pageIndex - 1"
    :page-total="pageTotal"
    :active="active"
    :reduced-motion="reducedMotion"
    :transition-time="PERIOD_OVERVIEW_DURATION_MS"
  />
</template>
