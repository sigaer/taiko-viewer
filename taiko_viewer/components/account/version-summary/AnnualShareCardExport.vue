<script setup lang="ts">
import type { VersionSummaryViewModel } from '~/types/account-version-summary';
import AnnualShareGrid from './AnnualShareGrid.vue';
import AnnualShareCardPromoFooter from './AnnualShareCardPromoFooter.vue';

defineProps<{
  summary: VersionSummaryViewModel;
  locale: string;
  qrCodeDataUrl?: string;
  qrTargetUrl: string;
}>();
</script>

<template>
  <article class="annual-share-card-export">
    <AnnualShareGrid :summary="summary" :locale="locale" export-mode />
    <AnnualShareCardPromoFooter
      :locale="locale"
      :qr-code-data-url="qrCodeDataUrl"
      :qr-target-url="qrTargetUrl"
    />
  </article>
</template>

<style scoped>
.annual-share-card-export {
  --share-card-content-height: 1648px;
  --share-card-footer-height: 224px;
  width: 1080px;
  height: calc(var(--share-card-content-height) + var(--share-card-footer-height));
  display: grid;
  grid-template-rows: var(--share-card-content-height) var(--share-card-footer-height);
  overflow: hidden;
  background: #fff;
}

.annual-share-card-export > :deep(.annual-share-grid) {
  width: 1080px;
  height: var(--share-card-content-height);
  aspect-ratio: auto;
}
</style>
