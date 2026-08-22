<script setup lang="ts">
import AnnualWeekdayForestScene from "../AnnualWeekdayForestScene.vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";

defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();
</script>

<template>
  <AnnualWeekdayForestScene
    v-if="summary.weekdayActivity"
    :summary="summary"
    :page-index="pageIndex"
    :page-total="pageTotal"
    :active="active"
    :reduced-motion="reducedMotion"
  />
</template>
