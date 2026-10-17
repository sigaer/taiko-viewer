<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
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

const developerApiV1Enabled = computed(() => accountUser.value?.developerApiV1Access === true);
const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { formatDateTime } = useViewerDateTime();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser(true);

definePageMeta({
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
        submitFailed: "申請送信に失敗しました",
        guideTitle: "Token の使い方",
        guideLead: "承認メールで届いた Token を使い、任意の太鼓 Source ID の現在スコアを読み取れます。",
        guideSteps: [
          "承認メールの Token を確認します（この画面にはマスクのみ表示）。",
          "太鼓の Source ID を用意します（Viewer のユーザー ID ではありません）。",
          "サーバーやターミナルから、下の HTTPS GET を実行します。"
        ],
        guideCurl: "cURL サンプル（YOUR_... を置き換えてください）",
        guidePython: "Python サンプル（requests が必要です）",
        guidePythonSetup: "実行前に、環境変数 TAIKO_VIEWER_DEVELOPER_TOKEN に承認メールの Token を設定してください。",
        guideCopy: "サンプルをコピー",
        guideCopied: "サンプルをコピーしました",
        guideCopyFailed: "コピーできませんでした。コードを選択してコピーしてください。",
        guideResponse: "成功時は profile、songs、achievement、dojo などを含む JSON が返ります。songs の song_no / level / high_score が曲別の主要フィールドです。",
        guideErrors: "401: Token が無効・失効、403: 権限不足、404: データなし、429: 利用回数制限、503: 一時的に利用不可。",
        guideSafety: "この Token は現在スコアの読み取り専用です。履歴・同期・書き込み・認証情報は対象外です。Token を公開コード、ブラウザー、URL やログに置かないでください。",
        guideLost: "Token の全文は再表示できません。紛失時は管理者に再発行を相談してください。",
        guideInactive: "有効な Token がありません。使用前に管理者にお問い合わせください。",
        guideV1: "別の Developer API v1 では、アプリへの ResourceGrant による個別アクセス許可が必要です。",
        guideV1Link: "v1 アプリとアクセス許可"
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
        submitFailed: "提交申请失败",
        guideTitle: "Token 使用指南",
        guideLead: "审批邮件中的 Developer Token 可用于按太鼓 Source ID 读取不同玩家的当前成绩。",
        guideSteps: [
          "从审批通知邮件中保存 Token；这里仅显示掩码，不会再次显示完整密钥。",
          "准备要查询的太鼓 Source ID（不是 Viewer 网站用户 ID）。",
          "从服务端或终端发送下面的 HTTPS GET 请求，读取返回的 JSON。"
        ],
        guideCurl: "cURL 示例（请替换 YOUR_... 占位符）",
        guidePython: "Python 示例（需要 requests 库）",
        guidePythonSetup: "运行前，请将审批邮件中的 Token 设置为环境变量 TAIKO_VIEWER_DEVELOPER_TOKEN。",
        guideCopy: "复制示例",
        guideCopied: "已复制示例代码",
        guideCopyFailed: "复制失败，请手动选中代码复制",
        guideResponse: "成功返回包含 profile、songs、achievement、dojo 等字段的 JSON；歌曲记录主要使用 songs 中的 song_no、level、high_score。",
        guideErrors: "401：Token 无效或已撤销；403：缺少读取权限；404：成绩数据不存在；429：调用次数超限；503：服务暂不可用。",
        guideSafety: "仅支持当前成绩只读，不包含历史、写入、同步或上游凭据。不要把 Token 放入公开仓库、浏览器脚本、URL 或日志。",
        guideLost: "完整 Token 不会在页面上重新显示；如果遗失，请联系管理员处理重新签发。",
        guideInactive: "当前没有有效 Token。请联系管理员处理后再调用接口。",
        guideV1: "另有 Developer API v1，使用 ResourceGrant 逐应用、逐绑定授权，与此接口的 Token 权限不同。",
        guideV1Link: "查看 v1 应用及授权管理"
      }
);

const curlExample =
  'curl -H "Authorization: Bearer YOUR_DEVELOPER_TOKEN" "https://viewer.sakura-bot.cn/api/developer/userdata/YOUR_SOURCE_ID"';

const pythonExample = [
  "import os",
  "import requests",
  "",
  'source_id = "YOUR_SOURCE_ID"',
  'token = os.environ["TAIKO_VIEWER_DEVELOPER_TOKEN"]',
  'response = requests.get(',
  '    f"https://viewer.sakura-bot.cn/api/developer/userdata/{source_id}",',
  '    headers={"Authorization": f"Bearer {token}"},',
  '    timeout=20,',
  ')',
  'response.raise_for_status()',
  'for song in response.json().get("songs", []):',
  '    print(song.get("song_no"), song.get("level"), song.get("high_score"))'
].join("\n");

const copyGuideExample = async (example: string) => {
  try {
    await navigator.clipboard.writeText(example);
    ElMessage.success(copy.value.guideCopied);
  } catch {
    ElMessage.warning(copy.value.guideCopyFailed);
  }
};

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
    <NuxtLink v-if="developerApiV1Enabled" :to="localePath('/account/developer/grants')">{{locale==='ja'?'アプリへのアクセス許可':'应用授权'}}</NuxtLink>
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

      <el-card v-if="developerState.currentApplication?.status === 'approved'" class="panel-card developer-guide">
        <div class="section-title">
          <h3>{{ copy.guideTitle }}</h3>
          <p>{{ copy.guideLead }}</p>
        </div>
        <p v-if="developerState.token?.status !== 'active'" class="guide-alert" role="status">{{ copy.guideInactive }}</p>
        <ol class="guide-steps">
          <li v-for="step in copy.guideSteps" :key="step">{{ step }}</li>
        </ol>
        <div class="guide-sample-header">
          <strong>{{ copy.guideCurl }}</strong>
          <el-button plain :aria-label="`${copy.guideCopy} (cURL)`" @click="copyGuideExample(curlExample)">{{ copy.guideCopy }}</el-button>
        </div>
        <pre class="guide-code" tabindex="0" :aria-label="copy.guideCurl"><code>{{ curlExample }}</code></pre>
        <p class="guide-note">{{ copy.guideResponse }}</p>
        <details class="guide-extra">
          <summary>{{ copy.guidePython }}</summary>
          <p class="guide-note">{{ copy.guidePythonSetup }}</p>
          <div class="guide-sample-header">
            <el-button plain :aria-label="`${copy.guideCopy} (Python)`" @click="copyGuideExample(pythonExample)">{{ copy.guideCopy }}</el-button>
          </div>
          <pre class="guide-code" tabindex="0" :aria-label="copy.guidePython"><code>{{ pythonExample }}</code></pre>
        </details>
        <p class="guide-note">{{ copy.guideErrors }}</p>
        <p class="guide-note">{{ copy.guideSafety }}</p>
        <p class="guide-note">{{ copy.guideLost }}</p>
        <p v-if="developerApiV1Enabled" class="guide-note">
          {{ copy.guideV1 }}
          <NuxtLink :to="localePath('/account/developer/grants')">{{ copy.guideV1Link }}</NuxtLink>
        </p>
      </el-card>

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
  color: #7d6a5a;
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
  background: rgba(255, 248, 240, 0.82);
}

.status-grid div {
  display: grid;
  gap: 4px;
}

.status-grid span,
.application-card__meta,
.history-item p {
  color: #7d6a5a;
}

.review-link {
  margin-top: 16px;
}

.review-link a {
  color: #d84a34;
  text-decoration: none;
  font-weight: 600;
}

.developer-guide {
  min-width: 0;
}

.developer-guide .guide-steps {
  padding-left: 22px;
  line-height: 1.8;
  margin: 16px 0;
}

.guide-sample-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin: 14px 0 8px;
}

.guide-sample-header .el-button {
  min-height: 44px;
}

.guide-code {
  max-width: 100%;
  overflow-x: auto;
  padding: 14px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.65;
  white-space: pre;
}

.guide-note {
  line-height: 1.75;
  color: var(--el-text-color-regular);
  overflow-wrap: anywhere;
}

.guide-alert {
  color: var(--el-color-danger);
}

.guide-extra {
  margin-top: 14px;
}

.guide-extra summary {
  cursor: pointer;
  font-weight: 600;
  min-height: 44px;
  align-content: center;
}

.guide-note a {
  color: var(--el-color-primary);
}

:global(body.theme-dark) .developer-guide .section-title p,
:global(body.theme-dark) .developer-guide .guide-note {
  color: inherit;
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
  background: rgba(255, 240, 224, 0.9);
  color: #7d6a5a;
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
