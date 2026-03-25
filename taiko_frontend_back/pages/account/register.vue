<script setup lang="ts">
import { reactive, ref } from "vue";
import { ElMessage } from "element-plus";

const { fetchCurrentUser } = useAccountState();
const { saveRememberedCredentials } = useRememberedAccountCredentials();
const sendingCode = ref(false);
const submitting = ref(false);
const cooldown = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

const form = reactive({
  username: "",
  email: "",
  code: "",
  password: "",
  confirmPassword: "",
});

const pageMeta = {
  title: "注册账号",
  desc: "注册 taiko viewer 账号并绑定邮箱验证码。",
};

definePageMeta({
  middleware: "account-guest",
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/account/register",
  breadcrumbs: [
    { label: "账号系统", to: "/account/profile" },
    { label: "注册", to: "/account/register" },
  ],
});

useSeoMeta({
  title: pageMeta.title,
  description: pageMeta.desc,
  ogTitle: pageMeta.title,
  ogDescription: pageMeta.desc,
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

const startCooldown = () => {
  cooldown.value = 60;
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    cooldown.value -= 1;
    if (cooldown.value <= 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  }, 1000);
};

const sendCode = async () => {
  if (!form.email || sendingCode.value || cooldown.value > 0) return;
  sendingCode.value = true;
  try {
    await $fetch("/api/account/auth/send-code", {
      method: "POST",
      body: {
        email: form.email,
        purpose: "register",
      },
    });
    ElMessage.success("验证码已发送，请检查邮箱");
    startCooldown();
  } catch (error: any) {
    ElMessage.error(
      error?.data?.statusMessage || error?.message || "验证码发送失败",
    );
  } finally {
    sendingCode.value = false;
  }
};

const submit = async () => {
  if (submitting.value) return;
  if (form.password !== form.confirmPassword) {
    ElMessage.error("两次输入的密码不一致");
    return;
  }
  submitting.value = true;
  try {
    await $fetch("/api/account/auth/register", {
      method: "POST",
      body: {
        username: form.username,
        email: form.email,
        code: form.code,
        password: form.password,
      },
    });
    await $fetch("/api/account/auth/login", {
      method: "POST",
      body: {
        identifier: form.username,
        password: form.password,
      },
    });
    saveRememberedCredentials(form.username.trim(), form.password, true);
    await fetchCurrentUser(true);
    ElMessage.success("注册并登录成功");
    await navigateTo("/account/profile");
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "注册失败");
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="auth-page">
    <el-card class="panel-card auth-card">
      <div class="auth-head">
        <h2>注册账号</h2>
        <p>
          注册后即可查看个人档案、绑定多个鼓众广场 ID，并管理自己的歌曲数据。
        </p>
      </div>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input
            v-model="form.username"
            maxlength="64"
            placeholder="输入用户名"
          />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="输入邮箱" />
        </el-form-item>
        <el-form-item label="邮箱验证码">
          <div class="code-row">
            <el-input
              v-model="form.code"
              maxlength="6"
              placeholder="输入 6 位验证码"
            />
            <el-button
              :loading="sendingCode"
              :disabled="cooldown > 0"
              @click="sendCode"
            >
              {{ cooldown > 0 ? `${cooldown}s 后重发` : "发送验证码" }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="至少 6 位"
          />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            show-password
            placeholder="再次输入密码"
          />
        </el-form-item>
        <el-button
          type="primary"
          class="submit-btn"
          :loading="submitting"
          @click="submit"
          >注册并登录</el-button
        >
      </el-form>
      <div class="auth-links single-link">
        <NuxtLink to="/account/login">已有账号，去登录</NuxtLink>
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
  width: min(560px, 100%);
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

.code-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  width: 100%;
}

.submit-btn {
  width: 100%;
  margin-top: 6px;
}

.auth-links {
  margin-top: 18px;
  display: flex;
  justify-content: center;
}

.auth-links a {
  color: #9a6d47;
  text-decoration: none;
}

@media (max-width: 640px) {
  .code-row {
    grid-template-columns: 1fr;
  }
}
</style>
