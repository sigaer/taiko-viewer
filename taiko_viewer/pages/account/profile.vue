<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { UploadFile, UploadInstance, UploadRawFile } from "element-plus";
import { buildPageDescription } from "~/utils/seo";

const developerApiV1Enabled = computed(() => accountUser.value?.developerApiV1Access === true);
const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { formatDateTime } = useViewerDateTime();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser(true);

definePageMeta({
  contentLayout: "reading",
  middleware: "account-auth",
  pageTitleKey: "account.profile",
  pageDescKey: "page.account.profile.desc",
  hidePageDescription: true,
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

type QqBindingPayload = {
  qqNumber: string;
  status: "pending" | "active" | "removed";
  verifiedAt: string | null;
  createdAt: string;
} | null;

type ProfilePayload = {
  user: {
    id: number;
    username: string;
    email: string;
    emailVerified: boolean;
    avatarUrl: string;
    createdAt: string;
  };
  bindings: Array<{
    id: number;
    taikoId: string;
    source: "wahlap" | "hiroba" | "manual";
    displayName: string;
    isManual: boolean;
    canExternalSync: boolean;
    isCurrent: boolean;
    verifiedTitle: string | null;
    verifiedTitleplateId: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
  currentBinding: {
    id: number;
    taikoId: string;
    source: "wahlap" | "hiroba" | "manual";
    displayName: string;
    isManual: boolean;
    canExternalSync: boolean;
    isCurrent: boolean;
    verifiedTitle: string | null;
    verifiedTitleplateId: number | null;
    currentTitle?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  pendingBinding: {
    taikoId: string;
    originalTitle: string;
    originalTitleplateId: number;
    expiresAt: string;
  } | null;
  qqBinding: QqBindingPayload;
  verificationStatus: {
    emailVerified: boolean;
    taikoVerified: boolean;
  };
};

type MyDonShowcaseTitleOption = {
  titleName: string;
  plateId: number;
  requirementType: string;
  difficultyScope: string;
  conditionText: string;
  songNames: string[];
  songIds: number[];
  constValue: number;
  isMultiSong: boolean;
  source: "official" | "custom";
  customTitleId: number | null;
  difficultyLevel: number | null;
  plateStyle: "silver" | "gold" | "rainbow" | null;
};

type MyDonShowcaseLayout = "nickname" | "full" | "full_gold";

type MyDonShowcasePayload = {
  bindingId: number | null;
  taikoId: string | null;
  hasUserdata: boolean;
  isCustom: boolean;
  layoutMode: MyDonShowcaseLayout;
  selectedTitles: string[];
  availableTitles: MyDonShowcaseTitleOption[];
};

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

const copy = computed(() =>
  locale.value === "ja"
    ? {
        uploadAvatar: "アバターをアップロード",
        changeAvatar: "アバターを変更",
        resetAvatar: "デフォルトに戻す",
        emailVerified: "メール認証",
        taikoVerified: "ドンダーひろば ID 認証",
        verified: "認証済み",
        unverified: "未認証",
        currentBinding: "現在の連携 ID",
        taikoIdLabel: "ドンダー ID",
        currentTitle: "現在の称号",
        createdAt: "登録日時",
        unbound: "未連携",
        bindTitle: "ドンダーひろば ID を連携",
        bindDesc: "新しい ID を入力すると現在の称号を記録します。称号変更後に確認すると連携が完了します。",
        bindPlaceholder: "ドンダーひろば ID を入力",
        manualTitle: "手動スコアアカウント",
        manualDesc: "外部サービスと連携せず、Viewer と Bot から成績を手入力できます。",
        manualNickname: "ニックネーム",
        manualCreate: "空アカウントを作成",
        manualClaimPlaceholder: "8 桁の引き継ぎコード",
        manualClaim: "手動アカウントを引き継ぐ",
        manualStamp: "手動",
        cnStamp: "CN",
        jpStamp: "JP",
        manualRename: "名前変更",
        manualClaimCode: "引き継ぎコード",
        manualDetach: "この端末から解除",
        manualDelete: "完全に削除",
        manualCreated: "手動アカウントを作成しました",
        manualClaimed: "手動アカウントを引き継ぎました",
        manualCodeReady: "引き継ぎコード（10 分・1 回のみ）",
        manualActionFailed: "手動アカウントの操作に失敗しました",
        onboardTitle: "鼓衆広場 ID がまだ未登録です",
        onboardDesc: "登録すると成績・年間まとめ・称号が同期されます。",
        onboardCta: "今すぐ登録",
        startVerify: "認証開始",
        pendingId: "確認待ち ID",
        pendingTitle: "記録した称号",
        emptyTitle: "（空）",
        expiresAt: "有効期限",
        confirmBinding: "称号変更済み。今すぐ確認",
        noBindings: "認証済みのドンダーひろば ID はまだありません",
        currentUsing: "現在使用中",
        switchCurrent: "現在の ID に切り替え",
        deleteBinding: "連携を削除",
        myDon: "マイドン",
        myDonNeedBinding: "先にドンダーひろば ID を連携してください",
        myDonFailed: "マイドンの生成に失敗しました。しばらくしてから再試行してください。",
        showcaseTitle: "マイドン称号展示",
        showcaseDesc:
          "現在の成績から推定できる楽曲称号の範囲内で、表示する 5 枠の並びを手動指定できます。保存後は既定の優先度順ではなく、ここで選んだ順序を優先して表示します。",
        showcaseNeedBinding: "先にドンダーひろば ID を連携してください",
        showcaseNeedUserdata: "現在の連携 ID にローカル成績データがありません。先に同期または更新してください。",
        showcaseEmpty: "現在の成績から選べる楽曲称号がありません",
        showcaseLoadFailed: "マイドン称号候補の読み込みに失敗しました。しばらくしてから再試行してください。",
        showcaseSave: "自定义を保存",
        showcaseReset: "既定の表示に戻す",
        showcaseSaveSuccess: "マイドン称号表示を更新しました",
        showcaseResetSuccess: "マイドン称号表示を既定に戻しました",
        showcaseSaveFailed: "マイドン称号表示の保存に失敗しました",
        showcaseMode: "現在の表示モード",
        showcaseModeDefault: "既定の自動表示",
        showcaseModeCustom: "自定义順を使用中",
        showcaseSelection: "現在の自定义順",
        showcaseSelectionEmpty: "未設定",
        showcaseOrderHint: "上から順に表示されます。未選択の枠はスキップされます。",
        showcaseSlot: "枠 {index}",
        showcasePlaceholder: "称号を選択",
        showcaseClearHint: "すべて解除すると既定の並びに戻ります。",
        showcaseLayout: "称号の表示構成",
        showcaseLayoutNickname: "ニックネーム表示版",
        showcaseLayoutFull: "FULL称号版",
        showcaseLayoutFullGold: "FULL燦然ゴールド版",
        avatarUpdated: "アバターを更新しました",
        avatarUploadFailed: "アバター更新に失敗しました",
        avatarReset: "アバターをデフォルトに戻しました",
        avatarDeleteFailed: "アバター削除に失敗しました",
        avatarCropTitle: "アバターを調整",
        avatarCropHint: "画像をドラッグして表示位置を調整できます。",
        avatarCropWheelHint: "スライダーまたはマウスホイールで拡大率を変更できます。",
        avatarCropZoom: "拡大率",
        avatarCropConfirm: "この内容で保存",
        avatarCropLoadFailed: "画像の読み込みに失敗しました。別の画像を選択してください。",
        avatarCropFailed: "アバターの切り抜きに失敗しました",
        prepareFailed: "連携認証の開始に失敗しました",
        confirmSuccess: "連携完了。現在の ID を切り替えました",
        confirmFailed: "連携確認に失敗しました",
        switchSuccess: "現在の連携 ID を切り替えました",
        switchFailed: "連携切り替えに失敗しました",
        deleteSuccess: "連携を削除しました",
        deleteFailed: "連携削除に失敗しました",
        deleteConfirmTitle: "連携削除",
        deleteConfirm: "ドンダーひろば ID {id} の連携を削除しますか？",
        deleteConfirmButton: "削除",
        lastBindingTitle: "再確認",
        lastBindingConfirm: "これは最後のドンダーひろば ID です。削除すると現在の連携、マイドン、楽曲データ入口が未連携になります。削除しますか？",
        lastBindingButton: "最後の連携を削除",
        qqTitle: "QQ 連携",
        qqDesc: "QQ メールで本人確認します。過去の Bot 連携がある場合はドンダー ID を移行します。",
        qqPlaceholder: "QQ 番号を入力",
        qqStartVerify: "認証コードを取得",
        qqCodeReady: "認証コードを QQ メールに送信しました（10 分間有効）。",
        qqCodeHint: "QQ メールを確認し、6 桁の認証コードを入力してください。",
        qqConfirmVerify: "認証コードを入力して確認",
        qqConfirmPlaceholder: "6 桁の認証コード",
        qqConfirmButton: "確認",
        qqBound: "連携済み",
        qqPending: "確認待ち",
        qqUnbound: "未連携",
        qqUnbind: "連携解除",
        qqUnbindConfirm: "QQ {qq} の連携を解除しますか？",
        qqPrepareFailed: "QQ 連携の開始に失敗しました",
        qqConfirmFailed: "QQ 連携の確認に失敗しました",
        qqConfirmSuccess: "QQ 連携が完了しました",
        qqUnbindSuccess: "QQ 連携を解除しました",
        qqUnbindFailed: "QQ 連携の解除に失敗しました"
      }
    : {
        uploadAvatar: "上传头像",
        changeAvatar: "更换头像",
        resetAvatar: "恢复默认",
        emailVerified: "邮箱认证",
        taikoVerified: "鼓众 ID 认证",
        verified: "已验证",
        unverified: "未验证",
        currentBinding: "当前绑定 ID",
        taikoIdLabel: "鼓众 ID",
        currentTitle: "当前称号",
        createdAt: "注册时间",
        unbound: "未绑定",
        bindTitle: "绑定鼓众广场 ID",
        bindDesc: "输入新的鼓众 ID 后，系统会记录你当前的称号，修改称号后再确认即可完成绑定。",
        bindPlaceholder: "输入鼓众广场 ID",
        manualTitle: "手动成绩账号",
        manualDesc: "不关联鼓众广场或 Hiroba，可在 viewer 与 bot 中自行录入成绩。",
        manualNickname: "账号昵称",
        manualCreate: "新建空白账号",
        manualClaimPlaceholder: "输入 8 位一次性认领码",
        manualClaim: "认领手动账号",
        manualStamp: "手动",
        cnStamp: "CN",
        jpStamp: "JP",
        manualRename: "改名",
        manualClaimCode: "生成认领码",
        manualDetach: "从 viewer 解绑",
        manualDelete: "永久删除",
        manualCreated: "手动账号已创建",
        manualClaimed: "手动账号已认领",
        manualCodeReady: "认领码（10 分钟内一次有效）",
        manualActionFailed: "手动账号操作失败",
        onboardTitle: "还没有绑定鼓众广场 ID",
        onboardDesc: "绑定后即可同步成绩、年度总结与称号。",
        onboardCta: "立即绑定",
        startVerify: "开始验证",
        pendingId: "待确认 ID",
        pendingTitle: "记录称号",
        emptyTitle: "（空）",
        expiresAt: "到期时间",
        confirmBinding: "我已修改称号，立即确认",
        noBindings: "当前还没有已验证的鼓众 ID",
        currentUsing: "当前使用",
        switchCurrent: "切换为当前",
        deleteBinding: "删除绑定",
        myDon: "我的小咚",
        myDonNeedBinding: "请先绑定鼓众广场 ID",
        myDonFailed: "我的小咚生成失败，请稍后重试",
        showcaseTitle: "我的小咚称号展示",
        showcaseDesc:
          "你可以在当前成绩可推断出的歌曲称号范围内，手动指定展示的 5 个称号顺序。保存后，我的小咚会优先按这里的顺序展示，不再使用默认的优先级和定数排序逻辑。",
        showcaseNeedBinding: "请先绑定鼓众广场 ID",
        showcaseNeedUserdata: "当前绑定还没有本地成绩数据，请先同步或更新成绩后再自定义。",
        showcaseEmpty: "当前成绩还没有可供自定义的歌曲称号",
        showcaseLoadFailed: "我的小咚称号候选加载失败，请稍后重试。",
        showcaseSave: "保存自定义",
        showcaseReset: "恢复默认展示",
        showcaseSaveSuccess: "我的小咚称号展示已更新",
        showcaseResetSuccess: "我的小咚称号展示已恢复默认",
        showcaseSaveFailed: "我的小咚称号展示保存失败",
        showcaseMode: "当前展示模式",
        showcaseModeDefault: "默认自动展示",
        showcaseModeCustom: "使用自定义顺序",
        showcaseSelection: "当前自定义顺序",
        showcaseSelectionEmpty: "未设置",
        showcaseOrderHint: "从上到下就是展示顺序。未选择的槽位会被跳过。",
        showcaseSlot: "位置 {index}",
        showcasePlaceholder: "选择称号",
        showcaseClearHint: "如果全部清空，就会恢复成默认排列。",
        showcaseLayout: "称号构图方式",
        showcaseLayoutNickname: "展示昵称版",
        showcaseLayoutFull: "FULL称号版",
        showcaseLayoutFullGold: "FULL璀璨金版",
        avatarUpdated: "头像已更新",
        avatarUploadFailed: "头像上传失败",
        avatarReset: "头像已恢复默认",
        avatarDeleteFailed: "头像删除失败",
        avatarCropTitle: "调整头像",
        avatarCropHint: "拖动图片可以调整圆形头像中的显示区域。",
        avatarCropWheelHint: "可用滑块或鼠标滚轮缩放图片。",
        avatarCropZoom: "缩放",
        avatarCropConfirm: "按当前裁剪保存",
        avatarCropLoadFailed: "图片加载失败，请重新选择",
        avatarCropFailed: "头像裁剪失败",
        prepareFailed: "绑定验证启动失败",
        confirmSuccess: "绑定成功，当前已切换到该 ID",
        confirmFailed: "绑定确认失败",
        switchSuccess: "当前绑定 ID 已切换",
        switchFailed: "绑定切换失败",
        deleteSuccess: "绑定已删除",
        deleteFailed: "绑定删除失败",
        deleteConfirmTitle: "删除绑定",
        deleteConfirm: "确定删除绑定的鼓众 ID {id} 吗？",
        deleteConfirmButton: "删除",
        lastBindingTitle: "二次确认",
        lastBindingConfirm: "这是你最后一个鼓众 ID。删除后，网页中的当前绑定、我的小咚和歌曲数据入口都会失去关联，请再次确认。",
        lastBindingButton: "确认删除最后一个绑定",
        qqTitle: "QQ 绑定",
        qqDesc: "通过 QQ 对应邮箱验证 QQ 所有权；若存在该 QQ 的 Bot 绑定记录，将快速迁移鼓众 ID。",
        qqPlaceholder: "输入 QQ 号",
        qqStartVerify: "获取验证码",
        qqCodeReady: "验证码已发送至 QQ 邮箱（10 分钟内有效）。",
        qqCodeHint: "请查看 QQ 邮箱并输入 6 位验证码。",
        qqConfirmVerify: "输入验证码确认",
        qqConfirmPlaceholder: "6 位验证码",
        qqConfirmButton: "确认绑定",
        qqBound: "已绑定",
        qqPending: "待验证",
        qqUnbound: "未绑定",
        qqUnbind: "解绑",
        qqUnbindConfirm: "确定解除 QQ {qq} 的绑定吗？",
        qqPrepareFailed: "QQ 绑定启动失败",
        qqConfirmFailed: "QQ 绑定确认失败",
        qqConfirmSuccess: "QQ 绑定成功",
        qqUnbindSuccess: "QQ 已解绑",
        qqUnbindFailed: "QQ 解绑失败"
      }
);

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

const formatShowcaseRequirement = (option: MyDonShowcaseTitleOption) => {
  const requirementLabel =
    locale.value === "ja"
      ? option.requirementType === "all_perfect"
        ? "ドンダフル"
        : option.requirementType === "full_combo"
          ? "フルコンボ"
          : "クリア"
      : option.requirementType === "all_perfect"
        ? "全良"
        : option.requirementType === "full_combo"
          ? "全连"
          : "通关";
  const difficultyLabel =
    locale.value === "ja"
      ? option.difficultyScope === "inner_oni"
        ? "裏"
        : option.difficultyScope === "oni_or_inner_oni"
          ? "おに/裏"
          : option.difficultyScope === "oni"
            ? "おに"
            : option.difficultyScope === "hard"
              ? "むずかしい"
              : option.difficultyScope === "normal"
                ? "ふつう"
                : option.difficultyScope === "easy"
                  ? "かんたん"
                  : "任意"
      : option.difficultyScope === "inner_oni"
        ? "里谱"
        : option.difficultyScope === "oni_or_inner_oni"
          ? "魔王/里谱"
          : option.difficultyScope === "oni"
            ? "魔王"
            : option.difficultyScope === "hard"
              ? "困难"
              : option.difficultyScope === "normal"
                ? "一般"
                : option.difficultyScope === "easy"
                  ? "简单"
                  : "任意";
  return `${requirementLabel} · ${difficultyLabel}`;
};

const formatShowcaseOptionLabel = (option: MyDonShowcaseTitleOption) => {
  const constLabel = option.constValue > 0 ? ` · ${option.constValue.toFixed(1)}` : "";
  const sourceLabel = option.source === "custom" ? (locale.value === "ja" ? "カスタム · " : "自定义 · ") : "";
  const songLabel =
    option.source === "custom" && option.songNames.length > 0
      ? ` · ${locale.value === "ja" ? "曲" : "曲名"}：${option.songNames.join(" / ")}`
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
      locale.value === "ja"
        ? "Viewer からのみ解除します。Bot 側と成績は保持されます。"
        : "只解除 viewer 端绑定，bot 端和成绩会保留。",
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
      locale.value === "ja"
        ? "両端の連携と全スコア履歴を削除します。この操作は通常の画面から元に戻せません。"
        : "将删除两端绑定和全部成绩历史，此操作无法在页面中撤销。",
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
</script>

<template>
  <div class="profile-page">
    <el-card v-if="pending" class="panel-card">
      <el-skeleton :rows="8" animated />
    </el-card>

    <template v-else-if="profile">
      <section class="profile-grid">
        <el-card v-if="needsBindingOnboarding" class="panel-card onboarding-card" role="region" :aria-label="copy.onboardTitle">
          <div class="onboarding-copy">
            <h3>{{ copy.onboardTitle }}</h3>
            <p>{{ copy.onboardDesc }}</p>
          </div>
          <el-button type="primary" size="large" @click="focusBindingForm">{{ copy.onboardCta }}</el-button>
        </el-card>

        <el-card class="panel-card profile-main-card">
          <div class="profile-main">
            <div class="avatar-block">
              <el-avatar :size="80" :src="profile.user.avatarUrl" class="profile-avatar">
                {{ profile.user.username.slice(0, 1) }}
              </el-avatar>
              <div class="avatar-actions">
                <el-upload
                  ref="avatarUploadRef"
                  :show-file-list="false"
                  :auto-upload="false"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  :on-change="handleAvatarSelect"
                >
                  <el-button class="avatar-upload-button" :loading="uploading">
                    <span class="avatar-upload-label avatar-upload-label--desktop">{{ copy.uploadAvatar }}</span>
                    <span class="avatar-upload-label avatar-upload-label--mobile">{{ copy.changeAvatar }}</span>
                  </el-button>
                </el-upload>
                <el-button class="avatar-reset-button" plain :loading="removingAvatar" @click="removeAvatar">
                  {{ copy.resetAvatar }}
                </el-button>
              </div>
            </div>
            <div class="profile-info">
              <h2>{{ profile.user.username }}</h2>
              <p>{{ profile.user.email }}</p>
              <div class="status-list">
                <div class="status-chip" :class="profile.verificationStatus.emailVerified ? 'ok' : 'pending'">
                  <span>{{ copy.emailVerified }}</span>
                  <strong>{{ profile.verificationStatus.emailVerified ? copy.verified : copy.unverified }}</strong>
                </div>
                <div class="status-chip" :class="profile.verificationStatus.taikoVerified ? 'ok' : 'pending'">
                  <span>{{ copy.taikoVerified }}</span>
                  <strong>{{ profile.verificationStatus.taikoVerified ? copy.verified : copy.unverified }}</strong>
                </div>
              </div>
              <div class="meta-grid">
                <div class="meta-item meta-item--binding">
                  <span class="binding-label binding-label--desktop">{{ copy.currentBinding }}</span>
                  <span class="binding-label binding-label--mobile">{{ copy.taikoIdLabel }}</span>
                  <strong>
                    <span class="binding-value binding-value--desktop">{{ profile.currentBinding?.displayName || profile.currentBinding?.taikoId || copy.unbound }}</span>
                    <span class="binding-value binding-value--mobile">{{ profile.currentBinding?.taikoId || profile.currentBinding?.displayName || copy.unbound }}</span>
                  </strong>
                </div>
                <details class="profile-more"><summary>{{ locale === 'ja' ? 'プロフィールの詳細' : '更多资料' }}</summary>
                <div class="meta-item meta-item--title">
                  <span>{{ copy.currentTitle }}</span>
                  <strong>{{ profile.currentBinding?.currentTitle || "-" }}</strong>
                </div>
                <div class="meta-item meta-item--created">
                  <span>{{ copy.createdAt }}</span>
                  <strong>{{ formatDateTime(profile.user.createdAt) }}</strong>
                </div>
                </details>
              </div>
            </div>
          </div>
        </el-card>

        <AnnualBetaContinue />
        <el-card ref="bindingCardRef" class="panel-card binding-card">
          <div class="section-title">
            <h3>{{ copy.bindTitle }}</h3>
            <p>{{ copy.bindDesc }}</p>
          </div>
          <label class="binding-field-label" for="binding-taiko-id">{{ copy.taikoIdLabel }}</label>
          <div class="bind-input-row">
            <el-input id="binding-taiko-id" ref="bindingInputRef" v-model="bindingInput" @focus="beta.track('binding_start')" :placeholder="copy.bindPlaceholder" />
            <el-button type="primary" :loading="preparing" @click="prepareBinding">{{ copy.startVerify }}</el-button>
          </div>
          <div v-if="profile.pendingBinding" ref="pendingBoxRef" class="pending-box" tabindex="-1">
            <div>
              <strong>{{ copy.pendingId }}：</strong>{{ profile.pendingBinding.taikoId }}
            </div>
            <div>
              <strong>{{ copy.pendingTitle }}：</strong>{{ profile.pendingBinding.originalTitle || copy.emptyTitle }}
            </div>
            <div>
              <strong>{{ copy.expiresAt }}：</strong>{{ formatDateTime(profile.pendingBinding.expiresAt) }}
            </div>
            <el-button type="success" :loading="confirming" @click="confirmBinding()">{{ copy.confirmBinding }}</el-button>
          </div>
          <el-empty v-if="!profile.bindings.length" :description="copy.noBindings" />
          <div v-else class="binding-list">
            <div
              v-for="binding in profile.bindings"
              :key="binding.id"
              class="binding-item"
              :class="{ 'binding-item--manual': binding.isManual }"
            >
              <div>
                <div class="binding-heading">
                  <strong>{{ binding.displayName || binding.taikoId }}</strong>
                  <span class="source-stamp" :class="`source-stamp--${binding.source}`">
                    {{ binding.source === "manual" ? copy.manualStamp : binding.source === "hiroba" ? copy.jpStamp : copy.cnStamp }}
                  </span>
                </div>
                <p>{{ binding.verifiedTitle || "-" }}</p>
              </div>
              <div class="binding-actions">
                <el-button
                  :type="binding.isCurrent ? 'primary' : 'default'"
                  :loading="switchingId === binding.id"
                  :disabled="binding.isCurrent || switchingId === binding.id"
                  @click="switchBinding(binding.id)"
                >
                  {{ binding.isCurrent ? copy.currentUsing : copy.switchCurrent }}
                </el-button>
                <template v-if="binding.isManual">
                  <el-button plain @click="renameManual(binding)">{{ copy.manualRename }}</el-button>
                  <el-button plain @click="showManualClaimCode(binding)">{{ copy.manualClaimCode }}</el-button>
                  <el-button type="warning" plain @click="detachManual(binding)">{{ copy.manualDetach }}</el-button>
                  <el-button type="danger" plain @click="permanentlyDeleteManual(binding)">{{ copy.manualDelete }}</el-button>
                </template>
                <el-button
                  v-else
                  type="danger"
                  plain
                  :loading="deletingId === binding.id"
                  @click="deleteBinding(binding)"
                >
                  {{ copy.deleteBinding }}
                </el-button>
              </div>
            </div>
          </div>
          <details class="manual-account-panel"><summary>{{ copy.manualTitle }}</summary>
            <div class="manual-account-copy">
              <p>{{ copy.manualDesc }}</p>
            </div>
            <div class="manual-account-controls">
              <el-input
                v-model="manualNickname"
                :placeholder="copy.manualNickname"
                maxlength="24"
                @keyup.enter="createManual"
              />
              <el-button
                type="success"
                plain
                :loading="manualLoading"
                :disabled="!manualNickname.trim()"
                @click="createManual"
              >
                {{ copy.manualCreate }}
              </el-button>
              <el-input
                v-model="manualClaimCode"
                :placeholder="copy.manualClaimPlaceholder"
                maxlength="12"
                @keyup.enter="claimManual"
              />
              <el-button
                :loading="manualLoading"
                :disabled="!manualClaimCode.trim()"
                @click="claimManual"
              >
                {{ copy.manualClaim }}
              </el-button>
            </div>
          </details>
        </el-card>

        <el-card class="panel-card qq-card">
          <div class="section-title">
            <h3>{{ copy.qqTitle }}</h3>
            <p>{{ copy.qqDesc }}</p>
          </div>
          <template v-if="profile.qqBinding && profile.qqBinding.status === 'active'">
            <div class="qq-bound-row">
              <div>
                <strong>QQ：{{ profile.qqBinding.qqNumber }}</strong>
                <p>{{ copy.qqBound }} · {{ formatDateTime(profile.qqBinding.verifiedAt || profile.qqBinding.createdAt) }}</p>
              </div>
              <el-button type="danger" plain :loading="qqRemoving" @click="removeQqBinding">{{ copy.qqUnbind }}</el-button>
            </div>
          </template>
          <template v-else-if="profile.qqBinding && profile.qqBinding.status === 'pending'">
            <div class="qq-pending-row">
              <div>
                <strong>QQ：{{ profile.qqBinding.qqNumber }}</strong>
                <span class="source-stamp source-stamp--manual">{{ copy.qqPending }}</span>
              </div>
              <p class="qq-pending-hint">{{ copy.qqCodeHint }}</p>
              <div class="qq-verify-row">
                <el-input v-model="qqVerifyCode" :placeholder="copy.qqConfirmPlaceholder" maxlength="6" @keyup.enter="confirmQqBinding" />
                <el-button type="primary" :loading="qqConfirming" :disabled="!qqVerifyCode.trim()" @click="confirmQqBinding">
                  {{ copy.qqConfirmButton }}
                </el-button>
              </div>
              <el-button type="danger" plain :loading="qqRemoving" @click="removeQqBinding">{{ copy.qqUnbind }}</el-button>
            </div>
          </template>
          <template v-else>
            <div v-if="qqVerifyCodeResult" ref="qqVerifyBoxRef" class="qq-code-result" tabindex="-1">
              <p>{{ copy.qqCodeReady }}</p>
              <p class="qq-code-hint">{{ copy.qqCodeHint }}</p>
              <div class="qq-verify-row">
                <el-input v-model="qqVerifyCode" :placeholder="copy.qqConfirmPlaceholder" maxlength="6" @keyup.enter="confirmQqBinding" />
                <el-button type="primary" :loading="qqConfirming" :disabled="!qqVerifyCode.trim()" @click="confirmQqBinding">
                  {{ copy.qqConfirmButton }}
                </el-button>
              </div>
            </div>
            <div v-else class="bind-input-row">
              <el-input v-model="qqInput" :placeholder="copy.qqPlaceholder" @keyup.enter="prepareQqBinding" />
              <el-button type="primary" :loading="qqPreparing" :disabled="!qqInput.trim()" @click="prepareQqBinding">
                {{ copy.qqStartVerify }}
              </el-button>
            </div>
          </template>
        </el-card>

        <el-card class="panel-card mydon-config-card">
        <div class="section-title">
          <h3>{{ copy.showcaseTitle }}</h3>
          <p>{{ copy.showcaseDesc }}</p>
        </div>

        <div v-if="myDonShowcasePending" class="showcase-skeleton">
          <el-skeleton :rows="6" animated />
        </div>
        <div v-else-if="!profile.currentBinding" class="mydon-empty">
          <el-empty :description="copy.showcaseNeedBinding" />
        </div>
        <div v-else-if="myDonShowcaseError" class="showcase-error">
          <el-alert :title="copy.showcaseLoadFailed" type="error" :closable="false" show-icon />
        </div>
        <div v-else-if="!myDonShowcaseData.hasUserdata" class="mydon-empty">
          <el-empty :description="copy.showcaseNeedUserdata" />
        </div>
        <div v-else-if="!availableShowcaseTitles.length" class="mydon-empty">
          <el-empty :description="copy.showcaseEmpty" />
        </div>
        <div v-else class="showcase-config">
          <div class="showcase-status">
            <div class="showcase-status__item">
              <span>{{ copy.showcaseMode }}</span>
              <strong>{{ myDonShowcaseData.isCustom ? copy.showcaseModeCustom : copy.showcaseModeDefault }}</strong>
            </div>
            <div class="showcase-status__item">
              <span>{{ copy.showcaseSelection }}</span>
              <strong v-if="currentShowcaseSelection.length">{{ currentShowcaseSelection.join(" / ") }}</strong>
              <strong v-else>{{ copy.showcaseSelectionEmpty }}</strong>
            </div>
          </div>

          <div class="showcase-layout-picker">
            <span class="showcase-layout-picker__label">{{ copy.showcaseLayout }}</span>
            <el-radio-group v-model="myDonShowcaseLayout" class="showcase-layout-picker__options">
              <el-radio-button value="nickname">{{ copy.showcaseLayoutNickname }}</el-radio-button>
              <el-radio-button value="full">{{ copy.showcaseLayoutFull }}</el-radio-button>
              <el-radio-button value="full_gold">{{ copy.showcaseLayoutFullGold }}</el-radio-button>
            </el-radio-group>
          </div>

          <p class="showcase-hint">{{ copy.showcaseOrderHint }}</p>

          <div class="showcase-slot-list">
            <div v-for="slotIndex in 5" :key="slotIndex" class="showcase-slot-item">
              <span class="showcase-slot-item__label">
                {{ copy.showcaseSlot.replace("{index}", String(slotIndex)) }}
              </span>
              <el-select
                v-model="myDonShowcaseSlots[slotIndex - 1]"
                filterable
                clearable
                class="showcase-slot-item__select"
                :placeholder="copy.showcasePlaceholder"
              >
                <el-option
                  v-for="option in getShowcaseSlotOptions(slotIndex - 1)"
                  :key="option.titleName"
                  :label="formatShowcaseOptionLabel(option)"
                  :value="option.titleName"
                />
              </el-select>
            </div>
          </div>

          <p class="showcase-clear-hint">{{ copy.showcaseClearHint }}</p>

          <div class="showcase-actions">
            <el-button type="primary" :loading="showcaseSaving" :disabled="!showcaseDirty" @click="saveMyDonShowcase">
              {{ copy.showcaseSave }}
            </el-button>
            <el-button plain :loading="showcaseSaving" :disabled="!showcaseCanReset" @click="resetMyDonShowcase">
              {{ copy.showcaseReset }}
            </el-button>
          </div>
        </div>
      </el-card>
      </section>

      <el-card class="panel-card mydon-card">
        <div class="section-title">
          <h3>{{ copy.myDon }}</h3>
        </div>
        <div v-if="!profile.currentBinding" class="mydon-empty">
          <el-empty :description="copy.myDonNeedBinding" />
        </div>
        <div v-else-if="!myDonErrored" class="mydon-frame">
          <img :src="myDonUrl" alt="我的小咚" class="mydon-image" @error="myDonErrored = true" />
        </div>
        <div v-else class="mydon-empty">
          <el-empty :description="copy.myDonFailed" />
        </div>
      </el-card>

      <section v-if="developerApiV1Enabled" class="third-party-settings" :aria-label="locale === 'ja' ? '外部アプリのアクセス管理' : '第三方应用权限'">
        <div>
          <h3>{{ locale === 'ja' ? '外部アプリのアクセス管理（任意）' : '第三方应用权限（可选）' }}</h3>
          <p>{{ locale === 'ja' ? '自分で許可した v1 アプリのアクセスを確認・取り消せます。許可したことがなければ何もする必要はありません。' : '查看或撤销你主动授予第三方 v1 应用的访问权限；没有授权过就无需操作。' }}</p>
        </div>
        <NuxtLink :to="localePath('/account/developer/grants')">
          {{ locale === 'ja' ? 'アクセス許可を管理' : '管理授权' }}
        </NuxtLink>
      </section>

      <AccountAvatarCropperDialog
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
.profile-page {
  width: 100%;
  display: grid;
  gap: 28px;
}

.third-party-settings {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 2px 0;
  border-top: 1px solid var(--el-border-color-light);
}
.third-party-settings h3 {
  margin: 0 0 6px;
  font-size: 15px;
}
.third-party-settings p {
  margin: 0;
  color:var(--el-text-color-regular);
  line-height: 1.65;
  font-size: 14px;
}
.third-party-settings a {
  flex-shrink: 0;
  color:inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}

:global(body.theme-dark .third-party-settings p) {
  color:inherit;
}

.onboarding-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  border: 1px solid rgba(64, 158, 255, 0.35);
}
.onboarding-card .onboarding-copy { min-width: 0; }
.onboarding-card h3 { margin: 0 0 6px; font-size: 16px; }
.onboarding-card p { margin: 0; color:var(--el-text-color-secondary); font-size: 14px; line-height: 1.6; }
@media (max-width: 520px) {
  .onboarding-card { flex-direction: column; align-items: stretch; text-align: left; }
  .onboarding-card .el-button { width: 100%; }
}
.profile-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 1fr);
  gap: 28px;
}

.profile-grid > *,
.profile-main > *,
.bind-input-row > *,
.manual-account-panel > *,
.manual-account-controls > * {
  min-width: 0;
}

.binding-card {
  container-type: inline-size;
}

.profile-main-card,.mydon-config-card {
  grid-column: 1 / -1;
}

.profile-main {
  display: grid;
  grid-template-columns: 80px minmax(0,1fr);
  gap: 22px;
  align-items: center;
}

.avatar-block {
  display: grid;
  gap: 14px;
  justify-items: center;
}

.avatar-actions {
  display: grid;
  gap: 10px;
}

.avatar-upload-label--mobile,
.binding-value--mobile,
.binding-label--mobile {
  display: none;
}

.profile-info h2 {
  margin: 0;
  font-size: 26px;
}

.profile-info p {
  margin: 6px 0 18px;
  color:var(--viewer-text-muted);
}

.status-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.status-chip {
  min-width: 0;
  padding: 6px 10px;
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.status-chip.ok {
  background:var(--viewer-success-surface);
}

.status-chip.pending {
  background:var(--viewer-warning-surface);
}

.status-chip span,
.meta-grid span {
  color:var(--viewer-text-muted);
  font-size: 14px;
}

.meta-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
}

.meta-grid div {
  padding: 12px 14px;
  border-radius: 14px;
  background:var(--viewer-surface-subtle);
  display: grid;
  gap: 4px;
}

.section-title h3 {
  margin: 0;
  font-size: 20px;
}

.section-title p {
  margin: 6px 0 16px;
  color:var(--viewer-text-muted);
  line-height: 1.7;
}

.binding-field-label{display:block;font-size:14px;margin:0 0 8px;}

.bind-input-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  margin-bottom: 14px;
}

.bind-input-row .el-input,
.manual-account-controls .el-input {
  width: 100%;
  min-width: 0;
}

.pending-box {
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 14px;
  background:var(--viewer-warning-surface);
  margin-bottom: 14px;
}

.manual-account-panel {
  display: block;
  grid-template-columns: minmax(0,1fr);
  gap: 14px;
  align-items: center;
  padding: 14px;
  margin: 4px 0 16px;
  border: 0;
  border-radius: 0;
  background:transparent;
}

.manual-drum {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  border: 4px solid var(--viewer-primary);
  border-radius: 50%;
  background:#fffdf9;
  box-shadow:inset 0 0 0 4px #ffd1a8;
}

.manual-drum span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background:var(--viewer-primary);
  opacity: 0.32;
}

.manual-account-copy {
  display: grid;
  gap: 4px;
}

.manual-account-copy p {
  margin: 0;
  color:var(--viewer-text-muted);
  font-size: 14px;
  line-height: 1.6;
}

.manual-account-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  width: 100%;
}

.binding-list {
  display: grid;
  gap: 12px;
}

.binding-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  border-radius: 14px;
  background:var(--viewer-surface-subtle);
}

.binding-item p {
  margin: 6px 0 0;
  color:var(--viewer-text-muted);
}

.binding-item--manual {
  box-shadow:inset 4px 0 0 var(--viewer-primary);
}

.binding-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.source-stamp {
  padding: 2px 7px;
  border: 1px solid currentColor;
  border-radius: 5px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.4;
}

.source-stamp--wahlap {
  color:var(--viewer-text-muted);
}

.source-stamp--hiroba {
  color:var(--viewer-text-muted);
}

.source-stamp--manual {
  color:var(--viewer-text-muted);
  border-style: dashed;
}

.binding-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.mydon-frame {
  border-radius: 18px;
  overflow: hidden;
  background:var(--viewer-surface-subtle);
  padding: 12px;
}

.mydon-image {
  width: 100%;
  display: block;
  border-radius: 14px;
}

.showcase-config {
  display: grid;
  gap: 16px;
}

.showcase-error {
  display: grid;
  gap: 10px;
}

.showcase-status {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.showcase-status__item,
.showcase-slot-item,
.showcase-layout-picker {
  padding: 14px;
  border-radius: 14px;
  background:var(--viewer-surface-subtle);
}

.showcase-status__item {
  display: grid;
  gap: 6px;
}

.showcase-status__item span,
.showcase-slot-item__label,
.showcase-layout-picker__label,
.showcase-hint,
.showcase-clear-hint {
  color:var(--viewer-text-muted);
}

.showcase-slot-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.showcase-slot-item {
  display: grid;
  gap: 10px;
}

.showcase-slot-item__select {
  width: 100%;
}

.showcase-layout-picker {
  display: grid;
  gap: 10px;
}

.showcase-layout-picker__options {
  display: flex;
  flex-wrap: wrap;
}

.showcase-hint,
.showcase-clear-hint {
  margin: 0;
  line-height: 1.7;
}

.showcase-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.qq-card {
  container-type: inline-size;
}

.qq-bound-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  border-radius: 14px;
  background:var(--viewer-surface-subtle);
}

.qq-bound-row p {
  margin: 6px 0 0;
  color:var(--viewer-text-muted);
}

.qq-pending-row {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background:var(--viewer-warning-surface);
}

.qq-pending-hint {
  margin: 0;
  color:var(--viewer-text-muted);
  line-height: 1.6;
}

.qq-verify-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.qq-code-result {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background:var(--viewer-warning-surface);
  margin-bottom: 14px;
}

.qq-code-result p {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.qq-code-result .qq-code-hint {
  font-size: 13px !important;
  font-weight: 400;
  color:var(--viewer-text-muted);
}

@container (max-width: 620px) {
  .manual-account-panel {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
  }

  .manual-account-controls {
    grid-column: 1 / -1;
  }
}

@container (max-width: 390px) {
  .manual-account-panel,
  .manual-account-controls {
    grid-template-columns: minmax(0, 1fr);
  }

  .manual-account-controls {
    grid-column: auto;
  }

  .manual-account-controls .el-button {
    width: 100%;
    margin-left: 0;
  }
}

@media (max-width: 1100px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .profile-main {
    grid-template-columns: 84px minmax(0, 1fr);
    align-items: start;
    gap: 14px;
  }

  .profile-avatar {
    width: 80px;
    height: 80px;
    line-height: 80px;
    font-size: 28px;
  }

  .avatar-block {
    gap: 8px;
    justify-items: stretch;
  }

  .avatar-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 4px 8px;
  }

  .avatar-actions :deep(.el-upload) {
    display: inline-flex;
  }

  .avatar-upload-button {
    min-height: 44px;
    padding: 5px 8px;
    font-size: 14px;
  }

  .avatar-reset-button {
    min-height: 44px;
    padding: 4px 0;
    border: 0;
    background:transparent;
    color:var(--el-text-color-secondary);
    font-size: 14px;
  }

  .avatar-upload-label--desktop,
  .binding-value--desktop,
  .binding-label--desktop {
    display: none;
  }

  .avatar-upload-label--mobile,
  .binding-value--mobile,
  .binding-label--mobile {
    display: inline;
  }

  .profile-info h2 {
    font-size: 20px;
    line-height: 1.2;
  }

  .profile-info p {
    margin: 4px 0 9px;
    font-size: 14px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .status-list {
    gap: 6px;
    margin-bottom: 9px;
  }

  .status-chip {
    min-width: 0;
    padding: 5px 8px;
    border: 1px solid transparent;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    line-height: 1.35;
  }

  .status-chip.ok {
    border-color:var(--viewer-border);
    background:var(--viewer-success-surface);
  }

  .status-chip.ok::before {
    content: "✓";
    color:var(--viewer-success);
    font-weight: 600;
  }

  .status-chip.pending {
    border-color:var(--viewer-border);
    background:var(--viewer-warning-surface);
  }

  .status-chip.pending::before {
    content: "!";
    color:var(--viewer-warning);
    font-weight: 600;
  }

  .status-chip span,
  .status-chip strong {
    font-size: 14px;
    line-height: 1.35;
  }

  .meta-grid {
    display: block;
    margin-top: 2px;
  }

  .meta-grid .meta-item--title,
  .meta-grid .meta-item--created {
    display: grid;
  }

  .meta-grid .meta-item--binding {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 0;
    border-radius: 0;
    background:transparent;
  }

  .meta-grid .meta-item--binding > span {
    font-size: 14px;
  }

  .meta-grid .meta-item--binding > strong {
    font-size: 14px;
    line-height: 1.4;
  }

  .binding-card,
  .qq-card {
    scroll-margin-top: 16px;
  }

  .meta-grid {
    grid-template-columns: 1fr;
  }

  .bind-input-row {
    grid-template-columns: 1fr;
  }

  .manual-account-panel,
  .manual-account-controls {
    grid-template-columns: 1fr;
  }

  .binding-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .showcase-status,
  .showcase-slot-list {
    grid-template-columns: 1fr;
  }

  .binding-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
.manual-account-panel summary{cursor:pointer;min-height:44px;align-content:center;font-size:15px;color:var(--viewer-link);}.manual-account-panel[open] summary{margin-bottom:12px;}.manual-account-controls{margin-top:16px;}.manual-account-panel{margin-top:16px;padding:0;}.binding-item--manual{box-shadow:none;}.section-title h3,.profile-info h2{font-weight:600;}.profile-main-card{background:transparent;}.profile-main-card :deep(.el-card__body){padding:0 0 8px;}.meta-grid div{background:transparent;padding:0;}.status-chip.ok{color:var(--viewer-success);}.status-chip.pending{color:var(--viewer-warning);}.status-chip strong{font-weight:500;}.avatar-reset-button{color:var(--viewer-link);}.profile-avatar{background:var(--viewer-surface-subtle);color:var(--viewer-text-muted);}.mydon-frame{background:var(--viewer-surface-subtle);}.qq-code-result p.qq-code-hint{font-size:14px;font-weight:400;}
.profile-more summary{min-height:44px;align-content:center;cursor:pointer;color:var(--viewer-link);font-size:14px;}.profile-more[open]{display:grid;gap:12px;}.profile-more .meta-item{padding:0;background:transparent;}
</style>
