<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { formatViewerTitle } from "~/composables/useViewerSeo";

const { fetchCurrentUser } = useAccountState();
const {
  loadRememberedCredentials,
  saveRememberedCredentials,
  clearRememberedCredentials,
} = useRememberedAccountCredentials();
const submitting = ref(false);
const form = reactive({
  identifier: "",
  password: "",
});
const rememberCredentials = ref(false);

const pageMeta = {
  title: "账号登录",
  desc: "登录 taiko viewer 账号，查看个人档案与歌曲数据。",
};

definePageMeta({
  middleware: "account-guest",
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/account/login",
  breadcrumbs: [
    { label: "账号系统", to: "/account/profile" },
    { label: "登录", to: "/account/login" },
  ],
});

useSeoMeta({
  title: formatViewerTitle(pageMeta.title),
  description: pageMeta.desc,
  ogTitle: formatViewerTitle(pageMeta.title),
  ogDescription: pageMeta.desc,
});

onMounted(() => {
  const remembered = loadRememberedCredentials();
  rememberCredentials.value = remembered.enabled;
  if (remembered.identifier) {
    form.identifier = remembered.identifier;
  }
  if (remembered.password) {
    form.password = remembered.password;
  }
});

const submit = async () => {
  if (submitting.value) return;
  submitting.value = true;
  try {
    await $fetch("/api/account/auth/login", {
      method: "POST",
      body: form,
    });
    if (rememberCredentials.value) {
      saveRememberedCredentials(form.identifier.trim(), form.password, true);
    } else {
      clearRememberedCredentials();
    }
    await fetchCurrentUser(true);
    ElMessage.success("登录成功");
    await navigateTo("/account/profile");
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "登录失败");
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="auth-page">
    <el-card class="panel-card auth-card">
      <div class="auth-head">
        <h2>登录账号</h2>
        <p>登录后可查看个人档案、切换绑定的鼓众 ID，并直接维护本地成绩数据。</p>
      </div>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名或邮箱">
          <el-input v-model="form.identifier" placeholder="输入用户名或邮箱" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="输入密码"
          />
        </el-form-item>
        <div class="remember-row">
          <el-checkbox v-model="rememberCredentials"
            >记住用户名和密码</el-checkbox
          >
        </div>
        <el-button
          type="primary"
          class="submit-btn"
          :loading="submitting"
          @click="submit"
          >登录</el-button
        >
      </el-form>
      <div class="auth-links">
        <NuxtLink to="/account/register">注册账号</NuxtLink>
        <NuxtLink to="/account/forgot-password">找回密码</NuxtLink>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  justify-content: center;
}

.auth-card {
  width: min(520px, 100%);
}

.auth-head h2 {
  margin: 0;
  font-size: 28px;
}

.auth-head p {
  margin: 8px 0 18px;
  color: #7f6c5e;
  line-height: 1.7;
}

.submit-btn {
  width: 100%;
  margin-top: 6px;
}

.remember-row {
  display: flex;
  justify-content: flex-start;
  margin: -4px 0 10px;
}

.auth-links {
  margin-top: 18px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.auth-links a {
  color: #9a6d47;
  text-decoration: none;
}
</style>
