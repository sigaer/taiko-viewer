<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { buildPageDescription } from "~/utils/seo";
import type { TargetRecommendationKey, TargetRecommendationsPayload } from "~/types/recommendation-intelligence";

const { t } = useI18n();
const localePath = useLocalePath();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();
definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "tools.recommend",
  pageDescKey: "page.tools.recommend.desc",
  navKey: "/tools/recommend",
  hidePageHeader: true,
  reworkElementPlus: true,
  breadcrumbs: [{ labelKey: "nav.myTaiko", to: "/my" }, { labelKey: "tools.recommend", to: "/tools/recommend" }]
});
useViewerSeo(() => ({ title: t("tools.recommend"), description: buildPageDescription(t("page.tools.recommend.desc")), path: "/tools/recommend" }));

const mode = ref<"ordinary" | "target">("ordinary");
const n = ref(20);
const dim = ref("");
const target = ref<TargetRecommendationKey>("goku");
const star = ref("");
const includeImage = ref(false);
const { data: ordinaryData, loading, failed, errorStatus, errorMessage, load, invalidate } = useRecommendationTool();
watch([n,dim],invalidate);
const bindingGeneration = useState("account-binding-generation",()=>0);
let targetGeneration=0;
let targetController:AbortController|null=null;
const clearTarget=()=>{targetGeneration++;targetController?.abort();targetController=null;targetData.value=null;targetLoading.value=false;targetError.value="";targetStatus.value=0;targetStatusMessage.value="";};
const targetData = ref<TargetRecommendationsPayload | null>(null);
const targetLoading = ref(false);
const targetError = ref("");
// Status and server message of a failed target read: "no bound ID" and "no data yet" have their own presentation.
const targetStatus = ref(0);
const targetStatusMessage = ref("");
// Values are what the endpoints accept; labels from the locale files.
const dimOptions = [
  { value: "综合", key: "overall" },
  { value: "大歌力", key: "big" },
  { value: "体力", key: "stamina" },
  { value: "高速处理", key: "speed" },
  { value: "精度力", key: "accuracy" },
  { value: "节奏处理", key: "rhythm" },
  { value: "复合处理", key: "complex" }
] as const;
const targetOptions: TargetRecommendationKey[] = ["goku", "ziya", "fenya", "jinya", "full_combo", "dondaful"];
const stars = Array.from({ length: 10 }, (_, i) => String(i + 1));
const targetLabel = computed(() => t(`rework.recommendTool.targets.${target.value}`));

watch(()=>[accountUser.value?.id,bindingGeneration.value],clearTarget,{flush:"sync"});
watch([target,star],clearTarget);
onBeforeUnmount(clearTarget);
const validCount = computed(() => Number.isInteger(n.value) && n.value >= 1 && n.value <= 50);
const submitOrdinary = async () => { if (!validCount.value) return; await load({ n: n.value, dim: dim.value, image: includeImage.value }); };
const submitTarget = async () => {
  clearTarget();const request=targetGeneration;targetController=new AbortController();
  targetLoading.value = true;
  targetError.value = "";
  targetData.value = null;
  try {
    const result = await $fetch<TargetRecommendationsPayload>("/api/account/recommendation/target", { signal:targetController.signal, query: { target: target.value, ...(star.value ? { star: star.value } : {}) } });
    if(request===targetGeneration)targetData.value=result;
  } catch (error) {
    if(request!==targetGeneration)return;
    const failure = error as { statusCode?: unknown; status?: unknown; data?: { statusMessage?: unknown } } | null;
    targetStatus.value = Number(failure?.statusCode ?? failure?.status) || 0;
    targetStatusMessage.value = String(failure?.data?.statusMessage || "");
    targetError.value = error instanceof Error ? error.message : t("home.personal.recommendationUnavailable");
  } finally { if(request===targetGeneration){targetLoading.value = false;targetController=null;} }
};
const formatGap = (item: TargetRecommendationsPayload["items"][number]) => {
  if (item.gapKind === "unplayed") return t("rework.recommendTool.unplayed");
  if (item.gapValue === null) return "—";
  if (item.gapKind === "score") return `${item.gapValue.toLocaleString()}`;
  return `${item.gapValue}`;
};
const dimLabel = computed(() => {
  const option = dimOptions.find((item) => item.value === dim.value);
  return option ? t(`rework.ratingDims.${option.key}`) : t("rework.recommendTool.overall");
});
const ordinarySummary = computed(() => `${dimLabel.value} · ${includeImage.value ? t("rework.recommendTool.image") : t("rework.recommendTool.listOnly")}`);
const songLink = (songId: number, level: number, query: Record<string, string> = {}) => localePath({ path: `/songs/${songId}`, query: { difficulty: String(level), ...query } });
</script>

<template>
  <div class="rw-stack">
    <ReworkPageHeader :title="t('tools.recommend')" />
    <ReworkGate :need="accountUser ? null : 'login'">
      <div class="rw-seg" role="group" :aria-label="t('rework.recommendTool.mode')">
        <button type="button" :aria-pressed="mode === 'ordinary'" @click="mode = 'ordinary'">{{ t("rework.recommendTool.ordinary") }}</button>
        <button type="button" :aria-pressed="mode === 'target'" @click="mode = 'target'">{{ t("rework.recommendTool.target") }}</button>
      </div>

      <section v-if="mode === 'ordinary'" class="rw-stack" :aria-label="t('rework.recommendTool.ordinary')">
        <form class="rw-form" @submit.prevent="submitOrdinary">
          <label class="rw-field">
            <span class="rw-field__label">{{ t("rework.recommendTool.count") }}</span>
            <input v-model.number="n" class="rw-input num" type="number" min="1" max="50" step="1" inputmode="numeric" required />
          </label>
          <label class="rw-field rw-field--half">
            <span class="rw-field__label">{{ t("rework.recommendTool.dim") }}</span>
            <select v-model="dim" class="rw-select">
              <option value="">{{ t("rework.recommendTool.overall") }}</option>
              <option v-for="option in dimOptions" :key="option.value" :value="option.value">{{ t(`rework.ratingDims.${option.key}`) }}</option>
            </select>
          </label>
          <label class="rw-check"><input v-model="includeImage" type="checkbox" />{{ t("rework.recommendTool.image") }}</label>
          <button type="submit" class="rw-btn rw-btn--primary" :disabled="loading || !validCount" :aria-busy="loading">{{ t("rework.recommendTool.submit") }}</button>
        </form>
        <ReworkScoresReadState v-if="failed" :status="errorStatus" :message="errorMessage" :failed-title="t('home.personal.recommendationUnavailable')" @retry="submitOrdinary" />
        <ReworkState v-else-if="loading" kind="loading" :lines="6" />
        <template v-else-if="ordinaryData">
          <ReworkState v-if="!ordinaryData.items.length" kind="empty" :title="t('rework.recommendTool.empty')" />
          <ReworkPanel v-else :title="t('rework.recommendTool.results')" data-testid="ordinary-list">
            <template #actions><span class="rw-count">{{ t("rework.recommendTool.resultCount", { n: ordinaryData.items.length }) }} · {{ ordinarySummary }}</span></template>
            <ReworkScoresRecommendRow
              v-for="item in ordinaryData.items"
              :key="`${item.songId}-${item.level}`"
              :song-id="item.songId"
              :title="item.title"
              :level="item.level"
              :star="item.starLevel"
              :to="songLink(item.songId, item.level, item.canCreateGoal ? { recommendation: item.recommendationToken } : {})"
              :fit="{ candidate: item.candidateIndicator, reference: item.referenceIndicator, deviation: item.deviationRatio, inRange: item.inStrictRange }"
            >
              <template v-if="item.isUnplayed" #tags><span class="tag">{{ t("rework.recommendTool.unplayed") }}</span></template>
              <template v-if="item.canCreateGoal" #actions><RecommendationGoalAction :token="item.recommendationToken" :song-id="item.songId" :difficulty-type="item.level" /></template>
            </ReworkScoresRecommendRow>
          </ReworkPanel>
          <ReworkPanel v-if="ordinaryData.image" :title="t('rework.recommendTool.imageAlt')">
            <img :src="ordinaryData.image" :alt="t('rework.recommendTool.imageAlt')" class="rw-result-image" />
          </ReworkPanel>
        </template>
      </section>

      <section v-else class="rw-stack" :aria-label="t('rework.recommendTool.target')">
        <form class="rw-form" @submit.prevent="submitTarget">
          <fieldset class="rw-field">
            <legend class="rw-field__label">{{ t("rework.recommendTool.targetType") }}</legend>
            <div class="rw-seg">
              <button v-for="option in targetOptions" :key="option" type="button" :aria-pressed="target === option" @click="target = option">{{ t(`rework.recommendTool.targets.${option}`) }}</button>
            </div>
          </fieldset>
          <label class="rw-field rw-field--half">
            <span class="rw-field__label">{{ t("rework.recommendTool.star") }}</span>
            <select v-model="star" class="rw-select">
              <option value="">{{ t("rework.recommendTool.allStars") }}</option>
              <option v-for="value in stars" :key="value" :value="value">{{ t("rework.recommendTool.starOption", { n: value }) }}</option>
            </select>
          </label>
          <button type="submit" class="rw-btn rw-btn--primary" :disabled="targetLoading" :aria-busy="targetLoading">{{ t("rework.recommendTool.runTarget") }}</button>
        </form>
        <ReworkScoresReadState v-if="targetError" :status="targetStatus" :message="targetStatusMessage" :failed-title="targetError" @retry="submitTarget" />
        <ReworkState v-else-if="targetLoading" kind="loading" :lines="6" />
        <template v-else-if="targetData">
          <p v-if="!targetData.isEnough" class="rw-note" role="status">{{ t("rework.recommendTool.insufficient") }}</p>
          <ReworkState v-if="!targetData.items.length" kind="empty" :title="t('rework.recommendTool.empty')" />
          <ReworkPanel v-else :title="t('rework.recommendTool.targetResults', { target: targetLabel })">
            <template #actions><span class="rw-count">{{ t("rework.recommendTool.resultCount", { n: targetData.items.length }) }}</span></template>
            <ReworkScoresRecommendRow
              v-for="item in targetData.items"
              :key="`${item.songId}-${item.level}`"
              :song-id="item.songId"
              :title="item.title"
              :level="item.level"
              :star="item.star"
              :to="songLink(item.songId, item.level)"
            >
              <ReworkScoresTargetProgress :item="item" :target-label="targetLabel" :gap="formatGap(item)" />
            </ReworkScoresRecommendRow>
          </ReworkPanel>
        </template>
      </section>
    </ReworkGate>
  </div>
</template>
