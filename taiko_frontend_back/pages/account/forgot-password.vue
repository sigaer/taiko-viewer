<script setup lang="ts">
import { reactive, ref } from "vue";
import { ElMessage } from "element-plus";

const sendingCode = ref(false);
const submitting = ref(false);
const cooldown = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

const form = reactive({
  email: "",
  code: "",
  password: "",
  confirmPassword: ""
});

const pageMeta = {
  title: "找回密码",
  desc: "通过邮箱验证码重置 taiko viewer 的登录密码。"
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/account/forgot-password",
  breadcrumbs: [
    { label: "账号系统", to: "/account/profile" },
    { label: "找回密码", to: "/account/forgot-password" }
  ]
});

useSeoMeta({
  title: pageMeta.title,
  description: pageMeta.desc,
  ogTitle: pageMeta.title,
  ogDescription: pageMeta.desc
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
        purpose: "reset"
      }
    });
    ElMessage.success("验证码已发送，请检查邮箱");
    startCooldown();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "验证码发送失败");
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
    await $fetch("/api/account/auth/reset-password", {
      method: "POST",
      body: {
        email: form.email,
        code: form.code,
        password: form.password
      }
    });
    ElMessage.success("密码已重置，请重新登录");
    await navigateTo("/account/login");
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "密码重置失败");
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="auth-page">
    <el-card class="panel-card auth-card">
      <div class="auth-head">
        <h2>找回密码</h2>
        <p>输入已注册邮箱并完成验证码校验后，即可设置新的登录密码。</p>
      </div>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="输入注册邮箱" />
        </el-form-item>
        <el-form-item label="邮箱验证码">
          <div class="code-row">
            <el-input v-model="form.code" maxlength="6" placeholder="输入 6 位验证码" />
            <el-button :loading="sendingCode" :disabled="cooldown > 0" @click="sendCode">
              {{ cooldown > 0 ? `${cooldown}s 后重发` : "发送验证码" }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="form.confirmPassword" type="password" show-password placeholder="再次输入密码" />
        </el-form-item>
        <el-button type="primary" class="submit-btn" :loading="submitting" @click="submit">重置密码</el-button>
      </el-form>
      <div class="auth-links single-link">
        <NuxtLink to="/account/login">返回登录</NuxtLink>
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
