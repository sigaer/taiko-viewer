<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { buildPageDescription } from "~/utils/seo";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
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

definePageMeta({
  pageTitleKey: "account.forgotPassword",
  pageDescKey: "page.account.forgotPassword.desc",
  navKey: "/account/forgot-password",
  breadcrumbs: [
    { labelKey: "account.title", to: "/account/profile" },
    { labelKey: "account.forgotPassword", to: "/account/forgot-password" }
  ]
});

useViewerSeo(() => ({
  title: t("account.forgotPassword"),
  description: buildPageDescription(t("page.account.forgotPassword.desc")),
  path: "/account/forgot-password"
}));

const copy = computed(() =>
  locale.value === "ja"
    ? {
        heading: "パスワード再設定",
        intro: "登録済みメールアドレスと認証コードを入力すると、新しいログイン用パスワードを設定できます。",
        email: "メールアドレス",
        emailPlaceholder: "登録済みメールアドレスを入力",
        code: "メール認証コード",
        codePlaceholder: "6 桁の認証コードを入力",
        sendCode: "認証コード送信",
        resend: "{seconds}s 後に再送",
        password: "新しいパスワード",
        passwordPlaceholder: "6 文字以上",
        confirmPassword: "新しいパスワード確認",
        confirmPasswordPlaceholder: "もう一度入力",
        submit: "パスワードを再設定",
        back: "ログインへ戻る",
        codeSent: "認証コードを送信しました。メールを確認してください。",
        codeFailed: "認証コード送信に失敗しました",
        passwordMismatch: "入力したパスワードが一致しません",
        success: "パスワードを再設定しました。再度ログインしてください。",
        failed: "パスワード再設定に失敗しました"
      }
    : {
        heading: "找回密码",
        intro: "输入已注册邮箱并完成验证码校验后，即可设置新的登录密码。",
        email: "邮箱",
        emailPlaceholder: "输入注册邮箱",
        code: "邮箱验证码",
        codePlaceholder: "输入 6 位验证码",
        sendCode: "发送验证码",
        resend: "{seconds}s 后重发",
        password: "新密码",
        passwordPlaceholder: "至少 6 位",
        confirmPassword: "确认新密码",
        confirmPasswordPlaceholder: "再次输入密码",
        submit: "重置密码",
        back: "返回登录",
        codeSent: "验证码已发送，请检查邮箱",
        codeFailed: "验证码发送失败",
        passwordMismatch: "两次输入的密码不一致",
        success: "密码已重置，请重新登录",
        failed: "密码重置失败"
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
  if (!form.email || sendingCode.value || cooldown.value > 0) return;
  sendingCode.value = true;
  try {
    await apiFetch("/api/account/auth/send-code", {
      method: "POST",
      body: {
        email: form.email,
        purpose: "reset"
      }
    });
    ElMessage.success(copy.value.codeSent);
    startCooldown();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.codeFailed);
  } finally {
    sendingCode.value = false;
  }
};

const submit = async () => {
  if (submitting.value) return;
  if (form.password !== form.confirmPassword) {
    ElMessage.error(copy.value.passwordMismatch);
    return;
  }
  submitting.value = true;
  try {
    await apiFetch("/api/account/auth/reset-password", {
      method: "POST",
      body: {
        email: form.email,
        code: form.code,
        password: form.password
      }
    });
    ElMessage.success(copy.value.success);
    await navigateTo(localePath("/account/login"));
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
        <el-form-item :label="copy.email">
          <el-input v-model="form.email" :placeholder="copy.emailPlaceholder" />
        </el-form-item>
        <el-form-item :label="copy.code">
          <div class="code-row">
            <el-input v-model="form.code" maxlength="6" :placeholder="copy.codePlaceholder" />
            <el-button :loading="sendingCode" :disabled="cooldown > 0" @click="sendCode">
              {{ cooldown > 0 ? copy.resend.replace("{seconds}", String(cooldown)) : copy.sendCode }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item :label="copy.password">
          <el-input v-model="form.password" type="password" show-password :placeholder="copy.passwordPlaceholder" />
        </el-form-item>
        <el-form-item :label="copy.confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" show-password :placeholder="copy.confirmPasswordPlaceholder" />
        </el-form-item>
        <el-button type="primary" class="submit-btn" :loading="submitting" @click="submit">{{ copy.submit }}</el-button>
      </el-form>
      <div class="auth-links single-link">
        <NuxtLink :to="localePath('/account/login')">{{ copy.back }}</NuxtLink>
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
