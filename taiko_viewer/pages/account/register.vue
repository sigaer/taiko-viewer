<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { buildPageDescription } from "~/utils/seo";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const redirectAfterAuth = computed(() => { const value=String(route.query.redirect||""); return value.startsWith("/")&&!value.startsWith("//")&&!/[\\\r\n]/.test(value)?value:localePath("/account/profile"); });
const apiFetch = useViewerApiFetch();
const { accountUser, accountAuthError, fetchCurrentUser } = useAccountState();
const sendingCode = ref(false);
const submitting = ref(false);
const beta = useAnnualBeta();
const cooldown = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

const form = reactive({
  username: "",
  email: "",
  code: "",
  password: "",
  confirmPassword: "",
});

const authenticatedUserId = ref<number | null>(null);
const registered = ref(false);
const completionError = ref("");
const authScope = useAuthFormScope(() => { authenticatedUserId.value = null; registered.value = false; completionError.value = ""; submitting.value = false; sendingCode.value = false; cooldown.value = 0; if (timer) clearInterval(timer); timer = null; form.password = ""; form.confirmPassword = ""; });
const completionCopy = computed(() => locale.value === "ja"
  ? {continue: "続ける", login: "ログインを続ける", registered: "アカウントを作成しました。ログインを続けてください。", reset: "パスワードを再設定しました。ログイン画面を開いてください。", session: "ログイン状態を確認できませんでした。もう一度お試しください。", sessionChanged: "ログイン状態が変わりました。パスワードを再入力してください。", navigation: "処理は完了しましたが、ページを開けませんでした。もう一度お試しください。"}
  : {continue: "继续", login: "继续登录", registered: "账号已创建，请继续登录。", reset: "密码已重置，请继续打开登录页。", session: "未能确认登录状态，请重试。", sessionChanged: "登录会话已变化，请重新输入密码。", navigation: "操作已完成，但未能打开页面，请重试。"});

definePageMeta({
  contentLayout: "reading",
  middleware: "account-guest",
  pageTitleKey: "account.register",
  pageDescKey: "page.account.register.desc",
  navKey: "/account/register",
  breadcrumbs: [
    { labelKey: "account.title", to: "/account/profile" },
    { labelKey: "account.register", to: "/account/register" },
  ],
});

useViewerSeo(() => ({
  title: t("account.register"),
  description: buildPageDescription(t("page.account.register.desc")),
  path: "/account/register"
}));

const copy = computed(() =>
  locale.value === "ja"
    ? {
        heading: "新規登録",
        intro: "登録するとプロフィール確認、複数のドンダーひろば ID 連携、自分の楽曲データ管理ができます。",
        username: "ユーザー名",
        usernamePlaceholder: "ユーザー名を入力",
        email: "メールアドレス",
        emailPlaceholder: "メールアドレスを入力",
        code: "メール認証コード",
        codePlaceholder: "6 桁の認証コードを入力",
        sendCode: "認証コード送信",
        resend: "{seconds}s 後に再送",
        password: "パスワード",
        passwordPlaceholder: "6 文字以上",
        confirmPassword: "パスワード確認",
        confirmPasswordPlaceholder: "もう一度入力",
        submit: "登録してログイン",
        login: "すでにアカウントがある場合",
        codeSent: "認証コードを送信しました。メールを確認してください。",
        codeFailed: "認証コード送信に失敗しました",
        passwordMismatch: "入力したパスワードが一致しません",
        success: "登録とログインが完了しました",
        failed: "登録に失敗しました"
      }
    : {
        heading: "注册账号",
        intro: "注册后即可查看个人档案、绑定多个鼓众广场 ID，并管理自己的歌曲数据。",
        username: "用户名",
        usernamePlaceholder: "输入用户名",
        email: "邮箱",
        emailPlaceholder: "输入邮箱",
        code: "邮箱验证码",
        codePlaceholder: "输入 6 位验证码",
        sendCode: "发送验证码",
        resend: "{seconds}s 后重发",
        password: "密码",
        passwordPlaceholder: "至少 6 位",
        confirmPassword: "确认密码",
        confirmPasswordPlaceholder: "再次输入密码",
        submit: "注册并登录",
        login: "已有账号，去登录",
        codeSent: "验证码已发送，请检查邮箱",
        codeFailed: "验证码发送失败",
        passwordMismatch: "两次输入的密码不一致",
        success: "注册并登录成功",
        failed: "注册失败"
      }
);

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
  if (registered.value || !form.email || sendingCode.value || cooldown.value > 0) return;
  const ticket = authScope.capture();
  if (!authScope.current(ticket)) return;
  sendingCode.value = true;
  try {
    await apiFetch("/api/account/auth/send-code", {
      method: "POST",
      body: {
        email: form.email,
        purpose: "register",
      },
    });
    if (!authScope.current(ticket)) return;
    ElMessage.success(copy.value.codeSent);
    startCooldown();
  } catch (error: any) {
    if (!authScope.current(ticket)) return;
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.codeFailed);
  } finally {
    if (authScope.currentView(ticket)) sendingCode.value = false;
  }
};

const submit = async () => {
  if (submitting.value) return;
  if (!registered.value && form.password !== form.confirmPassword) { ElMessage.error(copy.value.passwordMismatch); return; }
  const ticket = authScope.capture();
  if (!authScope.current(ticket)) return;
  submitting.value = true; completionError.value = "";
  try {
    if (!registered.value) {
      beta.track("auth_start", {auth_method: "register"});
      await apiFetch("/api/account/auth/register", {method: "POST", body: {username: form.username, email: form.email, code: form.code, password: form.password}});
      if (!authScope.current(ticket)) return;
      registered.value = true;
    }
    if (!authenticatedUserId.value) {
      const result = await apiFetch<{user: {id: number}}>("/api/account/auth/login", {method: "POST", body: {identifier: form.username, password: form.password}});
      if (!authScope.current(ticket)) return;
      authenticatedUserId.value = result.user.id;
      form.password = ""; form.confirmPassword = "";
    }
    const session = await fetchCurrentUser(true);
    if (!authScope.currentView(ticket)) return;
    if (!session || session.id !== authenticatedUserId.value || accountUser.value?.id !== session.id) {
      if (!accountAuthError.value) { authenticatedUserId.value = null; throw new Error(completionCopy.value.sessionChanged); }
      throw new Error(completionCopy.value.session);
    }
    ElMessage.success(copy.value.success);
    const failure = await navigateTo(redirectAfterAuth.value);
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
      <p v-if="registered && !authenticatedUserId" role="status">{{ completionCopy.registered }}</p>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item :label="copy.username">
          <el-input
            name="username"
            autocomplete="username"
            v-model="form.username" :disabled="registered"
            maxlength="64"
            :placeholder="copy.usernamePlaceholder"
          />
        </el-form-item>
        <el-form-item :label="copy.email">
          <el-input name="email" type="email" autocomplete="email" v-model="form.email" :disabled="registered" :placeholder="copy.emailPlaceholder" />
        </el-form-item>
        <el-form-item :label="copy.code">
          <div class="code-row">
            <el-input
              name="verification-code"
              autocomplete="one-time-code"
              v-model="form.code" :disabled="registered"
              maxlength="6"
              :placeholder="copy.codePlaceholder"
            />
            <el-button
              :loading="sendingCode"
              :disabled="cooldown > 0 || registered"
              @click="sendCode"
            >
              {{ cooldown > 0 ? copy.resend.replace("{seconds}", String(cooldown)) : copy.sendCode }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item :label="copy.password">
          <el-input
            v-model="form.password" :disabled="Boolean(authenticatedUserId)"
            autocomplete="new-password"
            type="password"
            show-password
            :placeholder="copy.passwordPlaceholder"
          />
        </el-form-item>
        <el-form-item :label="copy.confirmPassword">
          <el-input
            v-model="form.confirmPassword" :disabled="Boolean(authenticatedUserId)"
            autocomplete="new-password"
            type="password"
            show-password
            :placeholder="copy.confirmPasswordPlaceholder"
          />
        </el-form-item>
        <el-button
          type="primary"
          class="submit-btn"
          :loading="submitting"
          native-type="submit"
          >{{ authenticatedUserId ? completionCopy.continue : registered ? completionCopy.login : copy.submit }}</el-button
        >
      </el-form>
      <div class="auth-links single-link">
        <NuxtLink :to="{path:localePath('/account/login'),query:{redirect:redirectAfterAuth}}">{{ copy.login }}</NuxtLink>
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
  color:var(--viewer-link);
  text-decoration: none;
}

@media (max-width: 640px) {
  .code-row {
    grid-template-columns: 1fr;
  }
}
</style>
