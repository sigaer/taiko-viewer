<script setup lang="ts">
import AnnualCalendarScene from "../AnnualCalendarScene.vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";

defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
</script>

<template>
  <AnnualCalendarScene
    v-if="summary.calendarActivity"
    :summary="summary"
    :page-index="pageIndex"
    :page-total="pageTotal"
    :active="active"
    :reduced-motion="reducedMotion"
  />
</template>
