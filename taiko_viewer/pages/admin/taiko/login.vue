<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";

defineI18nRoute(false);

definePageMeta({
  layout: false,
  middleware: "admin-guest"
});

useHead({
  title: "Taiko Admin 登录",
  meta: [{ name: "robots", content: "noindex,nofollow" }]
});

const apiFetch = useAdminApiFetch();
const { fetchCurrentAdmin } = useAdminState();
const submitting = ref(false);
const form = reactive({
  username: "maru",
  password: "JCPsHfPW3qIKdCD"
});

const copy = computed(() => ({
  heading: "Taiko 管理后台",
  intro: "使用远端 taiko 管理端账号登录。当前后台仅对授权人员开放，所有敏感操作都会写入审计日志。",
  username: "管理员账号",
  password: "密码",
  submit: "登录后台",
  hint: "当前表单已预填测试账号，可直接验证登录链路。"
}));

const submit = async () => {
  if (submitting.value) return;
  submitting.value = true;
  try {
    await apiFetch("/api/admin/auth/login", {
      method: "POST",
      body: form
    });
    await fetchCurrentAdmin(true);
    ElMessage.success("管理员登录成功");
    await navigateTo("/admin/taiko/dashboard");
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "登录失败");
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="admin-login-page">
    <section class="admin-login-hero">
      <span class="admin-login-hero__eyebrow">KOI-inspired Admin Console</span>
      <h1>{{ copy.heading }}</h1>
      <p>{{ copy.intro }}</p>
      <div class="admin-login-hero__panels">
        <div class="admin-login-hero__panel">
          <strong>鉴权</strong>
          <span>通过 Nuxt server 代理远端 `/taiko/login`，JWT 只保存在 `httpOnly` Cookie。</span>
        </div>
        <div class="admin-login-hero__panel">
          <strong>审计</strong>
          <span>后台 CRUD、bot 来源写入和备份动作统一落到 `web_admin_action_logs`。</span>
        </div>
      </div>
    </section>

    <el-card class="admin-login-card">
      <div class="admin-login-card__head">
        <h2>{{ copy.heading }}</h2>
        <p>{{ copy.hint }}</p>
      </div>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item :label="copy.username">
          <el-input v-model="form.username" autocomplete="username" />
        </el-form-item>
        <el-form-item :label="copy.password">
          <el-input v-model="form.password" type="password" show-password autocomplete="current-password" />
        </el-form-item>
        <el-button type="primary" class="admin-login-card__submit" :loading="submitting" @click="submit">
          {{ copy.submit }}
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.admin-login-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(360px, 460px);
  gap: 32px;
  padding: 40px;
  background:
    radial-gradient(circle at top left, rgba(247, 206, 117, 0.35), transparent 26%),
    linear-gradient(145deg, #efe5d7 0%, #faf6ee 46%, #f3eadf 100%);
}

.admin-login-hero {
  padding: 28px 18px;
  display: grid;
  align-content: center;
  gap: 18px;
}

.admin-login-hero__eyebrow {
  display: inline-flex;
  width: fit-content;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(36, 28, 18, 0.08);
  color: #8a6937;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.admin-login-hero h1 {
  margin: 0;
  font-size: clamp(42px, 7vw, 72px);
  line-height: 0.94;
  color: #182338;
}

.admin-login-hero p {
  margin: 0;
  max-width: 720px;
  color: #5d5244;
  font-size: 16px;
  line-height: 1.8;
}

.admin-login-hero__panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 12px;
}

.admin-login-hero__panel {
  padding: 20px;
  border-radius: 22px;
  background: rgba(255, 252, 247, 0.82);
  box-shadow: 0 18px 40px rgba(139, 119, 82, 0.11);
  display: grid;
  gap: 8px;
}

.admin-login-card {
  align-self: center;
  border-radius: 28px;
  border: none;
  overflow: hidden;
}

.admin-login-card__head h2 {
  margin: 0 0 8px;
  color: #1e2a3d;
  font-size: 28px;
}

.admin-login-card__head p {
  margin: 0 0 18px;
  color: #7c6e5c;
  line-height: 1.7;
}

.admin-login-card__submit {
  width: 100%;
  min-height: 46px;
  border-radius: 14px;
  margin-top: 8px;
}

@media (max-width: 960px) {
  .admin-login-page {
    grid-template-columns: 1fr;
    padding: 20px;
  }

  .admin-login-hero__panels {
    grid-template-columns: 1fr;
  }
}
</style>
