<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import DeveloperApiGuide from "~/components/account/DeveloperApiGuide.vue";
import { buildPageDescription } from "~/utils/seo";

type DeveloperApplication = {
  id: number;
  replyEmail: string;
  reason: string;
  imageUrls: string[];
  status: string;
  reviewNote: string;
  reviewedAt: string;
  createdAt: string;
  updatedAt: string;
};

type DeveloperToken = {
  id: number;
  tokenMask: string;
  status: string;
  issuedAt: string;
  lastUsedAt: string;
  revokedAt: string;
};

type DeveloperPayload = {
  canReview: boolean;
  currentApplication: DeveloperApplication | null;
  history: DeveloperApplication[];
  token: DeveloperToken | null;
};

const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { formatDateTime } = useViewerDateTime();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser(true);

definePageMeta({
  contentLayout: "reading",
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

const copy = computed(() =>
  locale.value === "ja"
    ? {
        title: "開発者権限",
        intro: "承認済み Token で任意の Source ID の現在スコアを読み取れます。プレイヤーごとの同意は不要です。書き込み・同期・認証情報・成長履歴は対象外です。",
        currentStatus: "現在の状態",
        notApplied: "未申請",
        tokenMask: "Token マスク",
        notIssued: "未発行",
        lastUsed: "最終利用",
        reviewLink: "開発者審査画面へ",
        submitTitle: "申請を送信",
        submitDesc: "同一アカウントでは審査中の申請を 1 件だけ保持できます。承認後は再申請できません。",
        replyEmail: "連絡先メール",
        replyEmailPlaceholder: "審査結果と Token の受信用",
        reason: "申請理由",
        reasonPlaceholder: "利用用途、必要なデータ、接続予定を記載してください。",
        images: "スクリーンショット（任意、最大 4 枚）",
        chooseImages: "画像を選択",
        selectedImages: "{count} 枚選択済み",
        noImages: "画像未選択",
        submit: "開発者申請を送信",
        disabledSubmit: "現在の状態では再申請できません",
        stateTitle: "申請状態",
        stateDesc: "直近の申請結果と開発者 Token の情報を表示します。",
        noApplication: "まだ開発者申請を送信していません",
        submittedAt: "申請日時",
        reviewFeedback: "審査フィードバック",
        history: "履歴",
        historyDesc: "最近の開発者申請履歴を保持します。",
        noHistory: "履歴はありません",
        needReason: "申請理由を入力してください",
        needEmail: "連絡先メールを入力してください",
        submitSuccess: "申請を送信しました。審査をお待ちください。",
        submitFailed: "申請送信に失敗しました"
      }
    : {
        title: "开发者权限",
        intro: "申请通过后可用 Developer Token 按 Source ID 读取任意玩家的当前成绩，无需玩家逐人授权；不含写入、同步、凭据或成长历史权限。",
        currentStatus: "当前状态",
        notApplied: "未申请",
        tokenMask: "Token 掩码",
        notIssued: "未签发",
        lastUsed: "最近使用",
        reviewLink: "进入开发者审批台",
        submitTitle: "提交申请",
        submitDesc: "同一账号只能保留一个待审批申请；已通过后将不再开放重复申请。",
        replyEmail: "反馈邮箱",
        replyEmailPlaceholder: "用于接收审批结果和开发者 Token",
        reason: "申请理由",
        reasonPlaceholder: "说明你的使用场景、需要查询哪些数据、计划如何接入。",
        images: "截图（可选，最多 4 张）",
        chooseImages: "选择图片",
        selectedImages: "已选择 {count} 张",
        noImages: "未选择图片",
        submit: "提交开发者申请",
        disabledSubmit: "当前状态不可重复申请",
        stateTitle: "申请状态",
        stateDesc: "这里会显示最近一次申请的审批反馈，以及开发者 Token 的掩码信息。",
        noApplication: "你还没有提交过开发者申请",
        submittedAt: "提交时间",
        reviewFeedback: "审批反馈",
        history: "历史记录",
        historyDesc: "保留最近几次开发者申请的状态变化。",
        noHistory: "暂无历史记录",
        needReason: "请先填写开发者权限申请理由",
        needEmail: "请先填写接收反馈邮箱",
        submitSuccess: "开发者申请已提交，请等待审批",
        submitFailed: "提交申请失败"
      }
);

const { data, pending, refresh } = await useAsyncData<DeveloperPayload>(
  "account-developer",
  () => apiFetch("/api/account/developer"),
  {
    default: () => ({
      canReview: false,
      currentApplication: null,
      history: [],
      token: null
    })
  }
);

const developerState = computed(() => data.value);
const currentStatus = computed(() => developerState.value.currentApplication?.status || "");
const canSubmitApplication = computed(() => !["pending", "approved"].includes(currentStatus.value));

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
    return;
  }
  if (!form.value.replyEmail.trim()) {
    ElMessage.warning(copy.value.needEmail);
    return;
  }
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
    ElMessage.success(copy.value.submitSuccess);
    imageFiles.value = [];
    if (fileInput.value) fileInput.value.value = "";
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.submitFailed);
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="developer-page">
    <el-card v-if="pending" class="panel-card">
      <el-skeleton :rows="8" animated />
    </el-card>

    <template v-else>
      <el-card class="panel-card">
        <div class="section-title">
          <h2>{{ copy.title }}</h2>
          <p>{{ copy.intro }}</p>
        </div>
        <div class="status-grid">
          <div>
            <span>{{ copy.currentStatus }}</span>
            <strong>{{ developerState.currentApplication?.status || copy.notApplied }}</strong>
          </div>
          <div>
            <span>{{ copy.tokenMask }}</span>
            <strong>{{ developerState.token?.tokenMask || copy.notIssued }}</strong>
          </div>
          <div>
            <span>{{ copy.lastUsed }}</span>
            <strong>{{ developerState.token?.lastUsedAt ? formatDateTime(developerState.token.lastUsedAt) : "-" }}</strong>
          </div>
        </div>
        <div v-if="developerState.canReview" class="review-link">
          <NuxtLink :to="localePath('/account/developer/review')">{{ copy.reviewLink }}</NuxtLink>
        </div>
      </el-card>

      <DeveloperApiGuide
        :locale="locale"
        :application-status="currentStatus"
        :token-active="developerState.token?.status === 'active'"
      />

      <el-card v-if="canSubmitApplication" class="panel-card">
        <div class="section-title">
          <h3>{{ copy.submitTitle }}</h3>
          <p>{{ copy.submitDesc }}</p>
        </div>
        <el-form label-position="top" @submit.prevent="submitApplication">
          <el-form-item :label="copy.replyEmail">
            <el-input v-model="form.replyEmail" :placeholder="copy.replyEmailPlaceholder" :disabled="!canSubmitApplication" />
          </el-form-item>
          <el-form-item :label="copy.reason">
            <el-input
              v-model="form.reason"
              type="textarea"
              :rows="6"
              maxlength="4000"
              show-word-limit
              :placeholder="copy.reasonPlaceholder"
              :disabled="!canSubmitApplication"
            />
          </el-form-item>
          <el-form-item :label="copy.images">
            <input ref="fileInput" class="hidden-input" type="file" accept="image/*" multiple @change="handleImageChange" />
            <div class="image-picker">
              <el-button plain :disabled="!canSubmitApplication" @click="triggerImageInput">{{ copy.chooseImages }}</el-button>
              <span>{{ imageFiles.length ? copy.selectedImages.replace("{count}", String(imageFiles.length)) : copy.noImages }}</span>
            </div>
            <div v-if="imageFiles.length" class="image-name-list">
              <span v-for="file in imageFiles" :key="file.name">{{ file.name }}</span>
            </div>
          </el-form-item>
          <el-button type="primary" :loading="submitting" :disabled="!canSubmitApplication" @click="submitApplication">
            {{ canSubmitApplication ? copy.submit : copy.disabledSubmit }}
          </el-button>
        </el-form>
      </el-card>

      <el-card class="panel-card">
        <div class="section-title">
          <h3>{{ copy.stateTitle }}</h3>
          <p>{{ copy.stateDesc }}</p>
        </div>
        <el-empty v-if="!developerState.currentApplication" :description="copy.noApplication" />
        <template v-else>
          <div class="application-card">
            <div class="application-card__meta">
              <span>{{ copy.submittedAt }}：{{ formatDateTime(developerState.currentApplication.createdAt) }}</span>
              <span>{{ copy.replyEmail }}：{{ developerState.currentApplication.replyEmail }}</span>
            </div>
            <p class="application-reason">{{ developerState.currentApplication.reason }}</p>
            <div v-if="developerState.currentApplication.imageUrls.length" class="image-preview-grid">
              <a
                v-for="url in developerState.currentApplication.imageUrls"
                :key="url"
                :href="url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img :src="url" alt="开发者申请截图" />
              </a>
            </div>
            <div v-if="developerState.currentApplication.reviewNote" class="review-note">
              <strong>{{ copy.reviewFeedback }}</strong>
              <p>{{ developerState.currentApplication.reviewNote }}</p>
            </div>
          </div>
        </template>
      </el-card>

      <el-card class="panel-card">
        <div class="section-title">
          <h3>{{ copy.history }}</h3>
          <p>{{ copy.historyDesc }}</p>
        </div>
        <el-empty v-if="!developerState.history.length" :description="copy.noHistory" />
        <div v-else class="history-list">
          <div v-for="item in developerState.history" :key="item.id" class="history-item">
            <div class="history-item__head">
              <strong>{{ item.status }}</strong>
              <span>{{ formatDateTime(item.createdAt) }}</span>
            </div>
            <p>{{ item.replyEmail }}</p>
          </div>
        </div>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.developer-page {
  display: grid;
  gap: 18px;
}

.section-title h2,
.section-title h3 {
  margin: 0;
}

.section-title p {
  margin: 8px 0 0;
  color:var(--viewer-text-muted);
  line-height: 1.8;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.status-grid div,
.application-card,
.history-item {
  padding: 14px;
  border-radius: 14px;
  background:var(--viewer-surface-subtle);
}

.status-grid div {
  display: grid;
  gap: 4px;
}

.status-grid span,
.application-card__meta,
.history-item p {
  color:var(--viewer-text-muted);
}

.review-link {
  margin-top: 16px;
}

.review-link a {
  color:var(--viewer-primary);
  text-decoration: none;
  font-weight: 600;
}

.hidden-input {
  display: none;
}

.image-picker {
  display: flex;
  align-items: center;
  gap: 12px;
}

.image-name-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.image-name-list span {
  padding: 6px 10px;
  border-radius: 999px;
  background:var(--viewer-surface-subtle);
  color:var(--viewer-text-muted);
  font-size: 13px;
}

.application-card {
  margin-top: 18px;
}

.application-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
}

.application-reason {
  margin: 14px 0 0;
  white-space: pre-wrap;
  line-height: 1.8;
}

.image-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.image-preview-grid a {
  display: block;
}

.image-preview-grid img {
  width: 100%;
  border-radius: 12px;
  display: block;
}

.review-note {
  margin-top: 14px;
}

.review-note p,
.history-item p {
  margin: 8px 0 0;
  line-height: 1.7;
}

.history-list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.history-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
