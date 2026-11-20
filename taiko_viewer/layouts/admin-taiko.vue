<script setup lang="ts">
import { formatAdminDateTime } from "~/utils/admin-time";

const route = useRoute();
const apiFetch = useAdminApiFetch();
const { adminUser, fetchCurrentAdmin, clearAdminUser } = useAdminState();

await fetchCurrentAdmin();

const breadcrumbMap: Record<string, string> = {
  "/admin/taiko/dashboard": "工作台",
  "/admin/taiko/chart-ugc": "UGC 审核",
  "/admin/taiko/songs": "歌曲数据",
  "/admin/taiko/guides": "谱面攻略",
  "/admin/taiko/aliases": "别名管理",
  "/admin/taiko/covers": "封面管理",
  "/admin/taiko/audit": "审计日志"
};

const logout = async () => {
  await apiFetch("/api/admin/auth/logout", { method: "POST" }).catch(() => undefined);
  clearAdminUser();
  await navigateTo("/admin/taiko/login");
};

useHead({
  titleTemplate: (titleChunk) => (titleChunk ? `${titleChunk} | Taiko Admin` : "Taiko Admin"),
  meta: [{ name: "robots", content: "noindex,nofollow" }]
});
</script>

<template>
  <div class="admin-layout">
    <aside class="admin-layout__sidebar">
      <div class="admin-layout__brand">
        <span class="admin-layout__brand-mark" aria-hidden="true">太</span>
        <div>
          <strong>Taiko Admin</strong>
          <p>管理后台</p>
        </div>
      </div>
      <AdminShellNav />
      <div
        class="admin-layout__operator"
        :title="adminUser?.expiresAt ? `登录有效期至 ${formatAdminDateTime(adminUser.expiresAt)}` : undefined"
      >
        <span class="admin-layout__avatar" aria-hidden="true">{{ (adminUser?.username || "?").slice(0, 1).toUpperCase() }}</span>
        <strong class="admin-layout__operator-name">{{ adminUser?.username || "未登录" }}</strong>
        <button type="button" class="admin-layout__logout" @click="logout">退出</button>
      </div>
    </aside>

    <main class="admin-layout__main">
      <header class="admin-layout__topbar">
        <h1>{{ breadcrumbMap[route.path] || "管理后台" }}</h1>
      </header>

      <div class="admin-layout__content">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  --admin-bg: #f4f6f6;
  --admin-surface: #ffffff;
  --admin-surface-subtle: #f7f9f9;
  --admin-border: #e3e8e8;
  --admin-ink: #1b2426;
  --admin-ink-secondary: #5d6b6e;
  --admin-ink-muted: #7a8789;
  --admin-primary: #006c76;
  --admin-primary-hover: #005a63;
  --admin-primary-soft: #d7ece9;
  --admin-amber: #c98a2e;
  --admin-amber-soft: #f6ead6;
  --admin-warning: #8a5a12;
  --admin-radius: 12px;
  --admin-sidebar-bg: #0f2426;
  --admin-sidebar-ink: rgba(234, 243, 242, 0.78);
  --admin-sidebar-ink-strong: #f2f8f7;
  --el-color-primary: var(--admin-primary);
  --el-color-primary-light-3: #4d98a0;
  --el-color-primary-light-5: #80b6bb;
  --el-color-primary-light-7: #b3d3d6;
  --el-color-primary-light-8: #cce2e4;
  --el-color-primary-light-9: #e6f0f1;
  --el-color-primary-dark-2: var(--admin-primary-hover);
  min-height: 100vh;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  background: var(--admin-bg);
  color: var(--admin-ink);
}

.admin-layout__sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  min-height: 0;
  padding: 22px 14px 16px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 20px;
  overflow-y: auto;
  background: var(--admin-sidebar-bg);
}

.admin-layout__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
  color: var(--admin-sidebar-ink-strong);
}

.admin-layout__brand strong {
  display: block;
  font-size: 16px;
  letter-spacing: 0.01em;
}

.admin-layout__brand p {
  margin: 2px 0 0;
  color: var(--admin-sidebar-ink);
  font-size: 12px;
}

.admin-layout__brand-mark {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--admin-primary);
  color: #ffffff;
  font-size: 18px;
  font-weight: 800;
  flex: 0 0 auto;
}

.admin-layout__operator {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px 8px 0;
  border-top: 1px solid rgba(234, 243, 242, 0.12);
  color: var(--admin-sidebar-ink-strong);
}

.admin-layout__avatar {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  background: rgba(215, 236, 233, 0.16);
  color: var(--admin-primary-soft);
  font-size: 12px;
  font-weight: 700;
}

.admin-layout__operator-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
}

.admin-layout__logout {
  flex: 0 0 auto;
  padding: 5px 10px;
  border: 1px solid rgba(234, 243, 242, 0.2);
  border-radius: 8px;
  background: transparent;
  color: var(--admin-sidebar-ink);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.admin-layout__logout:hover,
.admin-layout__logout:focus-visible {
  background: rgba(234, 243, 242, 0.1);
  color: var(--admin-sidebar-ink-strong);
}

.admin-layout__main {
  min-width: 0;
  padding: 24px 28px 40px;
}

.admin-layout__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.admin-layout__topbar h1 {
  margin: 0;
  color: var(--admin-ink);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
}

.admin-layout__content {
  display: grid;
  gap: 20px;
  min-width: 0;
}

@media (max-width: 1024px) {
  .admin-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-layout__sidebar {
    position: static;
    height: auto;
    padding: 14px 16px;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
    gap: 12px;
    overflow: visible;
  }

  .admin-layout__brand {
    padding: 0;
  }

  .admin-layout__sidebar :deep(.admin-shell-nav) {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .admin-layout__operator {
    grid-column: 2;
    grid-row: 1;
    padding: 0;
    border-top: 0;
  }

  .admin-layout__main {
    padding: 18px 16px 32px;
  }
}

@media (max-width: 600px) {
  .admin-layout__brand p {
    display: none;
  }

  .admin-layout__operator-name {
    max-width: 96px;
  }
}
</style>
