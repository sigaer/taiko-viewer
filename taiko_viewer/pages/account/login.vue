<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { buildPageDescription } from "~/utils/seo";

const { t, locale } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { fetchCurrentUser } = useAccountState();
const {
  loadRememberedCredentials,
  saveRememberedCredentials,
  clearRememberedCredentials,
} = useRememberedAccountCredentials();
const submitting = ref(false);
const beta = useAnnualBeta();
const form = reactive({
  identifier: "",
  password: "",
});
const rememberCredentials = ref(false);
const redirectAfterLogin = computed(() => {
  const target = String(route.query.redirect || "").trim();
  return target.startsWith("/") && !target.startsWith("//") && !/[\r\n]/.test(target)
    ? target
    : localePath("/account/profile");
});

definePageMeta({
  contentLayout: "reading",
  middleware: "account-guest",
  pageTitleKey: "account.login",
  pageDescKey: "page.account.login.desc",
  navKey: "/account/login",
  breadcrumbs: [
    { labelKey: "account.title", to: "/account/profile" },
    { labelKey: "account.login", to: "/account/login" },
  ],
});

useViewerSeo(() => ({
  title: t("account.login"),
  description: buildPageDescription(t("page.account.login.desc")),
  path: "/account/login"
}));

const copy = computed(() =>
  locale.value === "ja"
    ? {
        heading: "ログイン",
        intro: "ログインするとプロフィール確認、連携 ID の切り替え、ローカル成績データの管理ができます。",
        identifier: "ユーザー名またはメールアドレス",
        identifierPlaceholder: "ユーザー名またはメールアドレスを入力",
        password: "パスワード",
        passwordPlaceholder: "パスワードを入力",
        remember: "ユーザー名とパスワードを保存",
        submit: "ログイン",
        register: "新規登録",
        forgot: "パスワードを忘れた場合",
        success: "ログインしました",
        failed: "ログインに失敗しました"
      }
    : {
        heading: "登录账号",
        intro: "登录后可查看个人档案、切换绑定的鼓众 ID，并直接维护本地成绩数据。",
        identifier: "用户名或邮箱",
        identifierPlaceholder: "输入用户名或邮箱",
        password: "密码",
        passwordPlaceholder: "输入密码",
        remember: "记住用户名和密码",
        submit: "登录",
        register: "注册账号",
        forgot: "找回密码",
        success: "登录成功",
        failed: "登录失败"
      }
);

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
  beta.track("auth_start",{auth_method:"login"});
  submitting.value = true;
  try {
    await apiFetch("/api/account/auth/login", {
      method: "POST",
      body: form,
    });
    if (rememberCredentials.value) {
      saveRememberedCredentials(form.identifier.trim(), form.password, true);
    } else {
      clearRememberedCredentials();
    }
    await fetchCurrentUser(true);
    ElMessage.success(copy.value.success);
    await navigateTo(redirectAfterLogin.value);
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.failed);
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="auth-page">
    <el-card class="panel-card auth-card">
      <div class="auth-head">
        <h2>{{ copy.heading }}</h2>
        <p>{{ copy.intro }}</p>
      </div>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item :label="copy.identifier">
          <el-input v-model="form.identifier" :placeholder="copy.identifierPlaceholder" />
        </el-form-item>
        <el-form-item :label="copy.password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            :placeholder="copy.passwordPlaceholder"
          />
        </el-form-item>
        <div class="remember-row">
          <el-checkbox v-model="rememberCredentials">{{ copy.remember }}</el-checkbox>
        </div>
        <el-button
          type="primary"
          class="submit-btn"
          :loading="submitting"
          @click="submit"
          >{{ copy.submit }}</el-button
        >
      </el-form>
      <div class="auth-links">
        <NuxtLink :to="{path:localePath('/account/register'),query:{redirect:redirectAfterLogin}}">{{ copy.register }}</NuxtLink>
        <NuxtLink :to="localePath('/account/forgot-password')">{{ copy.forgot }}</NuxtLink>
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
  width: 100%;
}

.auth-head h2 {
  margin: 0;
  font-size: 28px;
}

.auth-head p {
  margin: 8px 0 18px;
  color:#7f6c5e;
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
  color:var(--viewer-link);
  text-decoration: none;
}
</style>
