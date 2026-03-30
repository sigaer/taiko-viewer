<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import { formatViewerTitle } from "~/composables/useViewerSeo";

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

const { accountUser, fetchCurrentUser } = useAccountState();
const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;
await fetchCurrentUser();

const pageMeta = {
  title: "开发者权限",
  desc: "提交开发者权限申请，查看审批结果和你的开发者 Token。"
};

definePageMeta({
  middleware: "account-auth",
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/account/developer",
  breadcrumbs: [
    { label: "账号系统", to: "/account/profile" },
    { label: "开发者权限", to: "/account/developer" }
  ]
});

useSeoMeta({
  title: formatViewerTitle(pageMeta.title),
  description: pageMeta.desc,
  ogTitle: formatViewerTitle(pageMeta.title),
  ogDescription: pageMeta.desc
});

const form = ref({
  reason: "",
  replyEmail: accountUser.value?.email || ""
});
const imageFiles = ref<File[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const submitting = ref(false);

const { data, pending, refresh } = await useAsyncData<DeveloperPayload>(
  "account-developer",
  () => $fetch("/api/account/developer", { headers }),
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
    ElMessage.warning("请先填写开发者权限申请理由");
    return;
  }
  if (!form.value.replyEmail.trim()) {
    ElMessage.warning("请先填写接收反馈邮箱");
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
    await $fetch("/api/account/developer/apply", {
      method: "POST",
      body
    });
    ElMessage.success("开发者申请已提交，请等待审批");
    imageFiles.value = [];
    if (fileInput.value) fileInput.value.value = "";
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "提交申请失败");
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
          <h2>开发者权限</h2>
          <p>申请通过后会向你填写的邮箱发送 24 位开发者 Token，可用于按 userid 读取完整 JSON。</p>
        </div>
        <div class="status-grid">
          <div>
            <span>当前状态</span>
            <strong>{{ developerState.currentApplication?.status || "未申请" }}</strong>
          </div>
          <div>
            <span>Token 掩码</span>
            <strong>{{ developerState.token?.tokenMask || "未签发" }}</strong>
          </div>
          <div>
            <span>最近使用</span>
            <strong>{{ developerState.token?.lastUsedAt ? new Date(developerState.token.lastUsedAt).toLocaleString() : "-" }}</strong>
          </div>
        </div>
        <div v-if="developerState.canReview" class="review-link">
          <NuxtLink to="/account/developer/review">进入开发者审批台</NuxtLink>
        </div>
      </el-card>

      <el-card class="panel-card">
        <div class="section-title">
          <h3>提交申请</h3>
          <p>同一账号只能保留一个待审批申请；已通过后将不再开放重复申请。</p>
        </div>
        <el-form label-position="top" @submit.prevent="submitApplication">
          <el-form-item label="反馈邮箱">
            <el-input v-model="form.replyEmail" placeholder="用于接收审批结果和开发者 Token" :disabled="!canSubmitApplication" />
          </el-form-item>
          <el-form-item label="申请理由">
            <el-input
              v-model="form.reason"
              type="textarea"
              :rows="6"
              maxlength="4000"
              show-word-limit
              placeholder="说明你的使用场景、需要查询哪些数据、计划如何接入。"
              :disabled="!canSubmitApplication"
            />
          </el-form-item>
          <el-form-item label="截图（可选，最多 4 张）">
            <input ref="fileInput" class="hidden-input" type="file" accept="image/*" multiple @change="handleImageChange" />
            <div class="image-picker">
              <el-button plain :disabled="!canSubmitApplication" @click="triggerImageInput">选择图片</el-button>
              <span>{{ imageFiles.length ? `已选择 ${imageFiles.length} 张` : "未选择图片" }}</span>
            </div>
            <div v-if="imageFiles.length" class="image-name-list">
              <span v-for="file in imageFiles" :key="file.name">{{ file.name }}</span>
            </div>
          </el-form-item>
          <el-button type="primary" :loading="submitting" :disabled="!canSubmitApplication" @click="submitApplication">
            {{ canSubmitApplication ? "提交开发者申请" : "当前状态不可重复申请" }}
          </el-button>
        </el-form>
      </el-card>

      <el-card class="panel-card">
        <div class="section-title">
          <h3>申请状态</h3>
          <p>这里会显示最近一次申请的审批反馈，以及开发者 Token 的掩码信息。</p>
        </div>
        <el-empty v-if="!developerState.currentApplication" description="你还没有提交过开发者申请" />
        <template v-else>
          <div class="application-card">
            <div class="application-card__meta">
              <span>提交时间：{{ new Date(developerState.currentApplication.createdAt).toLocaleString() }}</span>
              <span>反馈邮箱：{{ developerState.currentApplication.replyEmail }}</span>
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
              <strong>审批反馈</strong>
              <p>{{ developerState.currentApplication.reviewNote }}</p>
            </div>
          </div>
        </template>
      </el-card>

      <el-card class="panel-card">
        <div class="section-title">
          <h3>历史记录</h3>
          <p>保留最近几次开发者申请的状态变化。</p>
        </div>
        <el-empty v-if="!developerState.history.length" description="暂无历史记录" />
        <div v-else class="history-list">
          <div v-for="item in developerState.history" :key="item.id" class="history-item">
            <div class="history-item__head">
              <strong>{{ item.status }}</strong>
              <span>{{ new Date(item.createdAt).toLocaleString() }}</span>
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
