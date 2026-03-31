<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { formatViewerTitle } from "~/composables/useViewerSeo";

const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

const pageMeta = {
  title: "设置",
  desc: "主题切换与缓存管理。"
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/settings",
  breadcrumbs: [{ label: "设置", to: "/settings" }]
});

useSeoMeta({
  title: formatViewerTitle(pageMeta.title),
  description: pageMeta.desc,
  ogTitle: formatViewerTitle(pageMeta.title),
  ogDescription: pageMeta.desc
});

const isDeveloperReviewer = computed(
  () => accountUser.value?.username === "sigaer" && accountUser.value?.email === "1106865024@qq.com"
);

const theme = ref("light");

const applyTheme = (value: string) => {
  if (!process.client) return;
  document.body.classList.toggle("theme-dark", value === "dark");
};

if (process.client) {
  theme.value = localStorage.getItem("taiko_theme") || "light";

  watch(theme, (value) => {
    localStorage.setItem("taiko_theme", value);
    applyTheme(value);
  });

  onMounted(() => {
    applyTheme(theme.value);
  });
}

const cacheItems = computed(() => (process.client ? Object.keys(localStorage) : []));
const cacheSize = computed(() => {
  if (!process.client) return 0;
  let total = 0;
  cacheItems.value.forEach((key) => {
    const value = localStorage.getItem(key) || "";
    total += key.length + value.length;
  });
  return Math.round((total / 1024) * 10) / 10;
});

const clearCache = () => {
  if (!process.client) return;
  localStorage.clear();
};
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
                  d="M4 6h6v6H4z M14 6h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            站内快捷入口
          </h3>
          <p>这里可以直接进入社区、多端同步和开发者相关功能。</p>
        </div>
      </div>
      <div class="tool-links">
        <NuxtLink to="/forum" class="tool-link">
          <strong>论坛社区</strong>
          <span>查看版块、通知和帖子动态</span>
        </NuxtLink>
        <NuxtLink to="/account/sync" class="tool-link">
          <strong>多端同步</strong>
          <span>同步当前绑定 ID 的完整成绩 JSON</span>
        </NuxtLink>
        <NuxtLink to="/account/developer" class="tool-link">
          <strong>开发者权限</strong>
          <span>提交申请、查看审批状态和 Token</span>
        </NuxtLink>
        <NuxtLink v-if="isDeveloperReviewer" to="/account/developer/review" class="tool-link">
          <strong>开发者审批</strong>
          <span>处理待审批申请并签发开发者 Token</span>
        </NuxtLink>
      </div>
    </el-card>

    <el-card class="panel-card">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">
            <span class="section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M4 12h2.2l.4-1.4-1.6-1.2 2-3.2 1.8.7 1.1-1.1-.7-1.8 3.2-1.2 1 1.6h1.6l1-1.6 3.2 1.2-.7 1.8 1.1 1.1 1.8-.7 2 3.2-1.6 1.2.4 1.4H20"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            主题设置
          </h3>
          <p>切换浅色/深色主题。</p>
        </div>
      </div>
      <div class="setting-row">
        <span>主题模式</span>
        <el-switch
          v-model="theme"
          active-value="dark"
          inactive-value="light"
          active-text="深色"
          inactive-text="浅色"
        />
      </div>
    </el-card>

    <el-card class="panel-card">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">
            <span class="section-icon alt" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7h16M7 12h10M9 17h6"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
            </span>
            缓存文件
          </h3>
          <p>查看本地缓存信息。</p>
        </div>
        <el-button type="danger" plain @click="clearCache">
          <span class="btn-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          清空缓存
        </el-button>
      </div>
      <div class="cache-info">
        <div class="cache-card">
          <div class="cache-label">
            <span class="mini-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </span>
            缓存条目
          </div>
          <div class="cache-value">{{ cacheItems.length }}</div>
        </div>
        <div class="cache-card">
          <div class="cache-label">
            <span class="mini-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 18h12M8 14h8M10 10h4"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            </span>
            估算大小
          </div>
          <div class="cache-value">{{ cacheSize }} KB</div>
        </div>
      </div>
      <el-table :data="cacheItems.map((key) => ({ key }))" border height="240" empty-text="暂无缓存">
        <el-table-column prop="key" label="缓存键" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}

.panel-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
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
  color: #9a6d47;
  background: rgba(196, 127, 79, 0.2);
  border-radius: 6px;
}

.section-icon svg {
  width: 14px;
  height: 14px;
}

.section-icon.alt {
  background: rgba(88, 136, 197, 0.2);
  color: #3c6aa6;
}

.panel-header p {
  margin: 0;
  color: #6c5a4b;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  font-size: 14px;
}

.cache-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.tool-links {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.tool-link {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 16px;
  text-decoration: none;
  color: #3d2f25;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 8px 18px rgba(165, 138, 110, 0.12);
}

.tool-link strong {
  font-size: 15px;
}

.tool-link span {
  color: #6c5a4b;
  line-height: 1.7;
}

.cache-card {
  border-radius: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 8px 18px rgba(165, 138, 110, 0.12);
}

.cache-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #7a6552;
}

.mini-icon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #9a6d47;
}

.mini-icon svg {
  width: 12px;
  height: 12px;
}

.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
}

.btn-icon svg {
  width: 14px;
  height: 14px;
}

.cache-value {
  font-size: 20px;
  font-weight: 600;
  margin-top: 4px;
}
</style>
