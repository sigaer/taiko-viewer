<script setup lang="ts">
const route = useRoute();

const navItems = [
  { to: "/admin/taiko/dashboard", label: "工作台", short: "台" },
  { to: "/admin/taiko/chart-ugc", label: "UGC 审核", short: "U" },
  { to: "/admin/taiko/songs", label: "歌曲数据", short: "曲" },
  { to: "/admin/taiko/guides", label: "谱面攻略", short: "谱" },
  { to: "/admin/taiko/aliases", label: "别名管理", short: "别" },
  { to: "/admin/taiko/custom-titles", label: "自定义称号", short: "称" },
  { to: "/admin/taiko/covers", label: "封面管理", short: "封" },
  { to: "/admin/taiko/draw-guess", label: "你画我猜", short: "猜" },
  { to: "/admin/taiko/audit", label: "审计日志", short: "审" }
];
</script>

<template>
  <nav class="admin-shell-nav">
    <NuxtLink
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="admin-shell-nav__item"
      :class="{ active: route.path.startsWith(item.to) }"
    >
      <span class="admin-shell-nav__badge">{{ item.short }}</span>
      <span>{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.admin-shell-nav {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 6px;
  width: 100%;
  align-self: start;
}

.admin-shell-nav__item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 42px;
  padding: 9px 12px;
  border-radius: 12px;
  color: rgba(247, 246, 240, 0.78);
  text-decoration: none;
  font-size: 14px;
  line-height: 1.35;
  transition: transform 0.18s ease, background-color 0.18s ease, color 0.18s ease;
}

.admin-shell-nav__item:hover {
  transform: translateX(4px);
  background: rgba(255, 255, 255, 0.08);
  color: #fffaf0;
}

.admin-shell-nav__item.active {
  background: linear-gradient(135deg, rgba(236, 200, 114, 0.94), rgba(215, 144, 63, 0.9));
  color: #2f2211;
  font-weight: 700;
}

.admin-shell-nav__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 11px;
  font-weight: 700;
  flex: 0 0 auto;
}

.admin-shell-nav__item.active .admin-shell-nav__badge {
  background: rgba(47, 34, 17, 0.12);
}
</style>
