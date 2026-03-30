<script setup lang="ts">
import { computed } from "vue";
import { GUIDE_DIFFICULTY_OPTIONS } from "~/utils/guide";

const route = useRoute();
const { accountUser, fetchCurrentUser, clearAccountUser } = useAccountState();
await fetchCurrentUser();

const buildGuideChildren = () => {
  return GUIDE_DIFFICULTY_OPTIONS.map((group) => ({
    key: `/guide/d${group.value}`,
    label: group.label,
    iconImage: group.iconImage,
    children: Array.from({ length: group.max }, (_, index) => {
      const level = index + 1;
      return {
        key: `/guide/${group.value}/${level}`,
        label: `${level}星`
      };
    })
  }));
};

const iconPaths: Record<string, string> = {
  music: "M9 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M17 15V6l-9 2.5v9.5",
  trophy:
    "M7 4h10v3a5 5 0 0 1-10 0V4z M5 6H3v1a4 4 0 0 0 4 4 M19 6h2v1a4 4 0 0 1-4 4 M9 18h6 M10.5 18v2.5h3V18",
  book:
    "M4.5 5.5h7.5a2 2 0 0 1 2 2v11H6.5a2 2 0 0 0-2 2v-15z M19.5 5.5h-7.5a2 2 0 0 0-2 2v11h7.5a2 2 0 0 1 2 2v-15z",
  badge:
    "M12 3l3 2 3.5-.5.5 3.5 2.5 2.5-2.5 2.5-.5 3.5L15 18l-3 2-3-2-3.5.5-.5-3.5L2 10.5 4.5 8 .5 4.5 4 5l3-2z",
  history:
    "M12 6v6l3.5 2 M12 3a9 9 0 1 1-6.36 2.64 M4 4v4h4",
  settings:
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M4 12h2.2l.4-1.4-1.6-1.2 2-3.2 1.8.7 1.1-1.1-.7-1.8 3.2-1.2 1 1.6h1.6l1-1.6 3.2 1.2-.7 1.8 1.1 1.1 1.8-.7 2 3.2-1.6 1.2.4 1.4H20",
  info: "M12 10v6 M12 7h.01 M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0",
  forum:
    "M5 6.5h14A1.5 1.5 0 0 1 20.5 8v8A1.5 1.5 0 0 1 19 17.5H10l-4.5 3V8A1.5 1.5 0 0 1 7 6.5z M9 10.25h6 M9 13.75h4",
  grid: "M4 6h6v6H4z M14 6h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  user:
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 20a7.5 7.5 0 0 1 15 0",
  key:
    "M14 8a4 4 0 1 0 0 8h1.5l3.5 3.5 1-1-1.6-1.6 1.6-1.6-1-1-1.6 1.6-1.6-1.6-1 1 1.7 1.7H14a4 4 0 0 0 0-8z",
  logout:
    "M10 17l5-5-5-5 M15 12H6 M18 4h-7a2 2 0 0 0-2 2v2 M18 20h-7a2 2 0 0 1-2-2v-2"
};

const handleLogout = async () => {
  try {
    await $fetch("/api/account/auth/logout", { method: "POST" });
    clearAccountUser();
    await navigateTo("/account/login");
  } catch {
    // Ignore logout errors in sidebar shortcut.
  }
};

const isDeveloperReviewer = computed(
  () => accountUser.value?.username === "sigaer" && accountUser.value?.email === "1106865024@qq.com"
);

const groups = computed(() => [
  {
    title: "功能导航",
    icon: "grid",
    items: [
      { key: "/titles", label: "称号一览", icon: "badge" },
      { key: "/forum", label: "论坛社区", icon: "forum" },
      { key: "/alias-log", label: "别名修改日志", icon: "history" },
      {
        key: "/songs",
        label: "歌曲列表",
        icon: "music",
        children: [
          { key: "/songs/available", label: "实装歌曲" },
          { key: "/songs/removed", label: "未实装/已下架歌曲" }
        ]
      },
      {
        key: "/grade",
        label: "段位查询",
        icon: "trophy",
        children: [
          { key: "/grade/2023", label: "虹 2023" },
          { key: "/grade/2024", label: "虹 2024" },
          { key: "/grade/2025", label: "虹 2025" }
        ]
      },
      {
        key: "/guide",
        label: "谱面攻略",
        icon: "book",
        children: buildGuideChildren()
      }
    ]
  },
  {
    title: "账号系统",
    icon: "user",
    items: accountUser.value
      ? [
          { key: "/account/profile", label: "个人档案", icon: "user" },
          { key: "/account/songs", label: "歌曲数据", icon: "music" },
          { key: "/account/sync", label: "多端同步", icon: "history" },
          { key: "/account/developer", label: "开发者权限", icon: "badge" },
          ...(isDeveloperReviewer.value
            ? [{ key: "/account/developer/review", label: "开发者审批", icon: "key" }]
            : [])
        ]
      : [
          { key: "/account/login", label: "登录", icon: "key" },
          { key: "/account/register", label: "注册", icon: "user" }
        ]
  },
  {
    title: "设置与关于",
    icon: "settings",
    items: [
      { key: "/settings", label: "设置", icon: "settings" },
      { key: "/about", label: "关于", icon: "info" }
    ]
  }
]);

const activePath = computed(() => {
  if (route.path === "/") return "/";
  if (route.path.startsWith("/forum")) return "/forum";
  if (route.path === "/songs") return "/songs/available";
  if (route.path === "/songs/removed") return "/songs/removed";
  if (route.path.startsWith("/songs/")) return "/songs/available";
  if (route.path.startsWith("/account/profile")) return "/account/profile";
  if (route.path.startsWith("/account/songs")) return "/account/songs";
  if (route.path.startsWith("/account/sync")) return "/account/sync";
  if (route.path.startsWith("/account/developer/review")) return "/account/developer/review";
  if (route.path.startsWith("/account/developer")) return "/account/developer";
  if (route.path.startsWith("/account/login")) return "/account/login";
  if (route.path.startsWith("/account/register")) return "/account/register";
  if (route.path.startsWith("/guide/")) {
    const segments = route.path.split("/").filter(Boolean);
    if (segments.length >= 3) {
      return `/guide/${segments[1]}/${segments[2]}`;
    }
  }
  return route.path;
});

const openedGroups = computed(() => {
  if (activePath.value.startsWith("/songs")) return ["/songs"];
  if (activePath.value.startsWith("/grade")) return ["/grade"];
  if (activePath.value.startsWith("/account")) return [];
  if (activePath.value.startsWith("/guide")) {
    const segments = route.path.split("/").filter(Boolean);
    if (segments.length >= 2) return ["/guide", `/guide/d${segments[1]}`];
    return ["/guide"];
  }
  return [];
});
</script>

<template>
  <div class="nav-groups">
    <div v-if="accountUser" class="account-brief">
      <div class="account-brief__meta">
        <strong>{{ accountUser.username }}</strong>
        <span>{{ accountUser.email }}</span>
      </div>
      <el-button text class="account-brief__logout" @click="handleLogout">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              :d="iconPaths.logout"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span>退出登录</span>
      </el-button>
    </div>
    <div v-for="group in groups" :key="group.title" class="nav-group">
      <div class="nav-title">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              :d="iconPaths[group.icon]"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span>{{ group.title }}</span>
      </div>
      <el-menu :default-active="activePath" :default-openeds="openedGroups" class="nav-menu" router>
        <template v-for="item in group.items" :key="item.key">
          <el-sub-menu v-if="item.children" :index="item.key">
            <template #title>
              <span class="nav-item-label">
                <span class="nav-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      :d="iconPaths[item.icon]"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <span>{{ item.label }}</span>
              </span>
            </template>
            <template v-for="child in item.children" :key="child.key">
              <el-sub-menu v-if="child.children" :index="child.key">
                <template #title>
                  <span class="nav-item-label">
                    <img
                      v-if="child.iconImage"
                      class="sub-icon"
                      :src="child.iconImage"
                      :alt="child.label"
                    />
                    <span v-else class="sub-dot" aria-hidden="true"></span>
                    <span>{{ child.label }}</span>
                  </span>
                </template>
                <el-menu-item v-for="sub in child.children" :key="sub.key" :index="sub.key">
                  <span>{{ sub.label }}</span>
                </el-menu-item>
              </el-sub-menu>
              <el-menu-item v-else :index="child.key">
                <span>{{ child.label }}</span>
              </el-menu-item>
            </template>
          </el-sub-menu>
          <el-menu-item v-else :index="item.key">
            <span class="nav-item-label">
              <span class="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    :d="iconPaths[item.icon]"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span>{{ item.label }}</span>
            </span>
          </el-menu-item>
        </template>
      </el-menu>
    </div>
  </div>
</template>

<style scoped>
.nav-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.account-brief {
  padding: 14px 14px 10px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(255, 239, 221, 0.88), rgba(255, 250, 242, 0.92));
  box-shadow: 0 8px 18px rgba(160, 130, 100, 0.12);
  display: grid;
  gap: 10px;
}

.account-brief__meta {
  display: grid;
  gap: 4px;
}

.account-brief__meta span {
  color: #7c6a58;
  font-size: 12px;
  word-break: break-all;
}

.account-brief__logout {
  justify-content: flex-start;
  padding: 0;
}

.nav-group {
  padding: 10px 12px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 0 8px 18px rgba(160, 130, 100, 0.12);
}

.nav-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: #7c6a58;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.nav-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  color: #9b7a5c;
}

.nav-icon svg {
  width: 100%;
  height: 100%;
}

.nav-item-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.sub-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.sub-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(154, 124, 96, 0.6);
}

.nav-menu {
  border-right: none;
  background: transparent;
}

.nav-menu :deep(.el-menu-item) {
  border-radius: 12px;
  margin: 4px 0;
}
</style>
