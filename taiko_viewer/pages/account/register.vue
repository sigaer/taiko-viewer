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
// Presentation only (slice E1): the code request's outcome beside the code field, the confirmation field's mismatch
// beside that field, and the password visibility toggles. Requests and guards are unchanged.
const codeNotice = ref("");
const codeError = ref("");
const confirmTouched = ref(false);
const confirmInput = ref<HTMLInputElement | null>(null);
const showPassword = ref(false);
const confirmMismatch = computed(() => confirmTouched.value && !registered.value && form.confirmPassword !== form.password);
const authScope = useAuthFormScope(() => { authenticatedUserId.value = null; registered.value = false; completionError.value = ""; submitting.value = false; sendingCode.value = false; cooldown.value = 0; if (timer) clearInterval(timer); timer = null; form.password = ""; form.confirmPassword = ""; codeNotice.value = ""; codeError.value = ""; confirmTouched.value = false; });
// Slice E1: the inline zh / ja tables moved to locales (rework.account.*), same texts.
const completionCopy = computed(() => (void locale.value, {
  continue: t("rework.account.completion.continue"), login: t("rework.account.completion.login"), registered: t("rework.account.completion.registered"),
  reset: t("rework.account.completion.reset"), session: t("rework.account.completion.session"), sessionChanged: t("rework.account.completion.sessionChanged"),
  navigation: t("rework.account.completion.navigation")
}));

definePageMeta({
  contentLayout: "reading",
  middleware: "account-guest",
  pageTitleKey: "account.register",
  pageDescKey: "page.account.register.desc",
  navKey: "/account/register",
  hidePageHeader: true,
  reworkElementPlus: true,
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

const r = (name: string) => t(`rework.account.register.${name}`, { seconds: "{seconds}" });
const copy = computed(() => (void locale.value, {
  heading: r("heading"),
  username: r("username"),
  email: r("email"),
  code: r("code"),
  codePlaceholder: r("codePlaceholder"),
  sendCode: r("sendCode"),
  resend: r("resend"),
  password: r("password"),
  passwordPlaceholder: r("passwordPlaceholder"),
  confirmPassword: r("confirmPassword"),
  submit: r("submit"),
  login: r("login"),
  codeSent: r("codeSent"),
  codeFailed: r("codeFailed"),
  passwordMismatch: r("passwordMismatch"),
  success: r("success"),
  failed: r("failed")
}));

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
    codeError.value = ""; codeNotice.value = copy.value.codeSent;
    startCooldown();
  } catch (error: any) {
    if (!authScope.current(ticket)) return;
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.codeFailed);
    codeNotice.value = ""; codeError.value = error?.data?.statusMessage || error?.message || copy.value.codeFailed;
  } finally {
    if (authScope.currentView(ticket)) sendingCode.value = false;
  }
};

const submit = async () => {
  if (submitting.value) return;
  if (!registered.value && form.password !== form.confirmPassword) { ElMessage.error(copy.value.passwordMismatch); confirmTouched.value = true; confirmInput.value?.focus(); return; }
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
  <ReworkAccountAuthFrame class="auth-page" :title="copy.heading">
    <p v-if="completionError" id="register-error" class="rw-alert" role="alert">{{ completionError }}</p>
    <p v-if="registered && !authenticatedUserId" class="rw-alert rw-alert--ok" role="status">{{ completionCopy.registered }}</p>
    <form class="rw-stack auth-form" :aria-describedby="completionError ? 'register-error' : undefined" @submit.prevent="submit">
      <div class="rw-field">
        <label class="rw-field__label" for="register-username">{{ copy.username }}</label>
        <input id="register-username" v-model="form.username" class="rw-input rw-input--block" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" enterkeyhint="next" maxlength="64" :disabled="registered" />
      </div>
      <div class="rw-field">
        <label class="rw-field__label" for="register-email">{{ copy.email }}</label>
        <input id="register-email" v-model="form.email" class="rw-input rw-input--block" name="email" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" enterkeyhint="next" :disabled="registered" />
      </div>
      <div class="rw-field">
        <label class="rw-field__label" for="register-code">{{ copy.code }}</label>
        <div class="rw-code-row">
          <input id="register-code" v-model="form.code" class="rw-input num" name="verification-code" autocomplete="one-time-code" inputmode="numeric" enterkeyhint="next" maxlength="6" :placeholder="copy.codePlaceholder" :aria-invalid="codeError ? true : undefined" :aria-describedby="codeError ? 'register-code-error' : codeNotice ? 'register-code-notice' : undefined" :disabled="registered" />
          <button type="button" class="rw-btn" :class="{ 'is-busy': sendingCode }" :disabled="sendingCode || cooldown > 0 || registered" :aria-busy="sendingCode" @click="sendCode">
            {{ cooldown > 0 ? copy.resend.replace("{seconds}", String(cooldown)) : copy.sendCode }}
          </button>
        </div>
        <p v-if="codeError" id="register-code-error" class="rw-field__error" role="alert">{{ codeError }}</p>
        <p v-else-if="codeNotice" id="register-code-notice" class="rw-field__hint" role="status">{{ codeNotice }}</p>
      </div>
      <div class="rw-field">
        <label class="rw-field__label" for="register-password">{{ copy.password }}</label>
        <div class="rw-pw">
          <input id="register-password" v-model="form.password" class="rw-input rw-input--block" autocomplete="new-password" :type="showPassword ? 'text' : 'password'" enterkeyhint="next" aria-describedby="register-password-hint" :disabled="Boolean(authenticatedUserId)" />
          <button type="button" :aria-pressed="showPassword" :aria-label="t('rework.account.showPassword')" @click="showPassword = !showPassword"><ReworkIcon name="eye" /></button>
        </div>
        <p id="register-password-hint" class="rw-field__hint">{{ copy.passwordPlaceholder }}</p>
      </div>
      <div class="rw-field">
        <label class="rw-field__label" for="register-confirm">{{ copy.confirmPassword }}</label>
        <input id="register-confirm" ref="confirmInput" v-model="form.confirmPassword" class="rw-input rw-input--block" autocomplete="new-password" :type="showPassword ? 'text' : 'password'" enterkeyhint="done" :aria-invalid="confirmMismatch ? true : undefined" :aria-describedby="confirmMismatch ? 'register-confirm-error' : undefined" :disabled="Boolean(authenticatedUserId)" />
        <p v-if="confirmMismatch" id="register-confirm-error" class="rw-field__error" role="alert">{{ copy.passwordMismatch }}</p>
      </div>
      <button type="submit" class="rw-btn rw-btn--primary rw-btn--block submit-btn" :class="{ 'is-busy': submitting }" :disabled="submitting" :aria-busy="submitting">{{ authenticatedUserId ? completionCopy.continue : registered ? completionCopy.login : copy.submit }}</button>
    </form>
    <ReworkAccountOidcOptions purpose="login" :redirect="redirectAfterAuth" />
    <template #footer>
      <NuxtLink class="rw-link" :to="{path:localePath('/account/login'),query:{redirect:redirectAfterAuth}}">{{ copy.login }}</NuxtLink>
    </template>
  </ReworkAccountAuthFrame>
</template>
