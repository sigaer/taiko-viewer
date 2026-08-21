<script setup lang="ts">
import AnnualMonthlyLeafScene from "../AnnualMonthlyLeafScene.vue";
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
  <AnnualMonthlyLeafScene
    v-if="summary.monthlyFavorites?.length"
    :summary="summary"
    :page-index="pageIndex"
    :page-total="pageTotal"
    :active="active"
    :reduced-motion="reducedMotion"
  />
</template>
