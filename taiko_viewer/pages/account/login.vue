<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { buildPageDescription } from "~/utils/seo";

const { t, locale } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { accountUser, accountAuthError, fetchCurrentUser } = useAccountState();
const { loadRememberedIdentifier, saveRememberedIdentifier } = useRememberedAccountIdentifier();
const submitting = ref(false);
const beta = useAnnualBeta();
const form = reactive({
  identifier: "",
  password: "",
});
const rememberIdentifier = ref(false);
const authenticatedUserId = ref<number | null>(null);
const completionError = ref("");
const authRetrying = ref(false);
const authScope = useAuthFormScope(() => { authenticatedUserId.value = null; completionError.value = ""; authRetrying.value = false; submitting.value = false; form.password = ""; });
const completionCopy = computed(() => locale.value === "ja"
  ? {continue: "続ける", login: "ログインを続ける", registered: "アカウントを作成しました。ログインを続けてください。", reset: "パスワードを再設定しました。ログイン画面を開いてください。", session: "ログイン状態を確認できませんでした。もう一度お試しください。", sessionChanged: "ログイン状態が変わりました。パスワードを再入力してください。", navigation: "処理は完了しましたが、ページを開けませんでした。もう一度お試しください。"}
  : {continue: "继续", login: "继续登录", registered: "账号已创建，请继续登录。", reset: "密码已重置，请继续打开登录页。", session: "未能确认登录状态，请重试。", sessionChanged: "登录会话已变化，请重新输入密码。", navigation: "操作已完成，但未能打开页面，请重试。"});

const redirectAfterLogin = computed(() => {
  const target = String(route.query.redirect || "").trim();
  return target.startsWith("/") && !target.startsWith("//") && !/[\\\r\n]/.test(target)
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
        remember: "アカウントを保存",
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
        remember: "记住账号",
        submit: "登录",
        register: "注册账号",
        forgot: "找回密码",
        success: "登录成功",
        failed: "登录失败"
      }
);

onMounted(() => {
  const remembered = loadRememberedIdentifier();
  rememberIdentifier.value = remembered.enabled;
  if (remembered.identifier) {
    form.identifier = remembered.identifier;
  }
});

const retryAuth = async () => {
  if (authRetrying.value) return;
  const ticket = authScope.capture();
  authRetrying.value = true;
  try {
    const user = await fetchCurrentUser(true);
    if (authScope.currentView(ticket) && user && !accountAuthError.value) {
      authenticatedUserId.value = user.id;
      form.identifier = user.username || user.email || ""; form.password = "";
      const failure = await navigateTo(redirectAfterLogin.value);
      if (failure) completionError.value = completionCopy.value.navigation;
    }
  } catch {
    if (authScope.currentView(ticket)) completionError.value = completionCopy.value.navigation;
  } finally { if (authScope.currentView(ticket)) authRetrying.value = false; }
};

const submit = async () => {
  if (submitting.value) return;
  const ticket = authScope.capture();
  if (!authScope.current(ticket)) return;
  submitting.value = true; completionError.value = "";
  try {
    if (!authenticatedUserId.value) {
      beta.track("auth_start", {auth_method: "login"});
      const result = await apiFetch<{user: {id: number}}>("/api/account/auth/login", {method: "POST", body: {identifier: form.identifier, password: form.password}});
      if (!authScope.current(ticket)) return;
      authenticatedUserId.value = result.user.id;
      saveRememberedIdentifier(form.identifier, rememberIdentifier.value);
      form.password = "";
    }
    const session = await fetchCurrentUser(true);
    if (!authScope.currentView(ticket)) return;
    if (!session || session.id !== authenticatedUserId.value || accountUser.value?.id !== session.id) {
      if (!accountAuthError.value) { authenticatedUserId.value = null; throw new Error(completionCopy.value.sessionChanged); }
      throw new Error(completionCopy.value.session);
    }
    ElMessage.success(copy.value.success);
    const failure = await navigateTo(redirectAfterLogin.value);
    if (failure) throw new Error(completionCopy.value.navigation);
  } catch (error: any) {
    if (!authScope.currentView(ticket)) return;
    completionError.value = error?.data?.statusMessage || error?.message || copy.value.failed;
    ElMessage.error(completionError.value);
  } finally { if (authScope.currentView(ticket)) submitting.value = false; }
};
</script>

<template>
  <div class="auth-page">
    <el-card class="panel-card auth-card">
      <div class="auth-head">
        <h2>{{ copy.heading }}</h2>
        <p>{{ copy.intro }}</p>
      </div>
      <p v-if="completionError" role="alert">{{ completionError }}</p>
      <div v-if="accountAuthError && !authenticatedUserId" class="auth-state-error" role="alert">
        <p>{{ completionCopy.session }}</p>
        <el-button :loading="authRetrying" @click="retryAuth">{{ t('common.retry') }}</el-button>
      </div>
      <el-form v-else label-position="top" @submit.prevent="submit">
        <el-form-item :label="copy.identifier">
          <el-input name="username" autocomplete="username" v-model="form.identifier" :disabled="Boolean(authenticatedUserId)" :placeholder="copy.identifierPlaceholder" />
        </el-form-item>
        <el-form-item :label="copy.password">
          <el-input
            v-model="form.password" :disabled="Boolean(authenticatedUserId)"
            name="password"
            autocomplete="current-password"
            type="password"
            show-password
            :placeholder="copy.passwordPlaceholder"
          />
        </el-form-item>
        <div class="remember-row">
          <el-checkbox v-model="rememberIdentifier" @change="value => { if (!value) saveRememberedIdentifier('', false); }">{{ copy.remember }}</el-checkbox>
        </div>
        <el-button
          type="primary"
          class="submit-btn"
          :loading="submitting"
          native-type="submit"
          >{{ authenticatedUserId ? completionCopy.continue : copy.submit }}</el-button
        >
      </el-form>
      <AccountOidcOptions purpose="login" :redirect="redirectAfterLogin" />
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
  color:var(--viewer-text-muted);
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
