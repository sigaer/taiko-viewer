<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{ purpose: "login" | "link"; redirect?: string }>();
const { locale } = useI18n();
const route = useRoute();
const apiFetch = useViewerApiFetch();
const { accountUser } = useAccountState();
const busy = ref("");
const localError = ref(false);
const scope = useAuthFormScope(() => { busy.value = ""; localError.value = false; });
type Provider = { id: string; label: string; recoveryAvailable?: boolean; recoveryConflict?: boolean; linked?: boolean; remoteLinkEnabled?: boolean; remoteLinkStatus?: string; remoteLinkError?: string; remoteLinkUnknown?: boolean };
const key = computed(() => `oidc-options:${props.purpose}:${accountUser.value?.id || "guest"}`);
const { data } = await useAsyncData(key, () => apiFetch<{ providers: Provider[] }>(
  props.purpose === "link" ? "/api/account/oidc/bindings" : "/api/account/oidc/providers"
).catch(() => ({ providers: [] })));
const providers = computed(() => data.value?.providers || []);
const copy = computed(() => locale.value === "ja" ? {
  title: props.purpose === "link" ? "外部アカウント連携" : "外部アカウントでログイン",
  recovery: "元の Viewer アカウントにログインして連携を確認してください。", confirm: "OurTaiko を再認証して連携を確認",
  login: "でログイン", link: "を連携", linked: "Viewer 連携済み",
  notRequested: "OurTaiko 未連携", confirmed: "OurTaiko 確認済み", pending: "OurTaiko の確認待ち", unknown: "OurTaiko の結果を確認できませんでした", remoteFailed: "OurTaiko の連携を完了できませんでした", retry: "再認証して連携を確認",
  remoteConflict: "OurTaiko の連携先が一致しません。サポートにお問い合わせください。", reauthorize: "もう一度 OurTaiko で認証してください。", applicationChanged: "連携設定が変更されました。サポートにお問い合わせください。",
  failed: "外部ログインを完了できませんでした。もう一度お試しいただくか、ユーザー名とパスワードでログインしてください。",
  conflict: "このメールアドレスは登録済みです。元のアカウントにログインしてから連携してください。",
  email: "確認済みのメールアドレスが必要です。Viewer アカウントを作成するか、既存のアカウントにログインして連携してください。",
  session: "ログイン状態が変わりました。現在のアカウントで最初からやり直してください。",
  ourtaikoEmail: "OurTaiko でメールアドレスを確認してから、もう一度お試しください。",
  rateLimited: "操作が多すぎます。しばらく待ってから、もう一度お試しください。",
  identity: "この外部アカウントは連携できません。現在のアカウントと連携状況を確認してください。"
} : {
  title: props.purpose === "link" ? "第三方账号关联" : "使用第三方账号登录",
  recovery: "此 OurTaiko 账号已关联 Viewer 账号。请登录原 Viewer 账号完成确认。", confirm: "重新授权 OurTaiko 并确认关联",
  login: "登录", link: "关联", linked: "Viewer 已关联",
  notRequested: "尚未提交 OurTaiko 绑定", confirmed: "OurTaiko 已确认", pending: "待 OurTaiko 确认", unknown: "OurTaiko 绑定结果未知", remoteFailed: "OurTaiko 绑定未完成", retry: "重新授权并确认绑定",
  remoteConflict: "OurTaiko 绑定关系冲突，请联系支持。", reauthorize: "请重新完成 OurTaiko 授权。", applicationChanged: "关联配置已变化，请联系支持。",
  failed: "第三方登录未完成。请重试，或使用用户名和密码登录。",
  conflict: "该邮箱已注册。请先登录原账号，再主动关联。",
  email: "需要已验证的邮箱。请先注册 Viewer 账号，或登录已有账号后关联。",
  session: "登录会话已变化，请在当前账号重新发起操作。",
  ourtaikoEmail: "请先在 OurTaiko 验证邮箱，再重试。",
  rateLimited: "操作较频繁，请稍后重试。",
  identity: "无法关联此第三方账号，请确认当前账号及关联状态。"
});
const errorMessage = computed(() => {
  if (localError.value) return copy.value.failed;
  const code = route.query.oidc_error;
  if (code === "ourtaiko_email_unverified") return copy.value.ourtaikoEmail;
  if (code === "ourtaiko_rate_limited") return copy.value.rateLimited;
  if (code === "existing_viewer_required") return copy.value.recovery;
  if (code === "email_conflict") return copy.value.conflict;
  if (code === "email_required") return copy.value.email;
  if (code === "session_changed") return copy.value.session;
  if (code === "identity_conflict") return copy.value.identity;
  return code ? copy.value.failed : "";
});
const label = (provider: Provider) => locale.value === "ja"
  ? `${provider.label}${props.purpose === "link" ? copy.value.link : copy.value.login}`
  : `${props.purpose === "link" ? copy.value.link : copy.value.login} ${provider.label}`;

const canRetry = (provider: Provider) => provider.linked && provider.remoteLinkEnabled && provider.remoteLinkStatus !== "linked" && provider.remoteLinkError !== "application_changed";
const remoteLabel = (provider: Provider) => {
  if (provider.remoteLinkStatus === "linked") return copy.value.confirmed;
  if (provider.remoteLinkStatus === "not_requested") return copy.value.notRequested;
  if (provider.remoteLinkError === "application_changed") return copy.value.applicationChanged;
  if (provider.remoteLinkError === "conflict") return copy.value.remoteConflict;
  if (provider.remoteLinkError === "reauthorize") return copy.value.reauthorize;
  if (provider.remoteLinkError === "rate_limited") return copy.value.rateLimited;
  if (provider.remoteLinkUnknown) return copy.value.unknown;
  return provider.remoteLinkStatus === "failed" ? copy.value.remoteFailed : copy.value.pending;
};
async function start(provider: Provider) {
  if (busy.value || (provider.linked && !canRetry(provider) && !provider.recoveryAvailable)) return;
  const ticket = scope.capture();
  busy.value = provider.id; localError.value = false;
  try {
    const result = await apiFetch<{ authorizationUrl: string }>(`/api/account/oidc/${provider.id}/start`, {
      method: "POST", body: { purpose: props.purpose, redirect: props.redirect, locale: locale.value, recover: provider.recoveryAvailable === true }
    });
    if (scope.current(ticket)) window.location.assign(result.authorizationUrl);
  } catch { if (scope.current(ticket)) localError.value = true; }
  finally { if (scope.currentView(ticket)) busy.value = ""; }
}
</script>

<template>
  <section v-if="providers.length" class="oidc-options" :aria-label="copy.title">
    <h3>{{ copy.title }}</h3>
    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
    <div class="oidc-provider-list">
      <div v-for="provider in providers" :key="provider.id" class="oidc-provider">
        <p v-if="provider.recoveryConflict" role="alert">{{ copy.recovery }}</p>
        <span v-if="provider.linked" class="oidc-linked">{{ provider.label }} · {{ copy.linked }}</span>
        <p v-if="provider.linked && (provider.remoteLinkEnabled || provider.remoteLinkStatus !== 'not_requested')" class="oidc-remote" role="status">{{ remoteLabel(provider) }}</p>
        <el-button v-if="!provider.recoveryConflict && (!provider.linked || canRetry(provider) || provider.recoveryAvailable)" :loading="busy === provider.id" :disabled="Boolean(busy)" @click="start(provider)">{{ provider.recoveryAvailable ? copy.confirm : provider.linked ? copy.retry : label(provider) }}</el-button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.oidc-options { min-width: 0; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--viewer-border); }
h3 { margin: 0 0 12px; font-size: 1rem; }
p { margin: 0 0 12px; line-height: 1.6; color: var(--viewer-text); overflow-wrap: anywhere; }
.oidc-provider-list { display: grid; gap: 12px; }
.oidc-provider { min-width: 0; }
.oidc-provider :deep(button) { width: 100%; min-height: 44px; height: auto; padding: 12px; white-space: normal; }
.oidc-provider :deep(button span), .oidc-linked { overflow-wrap: anywhere; white-space: normal; }
.oidc-linked { display: block; padding: 12px 0; }
</style>
