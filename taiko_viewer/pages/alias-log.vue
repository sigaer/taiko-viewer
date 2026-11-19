<script setup lang="ts">
import { computed } from "vue";
import { buildPageDescription } from "~/utils/seo";

interface AliasLogEntry {
  time: string;
  action: string;
  user_id: string;
  user_nickname?: string;
  group_id?: number;
  group_name?: string;
  song_id: string;
  song_title: string;
  alias: string;
}

interface AliasLogResponse {
  success: boolean;
  data: AliasLogEntry[];
  total: number;
  page?: number;
  pageSize?: number;
}

const { t } = useI18n();
const apiFetch = useViewerApiFetch();
const { formatDateTime } = useViewerDateTime();

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "nav.aliasLog",
  pageDescKey: "page.aliasLog.desc",
  navKey: "/alias-log",
  hidePageHeader: true,
  breadcrumbs: [{ labelKey: "nav.aliasLog", to: "/alias-log" }]
});

useViewerSeo(() => ({
  title: t("nav.aliasLog"),
  description: buildPageDescription(t("page.aliasLog.desc")),
  path: "/alias-log",
  keywords: [t("nav.aliasLog"), t("rework.aliasLogPage.keyword")]
}));

// Copy in locales/{zh,ja}.json rework.aliasLogPage (moved word for word in slice F; same keys as before).
const ALIAS_COPY_KEYS = ["subtitle", "loadFailed", "reload", "empty", "time", "song", "alias", "user", "source", "action", "view", "privateChat", "searchPlaceholder", "search"] as const;
// The {total} placeholder is passed through as text, so the existing `.replace("{total}", …)` still fills it.
const copy = computed(() => Object.fromEntries(ALIAS_COPY_KEYS.map((key) => [key, t(`rework.aliasLogPage.${key}`, { total: "{total}" })])) as Record<(typeof ALIAS_COPY_KEYS)[number], string>);

const page = ref(1);
const pageSize = 20;
const keyword = ref("");
const submittedKeyword = ref("");
const { data: response, pending, error, refresh } = await useAsyncData<AliasLogResponse>(
  () => `alias-log-${page.value}-${submittedKeyword.value}`,
  () => apiFetch("/api/alias-log", {
    query: { page: page.value, pageSize, keyword: submittedKeyword.value || undefined }
  }),
  { watch: [page, submittedKeyword] }
);

const logs = computed(() => response.value?.data || []);
const total = computed(() => response.value?.total || 0);
const submitSearch = () => {
  page.value = 1;
  submittedKeyword.value = keyword.value.trim();
};

const formatTime = (timeStr: string): string => formatDateTime(timeStr);
const pageCountOf = computed(() => Math.ceil(total.value / pageSize));

// 获取用户显示名称
const getUserDisplay = (log: AliasLogEntry): string => {
  if (log.user_nickname) {
    return `${log.user_nickname} (${log.user_id})`;
  }
  return log.user_id;
};

// 获取群组显示
const getGroupDisplay = (log: AliasLogEntry): string => {
  if (!log.group_id) return copy.value.privateChat;
  if (log.group_name) {
    return `${log.group_name} (${log.group_id})`;
  }
  return String(log.group_id);
};

</script>

<template>
  <div class="rw-stack">
    <ReworkPageHeader :title="t('nav.aliasLog')">
      <p class="rw-lead" role="status">{{ copy.subtitle.replace("{total}", String(total)) }}</p>
    </ReworkPageHeader>
    <form class="rw-form" role="search" @submit.prevent="submitSearch">
      <label class="rw-field rw-field--grow">
        <span class="rw-vh">{{ copy.searchPlaceholder }}</span>
        <input v-model="keyword" class="rw-input rw-input--block" type="search" :placeholder="copy.searchPlaceholder" enterkeyhint="search" @search="!keyword && submitSearch()" />
      </label>
      <button type="submit" class="rw-btn rw-btn--primary">{{ copy.search }}</button>
    </form>
    <ReworkState v-if="pending" kind="loading" :lines="6" />
    <ReworkState v-else-if="error" kind="failed" :title="copy.loadFailed" :retry-label="copy.reload" @retry="() => refresh()" />
    <ReworkState v-else-if="logs.length === 0" kind="empty" :title="copy.empty" />
    <template v-else>
      <ReworkInfoAliasTable :rows="logs" :copy="copy" :format-time="formatTime" :user-of="getUserDisplay" :group-of="getGroupDisplay" />
      <ReworkPager v-if="total > pageSize" :page="page" :count="pageCountOf" @select="(n) => (page = n)" />
    </template>
  </div>
</template>
