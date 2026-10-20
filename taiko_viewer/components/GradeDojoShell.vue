<script setup lang="ts">
import { computed, reactive, watch } from "vue";

type GradeSectionBlock = {
  type: string;
  html: string;
};

type GradeSectionTab = {
  title: string;
  html: string;
};

type GradeSection = {
  title: string;
  blocks: GradeSectionBlock[];
  tabs?: GradeSectionTab[];
};

type GradePage = {
  slug: string;
  title: string;
  displayTitle: string;
  sourceUrl: string;
  lastModified: string;
  navigationHtml: string;
  sections: GradeSection[];
};

type GradeGroup = {
  label: string;
  items: string[];
};

const props = defineProps<{
  yearTitle: string;
  pages: GradePage[];
  selectedSlug: string;
  gradeGroups: GradeGroup[];
  basePath: string;
}>();

const tabState = reactive<Record<string, number>>({});

const currentPage = computed(() => {
  return props.pages.find((page) => page.slug === props.selectedSlug) ?? props.pages[0];
});

const iconMap: Record<string, string> = {
  详细: "M5 7h14M5 12h14M5 17h10",
  攻略:
    "M4.5 5.5h7.5a2 2 0 0 1 2 2v11H6.5a2 2 0 0 0-2 2v-15z M19.5 5.5h-7.5a2 2 0 0 0-2 2v11h7.5a2 2 0 0 1 2 2v-15z",
  "対策・合格の目安": "M5 12l4 4L19 6",
  "各課題曲の練習曲": "M4 7h16M7 4v16M17 4v16",
  その他: "M12 8v4m0 4h.01M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"
};

watch(
  () => currentPage.value?.slug,
  (slug) => {
    if (!slug) return;
    Object.keys(tabState).forEach((key) => delete tabState[key]);
    currentPage.value.sections.forEach((section) => {
      if (section.tabs?.length) {
        tabState[`${slug}:${section.title}`] = 0;
      }
    });
  },
  { immediate: true }
);

const selectGrade = async (slug: string) => {
  await navigateTo(`${props.basePath}/${slug}`);
};

const getSectionIcon = (title: string) => {
  return iconMap[title] ?? iconMap["详细"];
};

const getSectionTabKey = (sectionTitle: string) => {
  return `${currentPage.value.slug}:${sectionTitle}`;
};
</script>

<template>
  <div id="body" class="grade-body">
    <div id="title" class="grade-title">
      <div class="title-row">
        <h1 class="title">
          <span class="title-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M7 4h10v3a5 5 0 0 1-10 0V4z M5 6H3v1a4 4 0 0 0 4 4 M19 6h2v1a4 4 0 0 1-4 4 M9 18h6"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <span>{{ yearTitle }}</span>
          <small>{{ currentPage.displayTitle }}</small>
        </h1>
        <a class="source-link" :href="currentPage.sourceUrl" target="_blank" rel="noopener noreferrer">原始页面</a>
      </div>
      <div id="lastmodified" class="lastmodified">{{ currentPage.lastModified }}</div>
    </div>

    <div class="grade-directory">
      <div v-for="group in gradeGroups" :key="group.label" class="directory-group">
        <strong>{{ group.label }}</strong>
        <div class="directory-chips">
          <button
            v-for="slug in group.items"
            :key="slug"
            type="button"
            class="grade-chip"
            :class="{ active: slug === currentPage.slug }"
            @click="selectGrade(slug)"
          >
            {{ slug }}
          </button>
        </div>
      </div>
    </div>

    <div id="content" class="grade-content">
      <div class="nav-wrap" v-html="currentPage.navigationHtml"></div>

      <section v-for="section in currentPage.sections" :key="section.title" class="dojo-section">
        <h3 class="heading-with-anchor-link">
          <span class="heading-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                :d="getSectionIcon(section.title)"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          {{ section.title }}
        </h3>

        <template v-if="section.tabs?.length">
          <div class="tab-container">
            <div class="tabs">
              <ul>
                <li
                  v-for="(tab, index) in section.tabs"
                  :key="tab.title"
                  class="tab"
                  :class="{ active: tabState[getSectionTabKey(section.title)] === index }"
                >
                  <button type="button" @click="tabState[getSectionTabKey(section.title)] = index">
                    {{ tab.title }}
                  </button>
                </li>
              </ul>
            </div>
            <div class="tab-contents">
              <div
                class="rich-html"
                v-html="section.tabs[tabState[getSectionTabKey(section.title)] ?? 0]?.html"
              ></div>
            </div>
          </div>
        </template>

        <template v-if="section.blocks.length">
          <div class="section-stack">
            <div
              v-for="(block, index) in section.blocks"
              :key="`${section.title}-${index}`"
              class="rich-html"
              v-html="block.html"
            ></div>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.grade-body {
  max-width: 980px;
  margin: 0 auto;
  padding: 24px 28px 40px;
  background:var(--viewer-surface-subtle);
  border-radius: 18px;
  box-shadow:0 18px 32px var(--viewer-shadow);
}

.grade-title {
  border-bottom: 1px solid var(--viewer-border);
  padding-bottom: 12px;
  margin-bottom: 20px;
}

.title-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
  color:var(--viewer-text);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.title small {
  font-size: 15px;
  font-weight: 700;
  color:#8d5e3c;
}

.title-icon {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background:var(--viewer-surface-subtle);
  color:var(--viewer-link);
}

.title-icon svg {
  width: 14px;
  height: 14px;
}

.source-link {
  text-decoration: none;
  font-size: 12px;
  font-weight: 700;
  color:#8d5e3c;
  padding: 8px 12px;
  border-radius: 999px;
  background:rgba(196, 127, 79, 0.12);
  white-space: nowrap;
}

.lastmodified {
  font-size: 12px;
  color:var(--viewer-text-muted);
}

.grade-directory {
  display: grid;
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px 18px;
  border-radius: 16px;
  background:var(--viewer-surface-subtle);
  border: 1px solid rgba(165, 138, 110, 0.18);
}

.directory-group {
  display: grid;
  gap: 8px;
}

.directory-group strong {
  font-size: 13px;
  color:#6c4a30;
}

.directory-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.grade-chip {
  border: 1px solid rgba(154, 109, 71, 0.22);
  background:var(--viewer-surface-subtle);
  color:#5f4430;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.grade-chip.active {
  background:linear-gradient(135deg, #c48455, var(--viewer-link));
  color:#fff;
  border-color:transparent;
  box-shadow:0 10px 18px rgba(154, 109, 71, 0.22);
}

.grade-content {
  min-height: 200px;
}

.nav-wrap {
  margin-bottom: 18px;
}

.dojo-section {
  margin-bottom: 24px;
}

.heading-with-anchor-link {
  margin: 16px 0 10px;
  font-size: 16px;
  color:var(--viewer-text);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.heading-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background:rgba(196, 127, 79, 0.15);
  color:var(--viewer-link);
}

.heading-icon svg {
  width: 12px;
  height: 12px;
}

.tab-container {
  border: 1px solid rgba(165, 138, 110, 0.25);
  border-radius: 12px;
  padding: 12px;
  background:var(--viewer-surface-subtle);
  margin-bottom: 16px;
}

.tabs ul {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0;
  margin: 0 0 12px;
}

.tab button {
  border: 1px solid rgba(154, 109, 71, 0.18);
  background:#f6efe6;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  color:#5a4a3b;
  cursor: pointer;
}

.tab.active button {
  background:#eddcc9;
  border-color:#c48455;
  color:#6b4527;
}

.section-stack {
  display: grid;
  gap: 12px;
}

.rich-html {
  color:var(--viewer-text);
  font-size: 13px;
}

.grade-content :deep(.h-scrollable) {
  overflow-x: auto;
  margin-bottom: 12px;
}

.grade-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.grade-content :deep(td),
.grade-content :deep(th) {
  padding: 6px 8px;
  border: 1px solid var(--viewer-border);
  vertical-align: top;
}

.grade-content :deep(ul) {
  margin: 0;
}

.grade-content :deep(.list1),
.grade-content :deep(.list2),
.grade-content :deep(.list3) {
  color:var(--viewer-text);
}

.grade-content :deep(.list1) {
  margin: 0 0 12px;
  padding-left: 18px;
}

.grade-content :deep(.list2) {
  margin-top: 8px;
  padding-left: 18px;
}

.grade-content :deep(.list3) {
  margin-top: 6px;
  padding-left: 18px;
}

.grade-content :deep(li) {
  line-height: 1.72;
}

.grade-content :deep(a) {
  color:#8d5e3c;
  text-decoration: none;
}

.grade-content :deep(a:hover) {
  text-decoration: underline;
}

@media (max-width: 720px) {
  .grade-body {
    padding: 18px 16px 28px;
  }

  .title-row {
    flex-direction: column;
  }

  .source-link {
    align-self: flex-start;
  }
}
</style>
