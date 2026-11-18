<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { buildPageDescription } from "~/utils/seo";
import { authReturnNavigationOptions } from "~/utils/auth-return-navigation";

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
// Presentation only: the password stays a password field until the visitor shows it.
const showPassword = ref(false);
const authScope = useAuthFormScope(() => { authenticatedUserId.value = null; completionError.value = ""; authRetrying.value = false; submitting.value = false; form.password = ""; });
// Slice E1: the inline zh / ja tables moved to locales (rework.account.*), same texts.
const completionCopy = computed(() => (void locale.value, {
  continue: t("rework.account.completion.continue"), login: t("rework.account.completion.login"), registered: t("rework.account.completion.registered"),
  reset: t("rework.account.completion.reset"), session: t("rework.account.completion.session"), sessionChanged: t("rework.account.completion.sessionChanged"),
  navigation: t("rework.account.completion.navigation")
}));

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
  hidePageHeader: true,
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

const copy = computed(() => (void locale.value, {
  heading: t("rework.account.login.heading"),
  identifier: t("rework.account.login.identifier"),
  password: t("rework.account.login.password"),
  remember: t("rework.account.login.remember"),
  submit: t("rework.account.login.submit"),
  register: t("rework.account.login.register"),
  forgot: t("rework.account.login.forgot"),
  success: t("rework.account.login.success"),
  failed: t("rework.account.login.failed")
}));

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
      const failure = await navigateTo(redirectAfterLogin.value, authReturnNavigationOptions(redirectAfterLogin.value));
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
    const failure = await navigateTo(redirectAfterLogin.value, authReturnNavigationOptions(redirectAfterLogin.value));
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
    <p v-if="completionError" id="login-error" class="rw-alert" role="alert">{{ completionError }}</p>
    <div v-if="accountAuthError && !authenticatedUserId" class="rw-alert auth-state-error" role="alert">
      <p>{{ completionCopy.session }}</p>
      <button type="button" class="rw-btn rw-btn--sm" :class="{ 'is-busy': authRetrying }" :disabled="authRetrying" :aria-busy="authRetrying" @click="retryAuth">{{ t('common.retry') }}</button>
    </div>
    <form v-else class="rw-stack auth-form" :aria-describedby="completionError ? 'login-error' : undefined" @submit.prevent="submit">
      <div class="rw-field">
        <label class="rw-field__label" for="login-identifier">{{ copy.identifier }}</label>
        <input id="login-identifier" v-model="form.identifier" class="rw-input rw-input--block" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" enterkeyhint="next" :disabled="Boolean(authenticatedUserId)" />
      </div>
      <div class="rw-field">
        <label class="rw-field__label" for="login-password">{{ copy.password }}</label>
        <div class="rw-pw">
          <input id="login-password" v-model="form.password" class="rw-input rw-input--block" name="password" autocomplete="current-password" :type="showPassword ? 'text' : 'password'" autocapitalize="off" spellcheck="false" enterkeyhint="go" :disabled="Boolean(authenticatedUserId)" />
          <button type="button" :aria-pressed="showPassword" :aria-label="t('rework.account.showPassword')" @click="showPassword = !showPassword"><ReworkIcon name="eye" /></button>
        </div>
      </div>
      <div class="remember-row">
        <label class="rw-check">
          <input v-model="rememberIdentifier" type="checkbox" @change="(event) => { if (!(event.target as HTMLInputElement).checked) saveRememberedIdentifier('', false); }" />
          <span>{{ copy.remember }}</span>
        </label>
        <NuxtLink class="rw-link" :to="localePath('/account/forgot-password')">{{ copy.forgot }}</NuxtLink>
      </div>
      <button type="submit" class="rw-btn rw-btn--primary rw-btn--block submit-btn" :class="{ 'is-busy': submitting }" :disabled="submitting" :aria-busy="submitting">{{ authenticatedUserId ? completionCopy.continue : copy.submit }}</button>
    </form>
    <ReworkAccountOidcOptions purpose="login" :redirect="redirectAfterLogin" />
    <template #footer>
      <NuxtLink class="rw-link" :to="{path:localePath('/account/register'),query:{redirect:redirectAfterLogin}}">{{ copy.register }}</NuxtLink>
    </template>
  </ReworkAccountAuthFrame>
</template>

<style scoped>
/* Layout only; colours and type come from the shared form pieces (pages do not read design-system tokens). */
.remember-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 16px;
}
.auth-state-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}
.auth-state-error p {
  margin: 0;
}
</style>
