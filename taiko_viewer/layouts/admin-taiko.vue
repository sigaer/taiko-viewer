<script setup lang="ts">
import { formatAdminDateTime } from "~/utils/admin-time";

const route = useRoute();
const apiFetch = useAdminApiFetch();
const { adminUser, fetchCurrentAdmin, clearAdminUser } = useAdminState();

await fetchCurrentAdmin();

const breadcrumbMap: Record<string, string> = {
  "/admin/taiko/dashboard": "工作台",
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
        <span class="admin-layout__brand-mark">太</span>
        <div>
          <strong>Taiko Admin</strong>
          <p>KOI-inspired console</p>
        </div>
      </div>
      <AdminShellNav />
      <div class="admin-layout__operator">
        <span class="admin-layout__operator-label">当前管理员</span>
        <strong>{{ adminUser?.username || "未登录" }}</strong>
        <span v-if="adminUser?.expiresAt" class="admin-layout__operator-expire">
          令牌到期：{{ formatAdminDateTime(adminUser.expiresAt) }}
        </span>
        <el-button plain class="admin-layout__logout" @click="logout">退出登录</el-button>
      </div>
    </aside>

    <main class="admin-layout__main">
      <header class="admin-layout__topbar">
        <div>
          <span class="admin-layout__eyebrow">Taiko 后台管理</span>
          <h1>{{ breadcrumbMap[route.path] || "管理后台" }}</h1>
        </div>
        <div class="admin-layout__chip">
          <span>仅授权人员可访问</span>
        </div>
      </header>

      <div class="admin-layout__content">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  background:
    radial-gradient(circle at top left, rgba(244, 217, 154, 0.42), transparent 22%),
    linear-gradient(180deg, #efe8dd 0%, #f8f4ee 58%, #f0e6d8 100%);
}

.admin-layout__sidebar {
  position: sticky;
  top: 0;
  min-height: 100vh;
  padding: 28px 22px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 24px;
  background:
    radial-gradient(circle at top right, rgba(255, 240, 200, 0.16), transparent 28%),
    linear-gradient(180deg, #0e1728 0%, #182338 100%);
}

.admin-layout__brand {
  display: flex;
  align-items: center;
  gap: 14px;
  color: #fff8ec;
}

.admin-layout__brand strong {
  display: block;
  font-size: 18px;
}

.admin-layout__brand p {
  margin: 4px 0 0;
  color: rgba(255, 248, 236, 0.7);
  font-size: 12px;
}

.admin-layout__brand-mark {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f7cf7b, #d99342);
  color: #2f2211;
  font-size: 24px;
  font-weight: 800;
}

.admin-layout__operator {
  padding: 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.06);
  color: #f9f5eb;
  display: grid;
  gap: 8px;
}

.admin-layout__operator-label,
.admin-layout__operator-expire {
  color: rgba(249, 245, 235, 0.7);
  font-size: 12px;
}

.admin-layout__logout {
  margin-top: 8px;
  border-color: rgba(255, 255, 255, 0.18);
  color: #fef5e5;
  background: transparent;
}

.admin-layout__main {
  min-width: 0;
  padding: 28px;
}

.admin-layout__topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}

.admin-layout__eyebrow {
  display: inline-block;
  margin-bottom: 8px;
  color: #8f6d3f;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.admin-layout__topbar h1 {
  margin: 0;
  color: #1f2937;
  font-size: clamp(28px, 4vw, 38px);
}

.admin-layout__chip {
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 250, 241, 0.88);
  color: #6d5a42;
  box-shadow: 0 10px 26px rgba(130, 113, 87, 0.1);
}

.admin-layout__content {
  display: grid;
  gap: 20px;
}

@media (max-width: 1024px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }

  .admin-layout__sidebar {
    position: static;
    min-height: auto;
  }
}
</style>
