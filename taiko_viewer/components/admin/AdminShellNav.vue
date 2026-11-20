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
  ,{ to: "/admin/taiko/annual-beta", label: "封闭测试", short: "β" }
  ,{ to: "/admin/taiko/annual-summaries", label: "年度报告", short: "年" }
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
  gap: 2px;
  width: 100%;
  align-self: start;
}

.admin-shell-nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 38px;
  padding: 7px 10px;
  border-radius: 8px;
  color: var(--admin-sidebar-ink, rgba(234, 243, 242, 0.78));
  text-decoration: none;
  font-size: 14px;
  line-height: 1.35;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.admin-shell-nav__item:hover {
  background: rgba(234, 243, 242, 0.07);
  color: var(--admin-sidebar-ink-strong, #f2f8f7);
}

.admin-shell-nav__item:focus-visible {
  outline: 2px solid var(--admin-primary-soft, #d7ece9);
  outline-offset: -2px;
}

.admin-shell-nav__item.active {
  background: var(--admin-primary-soft, #d7ece9);
  color: var(--admin-primary, #006c76);
  font-weight: 700;
}

.admin-shell-nav__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: rgba(234, 243, 242, 0.08);
  font-size: 11px;
  font-weight: 700;
  flex: 0 0 auto;
}

.admin-shell-nav__item.active .admin-shell-nav__badge {
  background: var(--admin-primary, #006c76);
  color: #ffffff;
}

@media (max-width: 1024px) {
  .admin-shell-nav {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 4px;
  }

  .admin-shell-nav__item {
    width: auto;
    min-height: 32px;
    padding: 5px 10px;
    gap: 6px;
    font-size: 13px;
  }

  .admin-shell-nav__badge {
    display: none;
  }
}
</style>
