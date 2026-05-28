<script setup lang="ts">
import { computed } from "vue";

const { locale } = useI18n();
const localePath = useLocalePath();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

const copy = computed(() =>
  locale.value === "ja"
    ? {
        title: "この機能を使うにはログインとドンダーひろば ID 連携が必要です",
        desc: "先に Web でログイン・ID 連携し、「多端同期」で鼓衆広場から成績を取得・配信してください。",
        login: "ログインへ",
        register: "新規登録"
      }
    : {
        title: "此功能需要登录并绑定鼓众 ID",
        desc: "请先在网页端登录并绑定鼓众广场 ID，再通过「多端同步」从鼓众广场拉取并分发成绩。",
        login: "去登录",
        register: "注册账号"
      }
);
</script>

<template>
  <el-alert
    v-if="!accountUser"
    type="warning"
    :closable="false"
    show-icon
    :title="copy.title"
    class="tool-gate-alert"
  >
    <p>{{ copy.desc }}</p>
    <div class="tool-gate-actions">
      <NuxtLink :to="localePath('/account/login')">
        <el-button type="primary">{{ copy.login }}</el-button>
      </NuxtLink>
      <NuxtLink :to="localePath('/account/register')">
        <el-button>{{ copy.register }}</el-button>
      </NuxtLink>
    </div>
  </el-alert>
  <slot v-else />
</template>

<style scoped>
.tool-gate-alert {
  margin-bottom: 16px;
}

.tool-gate-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}
</style>
