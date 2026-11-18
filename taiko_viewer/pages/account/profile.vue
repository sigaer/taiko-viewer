<script setup lang="ts">
import { computed, nextTick, onActivated, onMounted, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { UploadFile, UploadInstance, UploadRawFile } from "element-plus";
import { buildPageDescription } from "~/utils/seo";
import type { MyDonShowcaseLayout, MyDonShowcasePayload, MyDonShowcaseTitleOption, ProfilePayload } from "~/utils/rework/account";
import { PROFILE_SECTIONS, showcaseRequirementKey, showcaseScopeKey } from "~/utils/rework/account";

const developerApiV1Enabled = computed(() => accountUser.value?.developerApiV1Access === true);
const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { formatDateTime } = useViewerDateTime();
const { accountUser, fetchCurrentUser, clearAccountUser } = useAccountState();
const route = useRoute();
const nuxtApp = useNuxtApp();
await fetchCurrentUser(true);

definePageMeta({
  contentLayout: "standard",
  middleware: "account-auth",
  pageTitleKey: "account.profile",
  pageDescKey: "page.account.profile.desc",
  hidePageDescription: true,
  hidePageHeader: true,
  reworkElementPlus: true,
  navKey: "/account/profile",
  breadcrumbs: [
    { labelKey: "account.title", to: "/account/profile" },
    { labelKey: "account.profile", to: "/account/profile" }
  ]
});

useViewerSeo(() => ({
  title: t("account.profile"),
  description: buildPageDescription(t("page.account.profile.desc")),
  path: "/account/profile"
}));

// The response types (ProfilePayload, MyDonShowcase*) moved unchanged to utils/rework/account.ts (slice E1).

const myDonTick = ref(0);
const myDonErrored = ref(false);
const beta = useAnnualBeta();
const bindingInput = ref("");
const preparing = ref(false);
const confirming = ref(false);
const bindingCardRef = ref<HTMLElement | null>(null);
const bindingInputRef = ref<{ focus?: () => void } | null>(null);
const pendingBoxRef = ref<HTMLElement | null>(null);
const qqVerifyBoxRef = ref<HTMLElement | null>(null);

const revealElement = (element: HTMLElement | null, focusTarget?: HTMLElement | null) => {
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  // 可访问性：滚动后把焦点交给真实操作区，键盘/读屏用户不会停在原处。
  const focusable = focusTarget || element;
  window.setTimeout(() => {
    focusable.setAttribute("tabindex", focusable.getAttribute("tabindex") || "-1");
    focusable.focus({ preventScroll: true });
  }, 320);
};

const focusBindingForm = () => {
  beta.track("binding_entry_click");
  revealElement(bindingCardRef.value, bindingCardRef.value);
  window.setTimeout(() => bindingInputRef.value?.focus?.(), 360);
};
const switchingId = ref<number | null>(null);
const deletingId = ref<number | null>(null);
const manualLoading = ref(false);
const manualNickname = ref("");
const manualClaimCode = ref("");
const uploading = ref(false);
const removingAvatar = ref(false);
const avatarUploadRef = ref<UploadInstance>();
const avatarCropVisible = ref(false);
const avatarCropSourceUrl = ref("");
const avatarCropFileName = ref("");
const showcaseSaving = ref(false);
const myDonShowcaseSlots = ref<string[]>(Array.from({ length: 5 }, () => ""));
const myDonShowcaseLayout = ref<MyDonShowcaseLayout>("nickname");
const qqInput = ref("");
const qqPreparing = ref(false);
const qqConfirming = ref(false);
const qqRemoving = ref(false);
const qqVerifyCode = ref("");
const qqVerifyCodeResult = ref<{ expiresAt: string } | null>(null);

// Slice E1: the inline zh / ja tables moved to locales (rework.account.profile.*), same texts. The {id} / {qq} /
// {index} placeholders are passed through literally, so the handlers' .replace(...) calls are unchanged.
const PROFILE_COPY_KEYS = ["uploadAvatar","changeAvatar","resetAvatar","emailVerified","taikoVerified","verified","unverified","currentBinding","taikoIdLabel","currentTitle","createdAt","unbound","bindTitle","bindDesc","bindPlaceholder","bindInputLabel","legacyBindingNotice","manualTitle","manualDesc","manualNickname","manualCreate","manualClaimPlaceholder","manualClaim","manualStamp","cnStamp","jpStamp","manualRename","manualClaimCode","manualDetach","manualDelete","manualCreated","manualClaimed","manualCodeReady","manualActionFailed","onboardTitle","onboardDesc","onboardCta","startVerify","pendingId","pendingTitle","emptyTitle","expiresAt","confirmBinding","noBindings","currentUsing","switchCurrent","deleteBinding","myDon","myDonNeedBinding","myDonFailed","showcaseTitle","showcaseDesc","showcaseNeedBinding","showcaseNeedUserdata","showcaseEmpty","showcaseLoadFailed","showcaseSave","showcaseReset","showcaseSaveSuccess","showcaseResetSuccess","showcaseSaveFailed","showcaseMode","showcaseModeDefault","showcaseModeCustom","showcaseSelection","showcaseSelectionEmpty","showcaseOrderHint","showcaseSlot","showcasePlaceholder","showcaseClearHint","showcaseLayout","showcaseLayoutNickname","showcaseLayoutFull","showcaseLayoutFullGold","avatarUpdated","avatarUploadFailed","avatarReset","avatarDeleteFailed","avatarCropTitle","avatarCropHint","avatarCropWheelHint","avatarCropZoom","avatarCropConfirm","avatarCropLoadFailed","avatarCropFailed","prepareFailed","confirmSuccess","confirmFailed","switchSuccess","switchFailed","deleteSuccess","deleteFailed","deleteConfirmTitle","deleteConfirm","deleteConfirmButton","lastBindingTitle","lastBindingConfirm","lastBindingButton","qqTitle","qqDesc","qqPlaceholder","qqStartVerify","qqCodeReady","qqCodeHint","qqConfirmVerify","qqConfirmPlaceholder","qqConfirmButton","qqBound","qqPending","qqUnbound","qqUnbind","qqUnbindConfirm","qqPrepareFailed","qqConfirmFailed","qqConfirmSuccess","qqUnbindSuccess","qqUnbindFailed","sectionBindings","sectionSignIn","sectionIdentity","navLabel","sessionExpired","detachConfirm","deleteManualConfirm","thirdPartyLabel","thirdPartyTitle","thirdPartyDesc","thirdPartyManage","customPrefix","songPrefix","email"] as const;
type ProfileCopyKey = (typeof PROFILE_COPY_KEYS)[number];
const copy = computed(() => (void locale.value, Object.fromEntries(
  PROFILE_COPY_KEYS.map((key) => [key, t(`rework.account.profile.${key}`, { id: "{id}", qq: "{qq}", index: "{index}" })])
) as Record<ProfileCopyKey, string>));

const { data, pending, refresh } = useAsyncData<ProfilePayload>(
  "account-profile",
  () => apiFetch("/api/account/profile"),
  {
    default: () => ({
      user: {
        id: 0,
        username: "",
        email: "",
        emailVerified: false,
        avatarUrl: "/default-avatar.svg",
        createdAt: ""
      },
      bindings: [],
      currentBinding: null,
      pendingBinding: null,
      qqBinding: null,
      verificationStatus: {
        emailVerified: false,
        taikoVerified: false
      }
    })
  }
);

const profile = computed(() => data.value);

// A response belongs to the account, challenge and input that started it.
// Cancellation does not roll back a server operation that already committed.
const bindingGeneration = useState("account-binding-generation", () => 0);
type BindingAction = {
  controller: AbortController;
  context: string;
  generation: number;
  acceptsOwnGeneration: boolean;
};
let bindingAction: BindingAction | null = null;
let bindingDisposed = false;
const bindingActionContext = () => JSON.stringify([
  accountUser.value?.id,
  bindingInput.value.trim(),
  profile.value?.currentBinding?.id,
  profile.value?.currentBinding?.source,
  profile.value?.pendingBinding
]);
const cancelBindingAction = () => {
  const previous = bindingAction;
  bindingAction = null;
  previous?.controller.abort();
  preparing.value = false;
  confirming.value = false;
};
const ownsBindingAction = (action: BindingAction) =>
  !bindingDisposed && bindingAction === action &&
  action.context === bindingActionContext() && action.generation === bindingGeneration.value;
const beginBindingAction = (kind: "prepare" | "confirm") => {
  cancelBindingAction();
  const action: BindingAction = {
    controller: new AbortController(), context: bindingActionContext(),
    generation: bindingGeneration.value, acceptsOwnGeneration: false
  };
  bindingAction = action;
  (kind === "prepare" ? preparing : confirming).value = true;
  return action;
};
watch(bindingActionContext, cancelBindingAction, { flush: "sync" });
watch(bindingGeneration, (generation) => {
  const action = bindingAction;
  // useViewerApiFetch increments the generation for our own successful POST.
  if (action?.acceptsOwnGeneration && generation === action.generation + 1) {
    action.generation = generation;
    action.acceptsOwnGeneration = false;
  } else {
    cancelBindingAction();
  }
}, { flush: "sync" });
onBeforeUnmount(() => { bindingDisposed = true; cancelBindingAction(); });

let betaBindingObserver: IntersectionObserver | null = null;
onMounted(()=>{
  const stop=watch(()=>[profile.value?.pendingBinding?.taikoId,profile.value?.currentBinding?.id],async()=>{
    await nextTick();betaBindingObserver?.disconnect();
    betaBindingObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;beta.track(entry.target.classList.contains('pending-box')?'binding_verification_instruction_view':'binding_entry_impression');betaBindingObserver?.unobserve(entry.target);}},{threshold:.5});
    for(const selector of ['.bind-input-row','.pending-box']){const el=document.querySelector(selector);if(el)betaBindingObserver.observe(el);}
  },{immediate:true});
  betaBindingStop=stop;
});
let betaBindingStop: (()=>void)|null=null;
onBeforeUnmount(()=>{betaBindingObserver?.disconnect();betaBindingStop?.();});

// P2: 未绑定用户首屏要能直接看到「绑定鼓众广场 ID」这一步。
const needsBindingOnboarding = computed(
  () => Boolean(profile.value) && !profile.value?.currentBinding && !profile.value?.pendingBinding
);

// P2-B: 用户完成上一步后，下一步的主操作必须自动进入视野。
watch(
  () => profile.value?.pendingBinding?.taikoId || "",
  async (next, previous) => {
    if (!next || next === previous) return;
    await nextTick();
    revealElement(pendingBoxRef.value, pendingBoxRef.value?.querySelector("button") as HTMLElement | null);
  }
);

watch(
  () => qqVerifyCodeResult.value?.expiresAt || "",
  async (next, previous) => {
    if (!next || next === previous) return;
    await nextTick();
    revealElement(qqVerifyBoxRef.value, qqVerifyBoxRef.value?.querySelector("input") as HTMLElement | null);
  }
);
// The two payloads are independent, so they must not suspend the route in
// sequence: awaiting them one after another doubles the time the page spends
// with nothing on screen after a navigation.
const {
  data: myDonShowcaseData,
  error: myDonShowcaseError,
  pending: myDonShowcasePending,
  refresh: refreshMyDonShowcase
} = useAsyncData<MyDonShowcasePayload>(
  "account-mydon-showcase",
  () => apiFetch("/api/account/my-don/showcase"),
  {
    default: () => ({
      bindingId: null,
      taikoId: null,
      hasUserdata: false,
      isCustom: false,
      layoutMode: "nickname",
      selectedTitles: [],
      availableTitles: []
    })
  }
);
const myDonUrl = computed(() => {
  if (!profile.value?.currentBinding) return "";
  return `/api/account/my-don?t=${myDonTick.value}`;
});

const normalizeShowcaseTitleNames = (values: Array<string | null | undefined>) => {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const titleName = String(value || "").trim();
    if (!titleName || seen.has(titleName)) continue;
    seen.add(titleName);
    result.push(titleName);
  }
  return result;
};

const applyShowcaseSelection = (values: string[] | null | undefined) => {
  const next = Array.from({ length: 5 }, () => "");
  normalizeShowcaseTitleNames(values || [])
    .slice(0, 5)
    .forEach((titleName, index) => {
      next[index] = titleName;
    });
  myDonShowcaseSlots.value = next;
};

watch(
  () => [myDonShowcaseData.value?.selectedTitles, myDonShowcaseData.value?.layoutMode] as const,
  ([titles, layoutMode]) => {
    applyShowcaseSelection(titles);
    myDonShowcaseLayout.value = layoutMode || "nickname";
  },
  { immediate: true, deep: true }
);

const availableShowcaseTitles = computed(() => myDonShowcaseData.value?.availableTitles || []);
const currentShowcaseSelection = computed(() => normalizeShowcaseTitleNames(myDonShowcaseSlots.value));
const savedShowcaseSelection = computed(() => normalizeShowcaseTitleNames(myDonShowcaseData.value?.selectedTitles || []));
const showcaseTitlesDirty = computed(
  () => JSON.stringify(currentShowcaseSelection.value) !== JSON.stringify(savedShowcaseSelection.value)
);
const showcaseDirty = computed(
  () =>
    showcaseTitlesDirty.value ||
    myDonShowcaseLayout.value !== (myDonShowcaseData.value?.layoutMode || "nickname")
);
const showcaseCanReset = computed(
  () =>
    Boolean(myDonShowcaseData.value?.isCustom) ||
    currentShowcaseSelection.value.length > 0 ||
    myDonShowcaseLayout.value !== "nickname"
);

const formatShowcaseRequirement = (option: MyDonShowcaseTitleOption) =>
  `${t(`rework.account.profile.requirement.${showcaseRequirementKey(option.requirementType)}`)} · ${t(`rework.account.profile.scope.${showcaseScopeKey(option.difficultyScope)}`)}`;

const formatShowcaseOptionLabel = (option: MyDonShowcaseTitleOption) => {
  const constLabel = option.constValue > 0 ? ` · ${option.constValue.toFixed(1)}` : "";
  const sourceLabel = option.source === "custom" ? copy.value.customPrefix : "";
  const songLabel =
    option.source === "custom" && option.songNames.length > 0
      ? ` · ${copy.value.songPrefix}${option.songNames.join(" / ")}`
      : "";
  return `${sourceLabel}${option.titleName}${songLabel} · ${formatShowcaseRequirement(option)}${constLabel}`;
};

const getShowcaseSlotOptions = (slotIndex: number) => {
  const currentValue = myDonShowcaseSlots.value[slotIndex];
  const blocked = new Set(
    myDonShowcaseSlots.value
      .filter((value, index) => index !== slotIndex)
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
  return availableShowcaseTitles.value.filter(
    (option) => option.titleName === currentValue || !blocked.has(option.titleName)
  );
};

const refreshProfile = async () => {
  await Promise.all([refresh(), refreshMyDonShowcase()]);
  await fetchCurrentUser(true);
  myDonTick.value += 1;
  myDonErrored.value = false;
};

const persistMyDonShowcase = async (
  titleNames: string[] | undefined,
  layoutMode: MyDonShowcaseLayout,
  successMessage: string
) => {
  showcaseSaving.value = true;
  try {
    const body: { titleNames?: string[]; layoutMode: MyDonShowcaseLayout } = { layoutMode };
    if (titleNames !== undefined) body.titleNames = titleNames;
    const payload = await apiFetch<MyDonShowcasePayload>("/api/account/my-don/showcase", {
      method: "POST",
      body
    });
    myDonShowcaseData.value = payload;
    applyShowcaseSelection(payload.selectedTitles);
    myDonShowcaseLayout.value = payload.layoutMode;
    ElMessage.success(successMessage);
    myDonTick.value += 1;
    myDonErrored.value = false;
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.showcaseSaveFailed);
  } finally {
    showcaseSaving.value = false;
  }
};

const saveMyDonShowcase = async () => {
  if (showcaseSaving.value) return;
  await persistMyDonShowcase(
    showcaseTitlesDirty.value ? currentShowcaseSelection.value : undefined,
    myDonShowcaseLayout.value,
    copy.value.showcaseSaveSuccess
  );
};

const resetMyDonShowcase = async () => {
  if (showcaseSaving.value) return;
  await persistMyDonShowcase([], "nickname", copy.value.showcaseResetSuccess);
};

const clearAvatarSelection = () => {
  if (avatarCropSourceUrl.value) {
    URL.revokeObjectURL(avatarCropSourceUrl.value);
  }
  avatarCropSourceUrl.value = "";
  avatarCropFileName.value = "";
  avatarUploadRef.value?.clearFiles();
};

const uploadAvatarFile = async (file: File) => {
  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append("avatar", file);
    await apiFetch("/api/account/avatar", {
      method: "POST",
      body: formData
    });
    ElMessage.success(copy.value.avatarUpdated);
    await refreshProfile();
    return true;
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.avatarUploadFailed);
    return false;
  } finally {
    uploading.value = false;
  }
};

const handleAvatarSelect = (file: UploadFile) => {
  const raw = file.raw as UploadRawFile | undefined;
  if (!raw) {
    avatarUploadRef.value?.clearFiles();
    return;
  }
  clearAvatarSelection();
  avatarCropSourceUrl.value = URL.createObjectURL(raw);
  avatarCropFileName.value = raw.name || "avatar";
  avatarCropVisible.value = true;
};

const handleAvatarCropConfirm = async (payload: { blob: Blob; fileName: string }) => {
  const croppedFile = new File([payload.blob], payload.fileName, {
    type: payload.blob.type || "image/webp"
  });
  const uploaded = await uploadAvatarFile(croppedFile);
  if (!uploaded) return;
  avatarCropVisible.value = false;
};

const handleAvatarCropError = (message: string) => {
  ElMessage.error(message || copy.value.avatarCropFailed);
  avatarCropVisible.value = false;
};

const handleAvatarCropClosed = () => {
  clearAvatarSelection();
};

const removeAvatar = async () => {
  removingAvatar.value = true;
  try {
    await apiFetch("/api/account/avatar", {
      method: "DELETE"
    });
    ElMessage.success(copy.value.avatarReset);
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.avatarDeleteFailed);
  } finally {
    removingAvatar.value = false;
  }
};

const runManualAction = async (body: Record<string, unknown>) => {
  manualLoading.value = true;
  try {
    return await apiFetch<Record<string, any>>("/api/account/manual", {
      method: "POST",
      body
    });
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.manualActionFailed);
    return null;
  } finally {
    manualLoading.value = false;
  }
};

const createManual = async () => {
  if (!manualNickname.value.trim()) return;
  const result = await runManualAction({ action: "create", nickname: manualNickname.value.trim() });
  if (!result) return;
  manualNickname.value = "";
  ElMessage.success(copy.value.manualCreated);
  await refreshProfile();
};

const claimManual = async () => {
  if (!manualClaimCode.value.trim()) return;
  const result = await runManualAction({ action: "claim", code: manualClaimCode.value.trim() });
  if (!result) return;
  manualClaimCode.value = "";
  ElMessage.success(copy.value.manualClaimed);
  await refreshProfile();
};

const renameManual = async (binding: ProfilePayload["bindings"][number]) => {
  try {
    const { value } = await ElMessageBox.prompt(copy.value.manualNickname, copy.value.manualRename, {
      inputValue: binding.displayName,
      inputValidator: (input) => Boolean(String(input || "").trim())
    });
    const result = await runManualAction({
      action: "rename",
      taikoId: binding.taikoId,
      nickname: value
    });
    if (result) await refreshProfile();
  } catch {
    // User cancelled.
  }
};

const showManualClaimCode = async (binding: ProfilePayload["bindings"][number]) => {
  const result = await runManualAction({ action: "claim-code", taikoId: binding.taikoId });
  if (!result?.code) return;
  await ElMessageBox.alert(String(result.code), copy.value.manualCodeReady, {
    confirmButtonText: t("common.confirm")
  });
};

const detachManual = async (binding: ProfilePayload["bindings"][number]) => {
  try {
    await ElMessageBox.confirm(
      copy.value.detachConfirm,
      copy.value.manualDetach,
      { type: "warning" }
    );
  } catch {
    return;
  }
  const result = await runManualAction({ action: "detach", taikoId: binding.taikoId });
  if (result) await refreshProfile();
};

const permanentlyDeleteManual = async (binding: ProfilePayload["bindings"][number]) => {
  try {
    await ElMessageBox.confirm(
      copy.value.deleteManualConfirm,
      copy.value.manualDelete,
      {
        type: "error",
        confirmButtonText: copy.value.manualDelete
      }
    );
  } catch {
    return;
  }
  const result = await runManualAction({
    action: "delete-account",
    taikoId: binding.taikoId,
    confirmed: true
  });
  if (result) await refreshProfile();
};

const prepareBinding = async () => {
  if (!bindingInput.value.trim() || preparing.value) return;
  beta.track("binding_start");
  beta.track("binding_id_submitted");
  const action = beginBindingAction("prepare");
  try {
    const result = await apiFetch<{ message: string }>("/api/account/bindings/prepare", {
      method: "POST",
      body: { taikoId: bindingInput.value.trim() },
      signal: action.controller.signal,
      onResponse: ({ response }) => {
        action.acceptsOwnGeneration = response.ok && ownsBindingAction(action);
      }
    });
    if (!ownsBindingAction(action)) return;
    ElMessage.success(result.message);
    await refreshProfile();
  } catch (error: any) {
    if (!ownsBindingAction(action)) return;
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.prepareFailed);
  } finally {
    if (bindingAction === action) cancelBindingAction();
  }
};

const confirmBinding = async (taikoId?: string | null) => {
  const target = taikoId || profile.value?.pendingBinding?.taikoId;
  if (!target || confirming.value) return;
  beta.track("binding_verify_start");
  const action = beginBindingAction("confirm");
  try {
    await apiFetch("/api/account/bindings/confirm", {
      method: "POST",
      body: { taikoId: target },
      signal: action.controller.signal,
      onResponse: ({ response }) => {
        action.acceptsOwnGeneration = response.ok && ownsBindingAction(action);
      }
    });
    if (!ownsBindingAction(action)) return;
    ElMessage.success(copy.value.confirmSuccess);
    bindingInput.value = "";
    await refreshProfile();
  } catch (error: any) {
    if (!ownsBindingAction(action)) return;
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.confirmFailed);
    if ([400, 409].includes(error?.statusCode || error?.status)) {
      // Keep unchanged-title retries, but discard expired/replaced challenges
      // according to the authoritative profile rather than a guessed error kind.
      await refreshProfile().catch(() => {});
    }
  } finally {
    if (bindingAction === action) cancelBindingAction();
  }
};

const switchBinding = async (bindingId: number) => {
  const binding = profile.value?.bindings.find((item) => item.id === bindingId);
  if (binding?.isCurrent || switchingId.value === bindingId) return;
  switchingId.value = bindingId;
  try {
    await apiFetch("/api/account/bindings/current", {
      method: "POST",
      body: { bindingId }
    });
    ElMessage.success(copy.value.switchSuccess);
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.switchFailed);
  } finally {
    switchingId.value = null;
  }
};

const deleteBinding = async (binding: NonNullable<ProfilePayload["bindings"]>[number]) => {
  if (deletingId.value === binding.id) return;

  const isLastBinding = (profile.value?.bindings.length || 0) <= 1;
  try {
    await ElMessageBox.confirm(
      copy.value.deleteConfirm.replace("{id}", binding.taikoId),
      copy.value.deleteConfirmTitle,
      {
      type: "warning",
      confirmButtonText: copy.value.deleteConfirmButton,
      cancelButtonText: t("common.cancel")
    });

    if (isLastBinding) {
      await ElMessageBox.confirm(
        copy.value.lastBindingConfirm,
        copy.value.lastBindingTitle,
        {
          type: "error",
          confirmButtonText: copy.value.lastBindingButton,
          cancelButtonText: t("common.cancel")
        }
      );
    }
  } catch {
    return;
  }

  deletingId.value = binding.id;
  try {
    await apiFetch("/api/account/bindings/remove", {
      method: "POST",
      body: {
        bindingId: binding.id,
        force: isLastBinding
      }
    });
    ElMessage.success(copy.value.deleteSuccess);
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.deleteFailed);
  } finally {
    deletingId.value = null;
  }
};

const prepareQqBinding = async () => {
  if (!qqInput.value.trim() || qqPreparing.value) return;
  qqPreparing.value = true;
  try {
    const result = await apiFetch<{ expiresAt: string; message: string }>("/api/account/qq/prepare", {
      method: "POST",
      body: { qqNumber: qqInput.value.trim() }
    });
    qqVerifyCodeResult.value = { expiresAt: result.expiresAt };
    qqVerifyCode.value = "";
    ElMessage.success(result.message);
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.qqPrepareFailed);
  } finally {
    qqPreparing.value = false;
  }
};

const confirmQqBinding = async () => {
  if (!qqVerifyCode.value.trim() || qqConfirming.value) return;
  qqConfirming.value = true;
  try {
    const result = await apiFetch<{ message: string }>("/api/account/qq/confirm", {
      method: "POST",
      body: { code: qqVerifyCode.value.trim() }
    });
    ElMessage.success(result.message);
    qqVerifyCode.value = "";
    qqVerifyCodeResult.value = null;
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.qqConfirmFailed);
  } finally {
    qqConfirming.value = false;
  }
};

const removeQqBinding = async () => {
  if (qqRemoving.value) return;
  const qqNumber = profile.value?.qqBinding?.qqNumber;
  try {
    await ElMessageBox.confirm(
      copy.value.qqUnbindConfirm.replace("{qq}", qqNumber || ""),
      copy.value.qqUnbind,
      { type: "warning", confirmButtonText: copy.value.qqUnbind, cancelButtonText: t("common.cancel") }
    );
  } catch {
    return;
  }
  qqRemoving.value = true;
  try {
    const result = await apiFetch<{ message: string }>("/api/account/qq/remove", {
      method: "POST"
    });
    ElMessage.success(result.message);
    qqVerifyCodeResult.value = null;
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.qqUnbindFailed);
  } finally {
    qqRemoving.value = false;
  }
};

// ---------- Slice E1: presentation ----------
// The section components receive the page's scroll / focus targets as function refs (the refs above are unchanged).
const setBindingCard = (el: Element | null) => { bindingCardRef.value = el as HTMLElement | null; };
const setBindingInput = (el: Element | null) => { bindingInputRef.value = el as HTMLInputElement | null; };
const setPendingBox = (el: Element | null) => { pendingBoxRef.value = el as HTMLElement | null; };
const setQqVerifyBox = (el: Element | null) => { qqVerifyBoxRef.value = el as HTMLElement | null; };
const setShowcaseSlot = (index: number, value: string) => { myDonShowcaseSlots.value[index] = value; };

// States of the profile read. Its error ref is nuxtApp.payload._errors[key] (the ref useAsyncData returns; the
// destructuring above stays as it was): a 401 means the session ended while the page was open → sign in again and
// come back here; any other failure without data → retry the same read.
const profileError = computed(() => (nuxtApp.payload._errors as Record<string, any>)?.["account-profile"] ?? null);
const profileErrorStatus = computed(() => Number(profileError.value?.statusCode ?? profileError.value?.status ?? 0));
const sessionExpired = computed(() => !pending.value && profileErrorStatus.value === 401);
const profileFailed = computed(() => !pending.value && Boolean(profileError.value) && !profile.value?.user.id);
// After a 401 the shell's cached account may still name the old user, and the sign-in page's guest middleware would
// send the visitor straight back here. Re-read the session (the existing /api/account/auth/me read) so the cached
// state follows the server before the visitor follows the sign-in link.
watch(sessionExpired, (expired) => { if (expired) void fetchCurrentUser(true).catch(() => {}); });
// The page is kept alive: coming back after signing in again (or after a failed read) re-reads with the page's own
// refreshProfile(), instead of showing the cached sign-in prompt / failure. A successful page is not re-read (as before).
onActivated(() => { if (sessionExpired.value || profileFailed.value) void refreshProfile().catch(() => {}); });

const profileSections = computed(() => [
  { id: PROFILE_SECTIONS.identity, label: copy.value.sectionIdentity },
  { id: PROFILE_SECTIONS.bindings, label: copy.value.sectionBindings },
  { id: PROFILE_SECTIONS.signIn, label: copy.value.sectionSignIn },
  { id: PROFILE_SECTIONS.myDon, label: copy.value.myDon },
  ...(developerApiV1Enabled.value ? [{ id: PROFILE_SECTIONS.apps, label: copy.value.thirdPartyLabel }] : [])
]);

// An external-account error returns here as ?oidc_error=… (the server's contract); its message is in the sign-in
// section, so the page opens there once the profile is shown.
onMounted(() => {
  if (!route.query.oidc_error) return;
  let done = false;
  watch(() => profile.value?.user.id, async (id) => {
    if (done || !id) return;
    done = true;
    await nextTick();
    document.getElementById(PROFILE_SECTIONS.signIn)?.scrollIntoView({ block: "start" });
  }, { immediate: true });
});

// Signing out: the request and the steps of the former sidebar (components/SidebarNav.vue handleLogout), which the
// Stage 1 shell no longer shows. A failure is ignored there too.
const signingOut = ref(false);
const signOut = async () => {
  if (signingOut.value) return;
  signingOut.value = true;
  try {
    await apiFetch("/api/account/auth/logout", { method: "POST" });
    clearAccountUser();
    await navigateTo(localePath("/account/login"));
  } catch {
    // Ignored, as in the former sidebar shortcut.
  } finally {
    signingOut.value = false;
  }
};
</script>

<template>
  <div class="profile-page">
    <template v-if="pending && !profile?.user.id">
      <ReworkPageHeader :title="t('account.profile')" />
      <ReworkState kind="loading" :lines="8" />
    </template>

    <template v-else-if="sessionExpired">
      <ReworkPageHeader :title="t('account.profile')" />
      <ReworkGate need="login" :title="copy.sessionExpired" :register="false" />
    </template>

    <template v-else-if="profileFailed">
      <ReworkPageHeader :title="t('account.profile')" />
      <ReworkState kind="failed" @retry="refresh()" />
    </template>

    <template v-else-if="profile">
      <ReworkAccountProfileLayout :sections="profileSections" :label="copy.navLabel">
        <template #identity>
          <ReworkAccountProfileIdentity class="profile-main-card" :profile="profile">
            <template #avatar-actions>
              <el-upload
                ref="avatarUploadRef"
                class="avatar-upload"
                :show-file-list="false"
                :auto-upload="false"
                :disabled="uploading"
                accept="image/png,image/jpeg,image/webp,image/gif"
                :on-change="handleAvatarSelect"
              >
                <button type="button" class="rw-btn rw-btn--sm rw-btn--block avatar-upload-button" :class="{ 'is-busy': uploading }" :disabled="uploading" :aria-busy="uploading">{{ copy.changeAvatar }}</button>
              </el-upload>
              <button type="button" class="rw-btn rw-btn--sm rw-btn--ghost rw-btn--block avatar-reset-button" :class="{ 'is-busy': removingAvatar }" :disabled="removingAvatar" :aria-busy="removingAvatar" @click="removeAvatar">{{ copy.resetAvatar }}</button>
            </template>
            <template #extra>
              <AnnualBetaContinue class="profile-annual" />
            </template>
          </ReworkAccountProfileIdentity>
        </template>

        <ReworkAccountProfileSection :id="PROFILE_SECTIONS.bindings" :title="copy.sectionBindings">
          <template #meta>
            <span>{{ copy.taikoVerified }}</span>
            <span class="rw-tag" :class="profile.verificationStatus.taikoVerified ? 'rw-tag--ok' : 'rw-tag--warn'">{{ profile.verificationStatus.taikoVerified ? copy.verified : copy.unverified }}</span>
          </template>
          <ReworkAccountProfileBindings
            v-model:binding-input="bindingInput"
            v-model:manual-nickname="manualNickname"
            v-model:manual-claim-code="manualClaimCode"
            :profile="profile"
            :needs-onboarding="needsBindingOnboarding"
            :preparing="preparing"
            :confirming="confirming"
            :switching-id="switchingId"
            :deleting-id="deletingId"
            :manual-loading="manualLoading"
            :set-card="setBindingCard"
            :set-input="setBindingInput"
            :set-pending-box="setPendingBox"
            @onboard="focusBindingForm"
            @input-focus="beta.track('binding_start')"
            @prepare="prepareBinding"
            @confirm="confirmBinding()"
            @switch="switchBinding"
            @remove="deleteBinding"
            @rename="renameManual"
            @claim-code="showManualClaimCode"
            @detach="detachManual"
            @delete-manual="permanentlyDeleteManual"
            @create-manual="createManual"
            @claim-manual="claimManual"
          />
        </ReworkAccountProfileSection>

        <ReworkAccountProfileSection :id="PROFILE_SECTIONS.signIn" :title="copy.sectionSignIn">
          <ReworkAccountProfileSignIn :email="profile.user.email" :email-verified="profile.verificationStatus.emailVerified" :signing-out="signingOut" @sign-out="signOut">
            <ReworkAccountOidcOptions class="profile-oidc-card" purpose="link" :redirect="localePath('/account/profile')" />
            <ReworkAccountProfileQq
              v-model:qq-input="qqInput"
              v-model:verify-code="qqVerifyCode"
              :binding="profile.qqBinding"
              :code-result="qqVerifyCodeResult"
              :preparing="qqPreparing"
              :confirming="qqConfirming"
              :removing="qqRemoving"
              :set-verify-box="setQqVerifyBox"
              @prepare="prepareQqBinding"
              @confirm="confirmQqBinding"
              @remove="removeQqBinding"
            />
          </ReworkAccountProfileSignIn>
        </ReworkAccountProfileSection>

        <ReworkAccountProfileSection :id="PROFILE_SECTIONS.myDon" :title="copy.myDon">
          <ReworkAccountProfileMyDon
            :has-binding="Boolean(profile.currentBinding)"
            :showcase="myDonShowcaseData"
            :pending="myDonShowcasePending"
            :failed="Boolean(myDonShowcaseError)"
            :available-count="availableShowcaseTitles.length"
            :slots="myDonShowcaseSlots"
            :layout="myDonShowcaseLayout"
            :selection="currentShowcaseSelection"
            :saving="showcaseSaving"
            :dirty="showcaseDirty"
            :can-reset="showcaseCanReset"
            :options-for="getShowcaseSlotOptions"
            :option-label="formatShowcaseOptionLabel"
            :image-url="myDonUrl"
            :image-failed="myDonErrored"
            @update:slot="setShowcaseSlot"
            @update:layout="(value) => (myDonShowcaseLayout = value)"
            @save="saveMyDonShowcase"
            @reset="resetMyDonShowcase"
            @retry="refreshMyDonShowcase()"
            @image-error="myDonErrored = true"
          />
        </ReworkAccountProfileSection>

        <ReworkAccountProfileSection v-if="developerApiV1Enabled" :id="PROFILE_SECTIONS.apps" class="third-party-settings" :title="copy.thirdPartyTitle">
          <p class="third-party-settings__desc">{{ copy.thirdPartyDesc }}</p>
          <NuxtLink class="rw-btn third-party-settings__link" :to="localePath('/account/developer/grants')">{{ copy.thirdPartyManage }}</NuxtLink>
        </ReworkAccountProfileSection>
      </ReworkAccountProfileLayout>

      <AccountAvatarCropperDialog
        v-if="avatarCropVisible || avatarCropSourceUrl"
        v-model="avatarCropVisible"
        :source-url="avatarCropSourceUrl"
        :file-name="avatarCropFileName"
        :loading="uploading"
        :copy="{
          title: copy.avatarCropTitle,
          hint: copy.avatarCropHint,
          wheelHint: copy.avatarCropWheelHint,
          zoom: copy.avatarCropZoom,
          cancel: t('common.cancel'),
          confirm: copy.avatarCropConfirm,
          imageLoadFailed: copy.avatarCropLoadFailed,
          cropFailed: copy.avatarCropFailed
        }"
        @confirm="handleAvatarCropConfirm"
        @error="handleAvatarCropError"
        @closed="handleAvatarCropClosed"
      />
    </template>
  </div>
</template>

<style scoped>
/* Layout only; colours and type come from the section components and the shared pieces (pages do not read
   design-system tokens). */
.profile-page {
  width: 100%;
  min-width: 0;
}
.avatar-upload,
.avatar-upload :deep(.el-upload) {
  display: block;
  width: 100%;
}
.third-party-settings__desc {
  margin: 0;
  line-height: 1.65;
}
.third-party-settings__link {
  align-self: flex-start;
}
</style>
