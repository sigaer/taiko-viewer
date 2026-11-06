<script setup lang="ts">
import { computed } from "vue";
import { buildPageDescription } from "~/utils/seo";

const { t, locale } = useI18n();
const localePath = useLocalePath();

definePageMeta({
  pageTitleKey: "tools.title",
  pageDescKey: "page.tools.index.desc",
  navKey: "/tools",
  breadcrumbs: [{ labelKey: "tools.title", to: "/tools" }]
});

useViewerSeo(() => ({
  title: t("tools.title"),
  description: buildPageDescription(t("page.tools.index.desc")),
  path: "/tools",
  keywords: [t("tools.title"), t("tools.chartConfig"), t("tools.noteCount"), "taikob", "taikorec", "taikotrend"]
}));

const copy = computed(() =>
  locale.value === "ja"
    ? {
        intro:
          "公開ツールはログイン不要です。プレイデータを使うツールは ID 連携と同期が必要です。",
        tools: [
          { title: "TJA 定数計算", desc: "TJA ファイルから定数・能力指標を計算", to: "/tools/tja-constants", tag: "公開" },
          { title: "配置検索", desc: "BPM、難易度、譜面パターンから楽曲を検索", to: "/tools/chart-config", tag: "公開" },
          { title: "ノーツ数検索", desc: "指定ノーツ数に一致する譜面を探す", to: "/tools/note-count", tag: "公開" },
          { title: "楽曲進捗", desc: "段位、定数、星、全良難易度の進捗画像を表示", to: "/tools/progress", tag: "ログイン必須" },
          { title: "B30 表", desc: "Rating Top N の集計画像を生成（taikob）", to: "/tools/b30", tag: "ログイン必須" },
          { title: "おすすめ楽曲", desc: "プレイデータからおすすめ譜面を生成（taikorec）", to: "/tools/recommend", tag: "ログイン必須" },
          { title: "Rating 推移", desc: "各次元の Rating 履歴を表示（taikotrend）", to: "/tools/trend", tag: "ログイン必須" },
          { title: "太鼓ワードクラウド", desc: "プレイ履歴からワードクラウドを生成（taikocloud）", to: "/tools/word-cloud", tag: "ログイン必須" }
        ]
      }
    : {
        intro:
          "公开工具无需登录；使用游玩数据的工具需绑定鼓众 ID 并完成数据同步。",
        tools: [
          { title: "TJA 定数计算", desc: "上传谱面，查看各项定数与能力指标", to: "/tools/tja-constants", tag: "公开" },
          { title: "查配置", desc: "按 BPM、难度或谱面配置检索歌曲", to: "/tools/chart-config", tag: "公开" },
          { title: "查物量", desc: "按音符总数查找对应谱面", to: "/tools/note-count", tag: "公开" },
          { title: "歌曲进度", desc: "查看段位、定数、星级和全良难度进度图", to: "/tools/progress", tag: "需登录" },
          { title: "B30 表", desc: "生成 Rating Top N 汇总图（taikob）", to: "/tools/b30", tag: "需登录" },
          { title: "推荐歌曲", desc: "根据游玩数据生成推荐曲目（taikorec）", to: "/tools/recommend", tag: "需登录" },
          { title: "Rating 走势", desc: "查看各维度 Rating 历史曲线（taikotrend）", to: "/tools/trend", tag: "需登录" },
          { title: "太鼓词云", desc: "根据游玩记录生成词云（taikocloud）", to: "/tools/word-cloud", tag: "需登录" }
        ]
      }
);
</script>

<template>
  <div class="page-stack">
    <el-card class="panel-card">
      <p class="intro">{{ copy.intro }}</p>
      <div class="tool-grid">
        <NuxtLink v-for="tool in copy.tools" :key="tool.to" :to="localePath(tool.to)" class="tool-card">
          <div class="tool-card__head">
            <h3>{{ tool.title }}</h3>
            <el-tag size="small" effect="plain">{{ tool.tag }}</el-tag>
          </div>
          <p>{{ tool.desc }}</p>
        </NuxtLink>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}

.intro {
  margin: 0 0 16px;
  color:var(--viewer-text-muted);
  line-height: 1.6;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.tool-card {
  display: block;
  padding: 16px;
  border-radius: 16px;
  background:var(--viewer-surface-subtle);
  border: 1px solid var(--viewer-border, var(--viewer-border));
  text-decoration: none;
  color:inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.tool-card:hover {
  transform: translateY(-2px);
  box-shadow:0 12px 24px var(--viewer-shadow, var(--viewer-shadow));
}

.tool-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.tool-card h3 {
  margin: 0;
  font-size: 16px;
}

.tool-card p {
  margin: 0;
  font-size: 13px;
  color:var(--viewer-text-muted);
  line-height: 1.5;
}
</style>
