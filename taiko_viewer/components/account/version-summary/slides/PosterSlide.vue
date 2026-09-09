<script setup lang="ts">
import { nextTick, ref } from 'vue';
import type { VersionSummaryViewModel } from '~/types/account-version-summary';
import AnnualShareGrid from '../AnnualShareGrid.vue';
import LegacyPosterShare from './LegacyPosterShare.vue';
const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, locale } = useI18n();
const reactionSync = ref(true);
const imageSync = ref(true);
const reflection = ref('');
const legacyDialog = ref<HTMLDialogElement | null>(null);
const legacyOpened = ref(false);
const openLegacy = async () => { legacyOpened.value = true; await nextTick(); legacyDialog.value?.showModal(); };
</script>

<template>
  <section class="poster-scene" :aria-label="t('annualSummary.staticPoster.report')">
    <div class="poster-scene__layout">
      <div class="poster-scene__danmaku" role="region" :aria-label="t('annualSummary.staticPoster.reflections')"><p>{{ t('annualSummary.staticPoster.empty') }}</p></div>
      <div class="poster-scene__compose">
        <label class="poster-scene__input"><span class="poster-scene__sr">{{ t('annualSummary.staticPoster.reflections') }}</span><textarea v-model="reflection" maxlength="60" :placeholder="t('annualSummary.staticPoster.placeholder')" /></label>
        <div class="poster-scene__send"><label class="poster-scene__sync"><input v-model="reactionSync" type="checkbox">{{ t('annualSummary.staticPoster.sync') }}</label><button type="button" disabled :title="t('annualSummary.staticPoster.unavailable')">{{ t('annualSummary.staticPoster.send') }}</button></div>
      </div>
      <AnnualShareGrid class="poster-scene__grid" :summary="summary" :locale="locale" />
      <div class="poster-scene__actions"><button type="button" disabled :title="t('annualSummary.staticPoster.unavailable')">{{ t('annualSummary.staticPoster.save') }}</button><label class="poster-scene__sync"><input v-model="imageSync" type="checkbox">{{ t('annualSummary.staticPoster.sync') }}</label><button type="button" class="poster-scene__legacy" @click="openLegacy">{{ t('annualSummary.staticPoster.legacy') }}</button></div>
    </div>
    <dialog ref="legacyDialog" class="poster-scene__dialog"><button class="poster-scene__close" type="button" @click="legacyDialog?.close()">{{ t('annualSummary.staticPoster.close') }}</button><LegacyPosterShare v-if="legacyOpened" v-bind="props" /></dialog>
  </section>
</template>

<style scoped>
.poster-scene{height:100%;width:100%;container-type:size;background:url('/annual/poster/background_22.png') center/cover no-repeat;color:white;position:relative;overflow:hidden}
.poster-scene__layout{height:100%;box-sizing:border-box;padding:56px 0 max(8px,env(safe-area-inset-bottom));display:grid;grid-template-rows:minmax(42px,1fr) 76px auto 100px;gap:8px;justify-items:center}
.poster-scene__danmaku{width:87.68%;max-width:363px;display:grid;place-items:center;text-align:center}.poster-scene__danmaku p{margin:0;font-size:13px;color:#fff;text-shadow:0 1px 5px #00182f}
.poster-scene__compose{width:min(87.68%,363px);display:grid;grid-template-columns:minmax(0,1fr) 124px;gap:10px;min-height:0}.poster-scene__input textarea{resize:none;box-sizing:border-box;width:100%;height:100%;border:1px solid #182d45;border-radius:16px;background:#ffffffb8;color:#142b43;padding:10px 12px;font:600 15px/1.4 var(--viewer-font-family,sans-serif)}.poster-scene__input textarea::placeholder{color:#344e68;opacity:1}.poster-scene__send{display:flex;flex-direction:column;justify-content:space-between}
.poster-scene button{font-family:inherit}.poster-scene__send button,.poster-scene__actions>button:first-child{min-height:44px;padding:5px 18px;border:2px solid #e9f3fb;border-radius:99px;color:white;background:#222a30;font-size:17px;font-weight:800;box-shadow:0 2px 6px #0005}.poster-scene__send button{padding-inline:10px;font-size:16px;white-space:nowrap}.poster-scene__send .poster-scene__sync{white-space:normal;font-size:11px;line-height:1.15}.poster-scene button:disabled{cursor:not-allowed}.poster-scene__sync{display:flex;align-items:center;justify-content:center;gap:4px;min-height:28px;font-size:12px;font-weight:700;white-space:nowrap}.poster-scene__sync input{width:17px;height:17px;margin:0;accent-color:#2373af;cursor:pointer}.poster-scene__grid{width:min(87.68cqw,363px,calc((100cqh - 314px)*363/554));align-self:center}
.poster-scene__actions{display:flex;align-items:center;flex-direction:column;gap:0}.poster-scene__legacy{min-height:28px;padding:2px 12px;color:#fff;background:transparent;border:0;text-decoration:underline;font-size:12px;cursor:pointer}.poster-scene :focus-visible{outline:3px solid #ffe29a;outline-offset:2px}.poster-scene__sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.poster-scene__dialog{width:min(900px,94vw);height:85dvh;max-height:85dvh;padding:0;border:1px solid #ccd9e5;border-radius:18px;background:#f7fbff;overflow:auto}.poster-scene__dialog::backdrop{background:#00192bc4}.poster-scene__close{position:sticky;top:8px;left:12px;z-index:2;min-height:44px;padding:8px 16px;border:1px solid #3978c8;border-radius:99px;background:#fff;color:#17365d;cursor:pointer}
@media(max-height:810px){.poster-scene__layout{grid-template-rows:minmax(30px,1fr) 76px auto 100px;gap:6px}.poster-scene__grid{width:min(87.68cqw,363px,calc((100cqh - 288px)*363/554))}}
</style>
