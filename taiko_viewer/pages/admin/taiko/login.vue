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
  username: "",
  password: ""
});

const copy = computed(() => ({
  heading: "Taiko 管理后台",
  intro: "使用已授权的 taiko 管理账号登录后台。",
  username: "管理员账号",
  password: "密码",
  submit: "登录后台",
  hint: "仅授权人员可访问。"
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
  max-width: 560px;
  color: #5d5244;
  font-size: 16px;
  line-height: 1.8;
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
}
</style>
