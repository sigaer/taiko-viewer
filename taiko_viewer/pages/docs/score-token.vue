<script setup lang="ts">
import { computed } from "vue";
import { buildPageDescription } from "~/utils/seo";

const { t, locale } = useI18n();
const localePath = useLocalePath();

definePageMeta({
  contentLayout: "reading",
  hidePageHeader: true,
  reworkElementPlus: true,
  pageTitleKey: "page.scoreTokenGuide.title",
  hidePageDescription: true,
  navKey: "/account/sync",
  breadcrumbs: [
    { labelKey: "account.sync", to: "/account/sync" },
    { labelKey: "page.scoreTokenGuide.title", to: "/docs/score-token" }
  ]
});

useViewerSeo(() => ({
  title: t("rework.account.scoreTokenDocs.title"),
  description: buildPageDescription(t("rework.account.scoreTokenDocs.seoDescription")),
  path: "/docs/score-token",
  keywords: ["scoretoken", "网页成绩 token", "太鼓成绩 API"]
}));

// Slice E2: the inline zh / ja table moved to locales (rework.account.scoreTokenDocs.*), same texts.
const docs = (key: string) => t(`rework.account.scoreTokenDocs.${key}`);
const copy = computed(() => (void locale.value, {
  title: docs("title"), lead: docs("lead"), userTitle: docs("userTitle"),
  steps: [docs("step1"), docs("step2"), docs("step3"), docs("step4")],
  safetyTitle: docs("safetyTitle"), safety: docs("safety"), devTitle: docs("devTitle"), requestTitle: docs("requestTitle"),
  responseTitle: docs("responseTitle"), responseNote: docs("responseNote"), errorsTitle: docs("errorsTitle"), notesTitle: docs("notesTitle"),
  notes: [docs("note1"), docs("note2"), docs("note3")],
  back: docs("back"),
  errors: (["400", "401", "404", "502"] as const).map((code) => ({ code, text: docs(`error${code}`) }))
}));

const requestExample = computed(() => `curl -X POST "https://sakura-bot.cn/api/public-score/by-token" \\
  -H "Content-Type: application/json" \\
  -d '{"token":"${docs("tokenPlaceholder")}"}'`);

const responseExample = `{
  "ok": true,
  "taikoId": "2258735",
  "fetchedAt": "2026-08-05T12:30:20Z",
  "data": {
    "profile": {
      "mydon_name": "SakuraDon",
      "userid": "2258735",
      "is_disp_dan_on": true,
      "province": "北京市",
      "gameCostume": {
        "title": "太鼓达人",
        "got_dan_max": 6,
        "dan_name": { "grade": "06", "level": 1 }
      }
    },
    "songs": [
      {
        "song_no": 187,
        "level": 4,
        "high_score": 1000000,
        "best_score_rank": 7,
        "good_cnt": 160,
        "ok_cnt": 0,
        "ng_cnt": 0,
        "combo_cnt": 160,
        "clear_cnt": 1,
        "full_combo_cnt": 1,
        "dondaful_combo_cnt": 1,
        "highscore_datetime": "2026-08-05 20:30:20"
      }
    ],
    "achievement": {
      "count_level": 5,
      "ary_crown_count": [250, 3, 0],
      "ary_score_rank_count": [19, 56, 136, 142, 29, 1, 0]
    }
  }
}`;
</script>

<template>
  <article class="token-docs rw-stack">
    <ReworkPageHeader :title="copy.title">
      <p class="rw-lead">{{ copy.lead }}</p>
      <NuxtLink class="rw-link back-link" :to="localePath('/account/sync')">{{ copy.back }}</NuxtLink>
    </ReworkPageHeader>
    <ReworkScoreTokenDocs :copy="copy" :request-example="requestExample" :response-example="responseExample" />
  </article>
</template>
