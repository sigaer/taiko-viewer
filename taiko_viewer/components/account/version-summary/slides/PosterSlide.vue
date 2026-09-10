<script setup lang="ts">
import { defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { VersionSummaryViewModel } from '~/types/account-version-summary';
import type { AnnualReaction } from '~/types/annual-reaction';
import AnnualPosterDanmaku from '../AnnualPosterDanmaku.vue';
import AnnualShareGrid from '../AnnualShareGrid.vue';
const LegacyPosterShare = defineAsyncComponent(() => import('./LegacyPosterShare.vue'));
const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, locale } = useI18n();
const apiFetch = useViewerApiFetch();
const reactionSync = ref(true);
const imageSync = ref(true);
const reflection = ref('');
const reactions = ref<AnnualReaction[]>([]);
const loadingReactions = ref(false);
const sending = ref(false);
const reactionError = ref('');
const loadError = ref('');
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let pendingSend: { content: string; nonce: string; syncCommunity: boolean } | null = null;
let fetchSequence = 0;
const sentDuringFetch = new Map<string, AnnualReaction>();
const localized = (zh: string, ja: string) => locale.value.startsWith('ja') ? ja : zh;
const sendNotice = ref('');
const fetchReactions = async () => {
  if (!props.active || document.hidden || loadingReactions.value) return;
  const sequence = ++fetchSequence;
  sentDuringFetch.clear();
  loadingReactions.value = true;
  try {
    const result = await apiFetch<{ items: typeof reactions.value }>(`/api/account/annual-reactions?versionKey=annual_2026&limit=40`);
    if (sequence !== fetchSequence) return;
    loadError.value = '';
    const items = result.items || [];
    const ids = new Set(items.map((item) => item.id));
    reactions.value = [...items, ...Array.from(sentDuringFetch.values()).filter((item) => !ids.has(item.id))];
  } catch (error: any) {
    loadError.value = error?.data?.statusMessage || localized('暂时无法加载感想', '感想を読み込めませんでした');
  } finally { loadingReactions.value = false; }
};
const stopRefresh = () => { if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } };
const startRefresh = () => { stopRefresh(); if (!props.active || document.hidden) return; void fetchReactions(); refreshTimer = setInterval(() => { void fetchReactions(); }, 20000); };
const sendReaction = async () => {
  const content = reflection.value.trim();
  if (!content || sending.value) return;
  sending.value = true; reactionError.value = ''; sendNotice.value = '';
  if (!pendingSend || pendingSend.content !== content || pendingSend.syncCommunity !== reactionSync.value) pendingSend = { content, syncCommunity: reactionSync.value, nonce: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}` };
  const nonce = pendingSend.nonce;
  try {
    const result = await apiFetch<{ reaction: AnnualReaction; communitySync?: { requested?: boolean; status?: string; reason?: string; threadId?: number | null } }>(`/api/account/annual-summaries/${encodeURIComponent(props.summary.summaryId)}/reactions`, { method: 'POST', body: { content, syncCommunity: reactionSync.value, clientNonce: nonce } });
    if (result.reaction?.status === 'published' && loadingReactions.value) sentDuringFetch.set(result.reaction.id, result.reaction);
    if (result.reaction?.status === 'published' && !reactions.value.some((item) => item.id === result.reaction.id)) reactions.value = [...reactions.value, result.reaction];
    reflection.value = '';
    pendingSend = null;
    const syncStatus = result.communitySync?.status;
    sendNotice.value = syncStatus === 'synced'
      ? localized('感想已发送，已同步到社区', '感想を送信しました。コミュニティにも共有しました')
      : syncStatus === 'failed'
        ? localized('感想已发送，社区同步失败。', '感想を送信しました。コミュニティへの共有に失敗しました。')
        : result.communitySync?.reason === 'rate-limited'
          ? localized('感想已发送；社区同步过于频繁，本次仅显示弹幕。', '感想を送信しました。共有が集中しているため、今回は弾幕のみ表示します。')
          : localized('感想已发送，本次未同步到社区', '感想を送信しました。コミュニティには共有されていません');
  } catch (error: any) {
    reactionError.value = error?.data?.statusMessage || localized('发送失败，请稍后再试', '送信できませんでした。もう一度お試しください');
  } finally { sending.value = false; }
};
const visibilityChanged = () => { if (document.hidden) stopRefresh(); else startRefresh(); };
watch(() => props.active, (active) => { if (active) startRefresh(); else stopRefresh(); });
onMounted(() => { startRefresh(); document.addEventListener('visibilitychange', visibilityChanged); });
onBeforeUnmount(() => { stopRefresh(); fetchSequence++; document.removeEventListener('visibilitychange', visibilityChanged); });
const legacyDialog = ref<HTMLDialogElement | null>(null);
const legacyOpened = ref(false);
const openLegacy = async () => { legacyOpened.value = true; await nextTick(); legacyDialog.value?.showModal(); };
const savingImage = ref(false);
const imageError = ref('');
const imageNotice = ref('');
// The community checkbox next to the save button stays inert until Phase F; saving
// the share card must not create a public share or a Forum thread.
const saveShareCard = async () => {
  if (savingImage.value) return;
  savingImage.value = true; imageError.value = ''; imageNotice.value = '';
  try {
    const result = await apiFetch<{ shareCard?: { id: string; imageUrl: string; width: number; height: number } }>(
      `/api/account/annual-summaries/${encodeURIComponent(props.summary.summaryId)}/share-card`,
      { method: 'POST', body: { locale: locale.value.startsWith('ja') ? 'ja' : 'zh' } }
    );
    const imageUrl = result?.shareCard?.imageUrl;
    if (!imageUrl) throw new Error('share card image missing');
    const response = await fetch(imageUrl, { credentials: 'include' });
    if (!response.ok) throw new Error(`share card image ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `taiko-annual-${props.summary.summaryId}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    imageNotice.value = localized('分享图片已保存', '共有画像を保存しました');
  } catch (error: any) {
    imageError.value = error?.data?.statusMessage || localized('分享图片保存失败，请稍后再试', '共有画像を保存できませんでした。もう一度お試しください');
  } finally { savingImage.value = false; }
};
</script>

<template>
  <section class="poster-scene" :aria-label="t('annualSummary.staticPoster.report')">
    <div class="poster-scene__layout">
      <div class="poster-scene__danmaku" role="region" :aria-label="t('annualSummary.staticPoster.reflections')">
        <p v-if="!loadingReactions && !loadError && !reactions.length">{{ t('annualSummary.staticPoster.empty') }}</p>
        <AnnualPosterDanmaku :items="reactions" :active="active" />
      </div>
      <div class="poster-scene__compose">
        <label class="poster-scene__input"><span class="poster-scene__sr">{{ t('annualSummary.staticPoster.reflections') }}</span><textarea v-model="reflection" maxlength="60" :placeholder="t('annualSummary.staticPoster.placeholder')" /></label>
        <div class="poster-scene__send"><label class="poster-scene__sync"><input v-model="reactionSync" type="checkbox">{{ t('annualSummary.staticPoster.sync') }}</label><button type="button" :disabled="sending || !reflection.trim()" @click="sendReaction">{{ sending ? localized('发送中…', '送信中…') : t('annualSummary.staticPoster.send') }}</button></div>
        <p v-if="reactionError || imageError || loadError || sendNotice || imageNotice" class="poster-scene__error" role="status">{{ reactionError || imageError || loadError || sendNotice || imageNotice }}</p>
      </div>
      <AnnualShareGrid class="poster-scene__grid" :summary="summary" :locale="locale" />
      <div class="poster-scene__actions"><button type="button" :disabled="savingImage" @click="saveShareCard">{{ savingImage ? localized('生成中…', '生成中…') : t('annualSummary.staticPoster.save') }}</button><label class="poster-scene__sync"><input v-model="imageSync" type="checkbox">{{ t('annualSummary.staticPoster.sync') }}</label><button type="button" class="poster-scene__legacy" @click="openLegacy">{{ t('annualSummary.staticPoster.legacy') }}</button></div>
    </div>
    <dialog ref="legacyDialog" class="poster-scene__dialog"><button class="poster-scene__close" type="button" @click="legacyDialog?.close()">{{ t('annualSummary.staticPoster.close') }}</button><LegacyPosterShare v-if="legacyOpened" v-bind="props" /></dialog>
  </section>
</template>

<style scoped>
.poster-scene{height:100%;width:100%;container-type:size;background:url('/annual/poster/background_22.png') center/cover no-repeat;color:white;position:relative;overflow:hidden}
.poster-scene__layout{height:100%;box-sizing:border-box;padding:56px 0 max(8px,env(safe-area-inset-bottom));display:grid;grid-template-rows:minmax(64px,1fr) 76px auto 100px;gap:8px;justify-items:center}
.poster-scene__danmaku{width:87.68%;max-width:363px;position:relative;overflow:hidden}.poster-scene__danmaku p{margin:0;display:grid;place-items:center;height:100%;font-size:13px;color:#fff;text-shadow:0 1px 5px #00182f}.poster-scene__error{position:absolute;top:100%;left:0;width:100%;margin:0;color:#fff;font-size:10px;text-align:center;background:#082846e6;z-index:2;border-radius:4px}
.poster-scene__compose{position:relative;width:min(87.68%,363px);display:grid;grid-template-columns:minmax(0,1fr) 124px;gap:10px;min-height:0}.poster-scene__input textarea{resize:none;box-sizing:border-box;width:100%;height:100%;border:1px solid #182d45;border-radius:16px;background:#ffffffb8;color:#142b43;padding:10px 12px;font:600 15px/1.4 var(--viewer-font-family,sans-serif)}.poster-scene__input textarea::placeholder{color:#344e68;opacity:1}.poster-scene__send{display:flex;flex-direction:column;justify-content:space-between}
.poster-scene button{font-family:inherit}.poster-scene__send button,.poster-scene__actions>button:first-child{min-height:44px;padding:5px 18px;border:2px solid #e9f3fb;border-radius:99px;color:white;background:#222a30;font-size:17px;font-weight:800;box-shadow:0 2px 6px #0005}.poster-scene__send button{padding-inline:10px;font-size:16px;white-space:nowrap}.poster-scene__send .poster-scene__sync{white-space:normal;font-size:11px;line-height:1.15}.poster-scene button:disabled{cursor:not-allowed}.poster-scene__sync{display:flex;align-items:center;justify-content:center;gap:4px;min-height:28px;font-size:12px;font-weight:700;white-space:nowrap}.poster-scene__sync input{width:17px;height:17px;margin:0;accent-color:#2373af;cursor:pointer}.poster-scene__grid{width:min(87.68cqw,363px,calc((100cqh - 336px)*363/554));align-self:center}
.poster-scene__actions{display:flex;align-items:center;flex-direction:column;gap:0}.poster-scene__legacy{min-height:28px;padding:2px 12px;color:#fff;background:transparent;border:0;text-decoration:underline;font-size:12px;cursor:pointer}.poster-scene :focus-visible{outline:3px solid #ffe29a;outline-offset:2px}.poster-scene__sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.poster-scene__dialog{width:min(900px,94vw);height:85dvh;max-height:85dvh;padding:0;border:1px solid #ccd9e5;border-radius:18px;background:#f7fbff;overflow:auto}.poster-scene__dialog::backdrop{background:#00192bc4}.poster-scene__close{position:sticky;top:8px;left:12px;z-index:2;min-height:44px;padding:8px 16px;border:1px solid #3978c8;border-radius:99px;background:#fff;color:#17365d;cursor:pointer}
@media(max-height:810px){.poster-scene__layout{grid-template-rows:minmax(64px,1fr) 76px auto 100px;gap:6px}.poster-scene__grid{width:min(87.68cqw,363px,calc((100cqh - 322px)*363/554))}}
</style>
