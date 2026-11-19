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

const completed = ref(false);
const completionError = ref("");
// Presentation only (slice E1): the code request's outcome beside the code field, the confirmation field's mismatch
// beside that field, and the password visibility toggle. Requests and guards are unchanged.
const codeNotice = ref("");
const codeError = ref("");
const confirmTouched = ref(false);
const confirmInput = ref<HTMLInputElement | null>(null);
const showPassword = ref(false);
const confirmMismatch = computed(() => confirmTouched.value && !completed.value && form.confirmPassword !== form.password);
const authScope = useAuthFormScope(() => { completed.value = false; completionError.value = ""; submitting.value = false; sendingCode.value = false; cooldown.value = 0; if (timer) clearInterval(timer); timer = null; form.password = ""; form.confirmPassword = ""; codeNotice.value = ""; codeError.value = ""; confirmTouched.value = false; });
// Slice E1: the inline zh / ja tables moved to locales (rework.account.*), same texts.
const completionCopy = computed(() => (void locale.value, {
  continue: t("rework.account.completion.continue"), login: t("rework.account.completion.login"), registered: t("rework.account.completion.registered"),
  reset: t("rework.account.completion.reset"), session: t("rework.account.completion.session"), navigation: t("rework.account.completion.navigation")
}));

definePageMeta({
  contentLayout: "reading",
  pageTitleKey: "account.forgotPassword",
  pageDescKey: "page.account.forgotPassword.desc",
  navKey: "/account/forgot-password",
  hidePageHeader: true,
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

const f = (name: string) => t(`rework.account.forgot.${name}`, { seconds: "{seconds}" });
const copy = computed(() => (void locale.value, {
  heading: f("heading"),
  email: f("email"),
  emailPlaceholder: f("emailPlaceholder"),
  code: f("code"),
  codePlaceholder: f("codePlaceholder"),
  sendCode: f("sendCode"),
  resend: f("resend"),
  password: f("password"),
  passwordPlaceholder: f("passwordPlaceholder"),
  confirmPassword: f("confirmPassword"),
  submit: f("submit"),
  back: f("back"),
  codeSent: f("codeSent"),
  codeFailed: f("codeFailed"),
  passwordMismatch: f("passwordMismatch"),
  success: f("success"),
  failed: f("failed")
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
  if (completed.value || !form.email || sendingCode.value || cooldown.value > 0) return;
  const ticket = authScope.capture();
  if (!authScope.current(ticket)) return;
  sendingCode.value = true;
  try {
    await apiFetch("/api/account/auth/send-code", {
      method: "POST",
      body: {
        email: form.email,
        purpose: "reset"
      }
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
  if (!completed.value && form.password !== form.confirmPassword) { ElMessage.error(copy.value.passwordMismatch); confirmTouched.value = true; confirmInput.value?.focus(); return; }
  const ticket = authScope.capture();
  if (!authScope.current(ticket)) return;
  submitting.value = true; completionError.value = "";
  try {
    if (!completed.value) {
      await apiFetch("/api/account/auth/reset-password", {method: "POST", body: {email: form.email, code: form.code, password: form.password}});
      if (!authScope.current(ticket)) return;
      completed.value = true; form.password = ""; form.confirmPassword = "";
      ElMessage.success(copy.value.success);
    }
    const failure = await navigateTo(localePath("/account/login"));
    if (failure) throw new Error(completionCopy.value.navigation);
  } catch (error: any) {
    if (!authScope.currentView(ticket)) return;
    completionError.value = completed.value ? completionCopy.value.navigation : (error?.data?.statusMessage || copy.value.failed);
    ElMessage.error(completionError.value);
  } finally { if (authScope.currentView(ticket)) submitting.value = false; }
};
</script>

<template>
  <ReworkAccountAuthFrame class="auth-page" :title="copy.heading">
    <p v-if="completionError" id="forgot-error" class="rw-alert" role="alert">{{ completionError }}</p>
    <p v-if="completed" class="rw-alert rw-alert--ok" role="status">{{ completionCopy.reset }}</p>
    <form class="rw-stack auth-form" :aria-describedby="completionError ? 'forgot-error' : undefined" @submit.prevent="submit">
      <div class="rw-field">
        <label class="rw-field__label" for="forgot-email">{{ copy.email }}</label>
        <input id="forgot-email" v-model="form.email" class="rw-input rw-input--block" name="email" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" enterkeyhint="next" :placeholder="copy.emailPlaceholder" :disabled="completed" />
      </div>
      <div class="rw-field">
        <label class="rw-field__label" for="forgot-code">{{ copy.code }}</label>
        <div class="rw-code-row">
          <input id="forgot-code" v-model="form.code" class="rw-input num" autocomplete="one-time-code" inputmode="numeric" enterkeyhint="next" maxlength="6" :placeholder="copy.codePlaceholder" :aria-invalid="codeError ? true : undefined" :aria-describedby="codeError ? 'forgot-code-error' : codeNotice ? 'forgot-code-notice' : undefined" :disabled="completed" />
          <button type="button" class="rw-btn" :class="{ 'is-busy': sendingCode }" :disabled="sendingCode || cooldown > 0 || completed" :aria-busy="sendingCode" @click="sendCode">
            {{ cooldown > 0 ? copy.resend.replace("{seconds}", String(cooldown)) : copy.sendCode }}
          </button>
        </div>
        <p v-if="codeError" id="forgot-code-error" class="rw-field__error" role="alert">{{ codeError }}</p>
        <p v-else-if="codeNotice" id="forgot-code-notice" class="rw-field__hint" role="status">{{ codeNotice }}</p>
      </div>
      <div class="rw-field">
        <label class="rw-field__label" for="forgot-password">{{ copy.password }}</label>
        <div class="rw-pw">
          <input id="forgot-password" v-model="form.password" class="rw-input rw-input--block" autocomplete="new-password" :type="showPassword ? 'text' : 'password'" enterkeyhint="next" aria-describedby="forgot-password-hint" :disabled="completed" />
          <button type="button" :aria-pressed="showPassword" :aria-label="t('rework.account.showPassword')" @click="showPassword = !showPassword"><ReworkIcon name="eye" /></button>
        </div>
        <p id="forgot-password-hint" class="rw-field__hint">{{ copy.passwordPlaceholder }}</p>
      </div>
      <div class="rw-field">
        <label class="rw-field__label" for="forgot-confirm">{{ copy.confirmPassword }}</label>
        <input id="forgot-confirm" ref="confirmInput" v-model="form.confirmPassword" class="rw-input rw-input--block" autocomplete="new-password" :type="showPassword ? 'text' : 'password'" enterkeyhint="done" :aria-invalid="confirmMismatch ? true : undefined" :aria-describedby="confirmMismatch ? 'forgot-confirm-error' : undefined" :disabled="completed" />
        <p v-if="confirmMismatch" id="forgot-confirm-error" class="rw-field__error" role="alert">{{ copy.passwordMismatch }}</p>
      </div>
      <button type="submit" class="rw-btn rw-btn--primary rw-btn--block submit-btn" :class="{ 'is-busy': submitting }" :disabled="submitting" :aria-busy="submitting">{{ completed ? completionCopy.continue : copy.submit }}</button>
    </form>
    <template #footer>
      <NuxtLink class="rw-link" :to="localePath('/account/login')">{{ copy.back }}</NuxtLink>
    </template>
  </ReworkAccountAuthFrame>
</template>
