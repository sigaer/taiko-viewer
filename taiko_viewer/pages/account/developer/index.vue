<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import DeveloperApiGuide from "~/components/rework/developer/ApiGuide.vue";
import { buildPageDescription } from "~/utils/seo";
import type { DeveloperPayload } from "~/utils/rework/developer";


const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { formatDateTime } = useViewerDateTime();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser(true);

definePageMeta({
  contentLayout: "reading",
  hidePageHeader: true,
  middleware: "account-auth",
  pageTitleKey: "account.developer",
  pageDescKey: "page.account.developer.desc",
  navKey: "/account/developer",
  breadcrumbs: [
    { labelKey: "account.title", to: "/account/profile" },
    { labelKey: "account.developer", to: "/account/developer" }
  ]
});

useViewerSeo(() => ({
  title: t("account.developer"),
  description: buildPageDescription(t("page.account.developer.desc")),
  path: "/account/developer"
}));

const form = ref({
  reason: "",
  replyEmail: accountUser.value?.email || ""
});
const imageFiles = ref<File[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const submitting = ref(false);
// Slice E2 (presentation): which field the last validation stopped at (the toast stays).
const applyError = ref<{ field: "reason" | "replyEmail"; message: string } | null>(null);

// Slice E2: the inline zh / ja table moved to locales (rework.account.developer.*), same texts; placeholders pass through literally.
const DEVELOPER_COPY_KEYS = ["title", "intro", "currentStatus", "notApplied", "tokenMask", "notIssued", "lastUsed", "reviewLink", "submitTitle", "submitDesc", "replyEmail", "replyEmailPlaceholder", "reason", "reasonPlaceholder", "images", "chooseImages", "selectedImages", "noImages", "submit", "disabledSubmit", "stateTitle", "noApplication", "submittedAt", "reviewFeedback", "history", "noHistory", "needReason", "needEmail", "submitSuccess", "submitFailed"] as const;
const copy = computed(() => (void locale.value, Object.fromEntries(
  DEVELOPER_COPY_KEYS.map((key) => [key, t(`rework.account.developer.${key}`, { count: "{count}" })])
) as Record<(typeof DEVELOPER_COPY_KEYS)[number], string>));

const { data, pending, error: readError, refresh } = useForumResource<DeveloperPayload>(
  "account-developer", () => apiFetch("/api/account/developer"), { enabled: () => Boolean(accountUser.value) }
);
const actionScope = useAccountPageScope(() => {
  submitting.value = false; imageFiles.value = []; form.value = {reason: "", replyEmail: accountUser.value?.email || ""}; applyError.value = null;
  if (fileInput.value) fileInput.value.value = "";
});

const developerState = computed(() => data.value);
const currentStatus = computed(() => developerState.value?.currentApplication?.status || "");
const canSubmitApplication = computed(() => Boolean(data.value) && !pending.value && !readError.value && !["pending", "approved"].includes(currentStatus.value));

const triggerImageInput = () => {
  fileInput.value?.click();
};

const handleImageChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = Array.from(target.files || []);
  imageFiles.value = files.slice(0, 4);
};

const submitApplication = async () => {
  if (submitting.value || !canSubmitApplication.value) return;
  if (!form.value.reason.trim()) {
    ElMessage.warning(copy.value.needReason);
    applyError.value = { field: "reason", message: copy.value.needReason };
    return;
  }
  if (!form.value.replyEmail.trim()) {
    ElMessage.warning(copy.value.needEmail);
    applyError.value = { field: "replyEmail", message: copy.value.needEmail };
    return;
  }
  applyError.value = null;
  const ticket = actionScope.capture();
  submitting.value = true;
  try {
    const body = new FormData();
    body.append("reason", form.value.reason.trim());
    body.append("replyEmail", form.value.replyEmail.trim());
    for (const file of imageFiles.value) {
      body.append("images", file);
    }
    await apiFetch("/api/account/developer/apply", {
      method: "POST",
      body
    });
    if (!actionScope.current(ticket)) return;
    ElMessage.success(copy.value.submitSuccess);
    imageFiles.value = [];
    if (fileInput.value) fileInput.value.value = "";
    await refresh();
  } catch (error: any) {
    if (!actionScope.current(ticket)) return;
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.submitFailed);
    // A notification failure may follow a persisted application. Re-read status.
    await refresh();
  } finally {
    if (actionScope.current(ticket)) submitting.value = false;
  }
};
</script>

<template>
  <div class="developer-page rw-stack">
    <ReworkPageHeader :title="copy.title">
      <p class="rw-lead">{{ copy.intro }}</p>
    </ReworkPageHeader>

    <ReworkState v-if="pending" kind="loading" :lines="6" />
    <ReworkState v-else-if="readError" kind="failed" class="entry-read-error" :text="readError" @retry="refresh" />
    <ReworkDeveloperStatus v-else-if="developerState" :state="developerState" />

    <!-- Keep public examples mounted: tearing down ElTabs during KeepAlive deactivation corrupts pane ownership. -->
    <div :hidden="pending || Boolean(readError) || !developerState">
      <DeveloperApiGuide
        :locale="locale"
        :application-status="currentStatus"
        :token-active="developerState?.token?.status === 'active'"
      />
    </div>

    <template v-if="!pending && !readError && developerState">
      <ReworkDeveloperApplyForm
        v-if="canSubmitApplication"
        v-model:reply-email="form.replyEmail"
        v-model:reason="form.reason"
        :files="imageFiles"
        :can-submit="canSubmitApplication"
        :submitting="submitting"
        :error="applyError"
        :file-input-ref="(el: Element | null) => (fileInput = el as HTMLInputElement | null)"
        @choose="triggerImageInput"
        @change="handleImageChange"
        @submit="submitApplication"
      />
      <ReworkDeveloperApplications :state="developerState" />
    </template>
  </div>
</template>
