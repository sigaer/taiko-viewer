<script setup lang="ts">
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();
</script>

<template>
  <el-alert
    v-if="!accountUser"
    type="warning"
    :closable="false"
    show-icon
    title="此功能需要登录并绑定鼓众 ID"
    class="tool-gate-alert"
  >
    <p>请先在网页端登录账号，并在个人档案中绑定鼓众广场 ID，再通过「多端同步」拉取成绩数据。</p>
    <div class="tool-gate-actions">
      <NuxtLink to="/account/login">
        <el-button type="primary">去登录</el-button>
      </NuxtLink>
      <NuxtLink to="/account/register">
        <el-button>注册账号</el-button>
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
