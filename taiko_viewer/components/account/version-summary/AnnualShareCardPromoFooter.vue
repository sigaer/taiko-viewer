<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  locale: string;
  qrCodeDataUrl?: string;
  qrTargetUrl: string;
}>();

const qrFailed = ref(false);
const ja = computed(() => props.locale === 'ja');

watch(() => props.qrCodeDataUrl, () => { qrFailed.value = false; });
</script>

<template>
  <footer
    class="annual-share-card-promo"
    :data-qr-target="qrTargetUrl"
    :aria-label="ja ? 'Sakura Taiko 年間レポート' : 'Sakura Taiko 年度报告'"
  >
    <div class="annual-share-card-promo__copy">
      <p class="annual-share-card-promo__brand">Sakura Taiko</p>
      <p class="annual-share-card-promo__cta">
        {{ ja ? 'あなたの太鼓年間レポートを作成' : '生成你的太鼓年度报告' }}
      </p>
      <p class="annual-share-card-promo__domain">viewer.sakura-bot.cn</p>
    </div>

    <img
      v-if="qrCodeDataUrl && !qrFailed"
      class="annual-share-card-promo__qr"
      :src="qrCodeDataUrl"
      alt="viewer.sakura-bot.cn QR"
      @error="qrFailed = true"
    >
    <div v-else class="annual-share-card-promo__qr-fallback" aria-hidden="true">
      viewer.sakura-bot.cn
    </div>
  </footer>
</template>

<style scoped>
.annual-share-card-promo {
  --promo-footer-height: 224px;
  --promo-padding-x: 52px;
  --promo-padding-y: 34px;
  --promo-qr-size: 136px;
  --promo-content-gap: 40px;
  --promo-line-gap: 8px;
  width: 1080px;
  height: var(--promo-footer-height);
  box-sizing: border-box;
  padding: var(--promo-padding-y) var(--promo-padding-x);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--promo-content-gap);
  overflow: hidden;
  color: #17365d;
  background: #fbfcfe;
  font-family: var(--viewer-font-family, sans-serif);
}

.annual-share-card-promo__copy {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--promo-line-gap);
}

.annual-share-card-promo__copy p { margin: 0; }
.annual-share-card-promo__brand { font-size: 25px; line-height: 1.2; font-weight: 700; letter-spacing: .02em; }
.annual-share-card-promo__cta { font-size: 34px; line-height: 1.25; font-weight: 800; letter-spacing: -.025em; }
.annual-share-card-promo__domain { font-size: 23px; line-height: 1.2; font-weight: 600; letter-spacing: .01em; color: #526b86; }

.annual-share-card-promo__qr,
.annual-share-card-promo__qr-fallback {
  width: var(--promo-qr-size);
  height: var(--promo-qr-size);
  flex: 0 0 var(--promo-qr-size);
}

.annual-share-card-promo__qr {
  display: block;
  object-fit: contain;
  background: #fff;
}

.annual-share-card-promo__qr-fallback {
  box-sizing: border-box;
  display: grid;
  place-items: center;
  padding: 16px;
  color: #17365d;
  background: #fff;
  font-size: 16px;
  line-height: 1.25;
  font-weight: 700;
  overflow-wrap: anywhere;
  text-align: center;
}
</style>
