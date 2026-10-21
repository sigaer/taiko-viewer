<script setup lang="ts">
import { computed } from "vue";
import { buildPageDescription } from "~/utils/seo";

const { t, locale } = useI18n();

definePageMeta({
  contentLayout: "reading",
  pageTitleKey: "nav.about",
  pageDescKey: "page.about.desc",
  navKey: "/about",
  breadcrumbs: [{ labelKey: "nav.about", to: "/about" }]
});

useViewerSeo(() => ({
  title: t("nav.about"),
  description: buildPageDescription(t("page.about.desc")),
  path: "/about",
  keywords: [t("nav.about"), locale.value === "ja" ? "開発チーム" : "开发团队"]
}));

const copy = computed(() =>
  locale.value === "ja"
    ? {
        teamTitle: "開発チーム",
        teamDesc: "Taiko プロジェクトに参加したすべてのメンバーに感謝します。",
        stackTitle: "技術スタック",
        stackDesc: "フロントエンドとバックエンドの主要技術です。"
      }
    : {
        teamTitle: "开发团队",
        teamDesc: "感谢所有参与 Taiko 项目的成员。",
        stackTitle: "技术栈",
        stackDesc: "前端与后端主要技术。"
      }
);

const team = computed(() =>
  locale.value === "ja"
    ? [
        { name: "马路", role: "プロダクト・企画" },
        { name: "sigaer", role: "フロントエンド / UI デザイン" },
        { name: "Sparklizm/星川sutari", role: "翻訳" },
        { name: "Hyperionml/百里莫凌", role: "バックエンド" }
      ]
    : [
        { name: "马路", role: "产品与策划" },
        { name: "sigaer", role: "前端开发/UI设计" },
        { name: "Sparklizm/星川sutari", role: "翻译" },
        { name: "Hyperionml/百里莫凌", role: "后端" }
      ]
);

const stacks = [
  "Nuxt 3",
  "Vue 3",
  "TypeScript",
  "Element Plus",
  "Spring Boot 3",
  "Java 21",
  "MyBatis",
  "MySQL",
  "PageHelper",
  "Springdoc OpenAPI",
  "JWT (jjwt)",
  "Fastjson2",
  "Maven"
];
</script>

<template>
  <div class="page-stack">
    <el-card class="panel-card">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">
            <span class="section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M6.5 8a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M17.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20a5.5 5.5 0 0 1 11 0 M13 20a4.5 4.5 0 0 1 9 0"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            {{ copy.teamTitle }}
          </h3>
          <p>{{ copy.teamDesc }}</p>
        </div>
      </div>
      <div class="team-grid">
        <div v-for="member in team" :key="member.name" class="team-card">
          <div class="avatar">
            <svg class="avatar-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M5 20a7 7 0 0 1 14 0"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <div>
            <div class="team-name">{{ member.name }}</div>
            <div class="team-role">{{ member.role }}</div>
          </div>
        </div>
      </div>
    </el-card>

    <el-card class="panel-card">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">
            <span class="section-icon alt" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 7h6v6H5z M13 7h6v6h-6z M5 15h6v6H5z M13 15h6v6h-6z"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            {{ copy.stackTitle }}
          </h3>
          <p>{{ copy.stackDesc }}</p>
        </div>
      </div>
      <div class="stack-tags">
        <el-tag v-for="stack in stacks" :key="stack" effect="plain" size="large">{{ stack }}</el-tag>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}

.panel-header h3 {
  margin: 0 0 6px;
  font-size: 18px;
}

.panel-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.section-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color:var(--viewer-link);
  background:var(--viewer-surface-subtle);
  border-radius: 6px;
}

.section-icon svg {
  width: 14px;
  height: 14px;
}

.section-icon.alt {
  background:var(--viewer-surface-subtle);
  color:var(--viewer-link);
}

.panel-header p {
  margin: 0;
  color:var(--viewer-text-muted);
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.team-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 16px;
  background:var(--viewer-surface-subtle);
  box-shadow:0 8px 18px var(--viewer-shadow);
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background:linear-gradient(135deg, var(--viewer-primary), var(--viewer-primary-hover));
  color:var(--viewer-on-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.avatar-icon {
  width: 22px;
  height: 22px;
}

.team-name {
  font-size: 15px;
  font-weight: 600;
}

.team-role {
  font-size: 12px;
  color:var(--viewer-text-muted);
}

.stack-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
