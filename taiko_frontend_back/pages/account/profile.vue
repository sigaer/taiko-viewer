<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";

const { accountUser, fetchCurrentUser } = useAccountState();
const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;
await fetchCurrentUser();

const pageMeta = {
  title: "个人档案",
  desc: "查看账号信息、认证状态、绑定的鼓众广场 ID 与我的小咚。"
};

definePageMeta({
  middleware: "account-auth",
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/account/profile",
  breadcrumbs: [
    { label: "账号系统", to: "/account/profile" },
    { label: "个人档案", to: "/account/profile" }
  ]
});

useSeoMeta({
  title: pageMeta.title,
  description: pageMeta.desc,
  ogTitle: pageMeta.title,
  ogDescription: pageMeta.desc
});

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
    isCurrent: boolean;
    verifiedTitle: string | null;
    verifiedTitleplateId: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
  currentBinding: {
    id: number;
    taikoId: string;
    isCurrent: boolean;
    verifiedTitle: string | null;
    verifiedTitleplateId: number | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  pendingBinding: {
    taikoId: string;
    originalTitle: string;
    originalTitleplateId: number;
    expiresAt: string;
  } | null;
  verificationStatus: {
    emailVerified: boolean;
    taikoVerified: boolean;
  };
};

const myDonTick = ref(0);
const myDonErrored = ref(false);
const bindingInput = ref("");
const preparing = ref(false);
const confirming = ref(false);
const switchingId = ref<number | null>(null);
const deletingId = ref<number | null>(null);
const uploading = ref(false);
const removingAvatar = ref(false);

const { data, pending, refresh } = await useAsyncData<ProfilePayload>(
  "account-profile",
  () => $fetch("/api/account/profile", { headers }),
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
      verificationStatus: {
        emailVerified: false,
        taikoVerified: false
      }
    })
  }
);

const profile = computed(() => data.value);
const myDonUrl = computed(() => {
  if (!profile.value?.currentBinding) return "";
  return `/api/account/my-don?t=${myDonTick.value}`;
});

const refreshProfile = async () => {
  await refresh();
  await fetchCurrentUser(true);
  myDonTick.value += 1;
  myDonErrored.value = false;
};

const handleAvatarUpload = async (options: any) => {
  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append("avatar", options.file);
    await $fetch("/api/account/avatar", {
      method: "POST",
      body: formData
    });
    ElMessage.success("头像已更新");
    await refreshProfile();
    options.onSuccess?.({}, options.file);
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "头像上传失败");
    options.onError?.(error);
  } finally {
    uploading.value = false;
  }
};

const removeAvatar = async () => {
  removingAvatar.value = true;
  try {
    await $fetch("/api/account/avatar", {
      method: "DELETE"
    });
    ElMessage.success("头像已恢复默认");
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "头像删除失败");
  } finally {
    removingAvatar.value = false;
  }
};

const prepareBinding = async () => {
  if (!bindingInput.value.trim() || preparing.value) return;
  preparing.value = true;
  try {
    const result = await $fetch<{ message: string }>("/api/account/bindings/prepare", {
      method: "POST",
      body: { taikoId: bindingInput.value.trim() }
    });
    ElMessage.success(result.message);
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "绑定验证启动失败");
  } finally {
    preparing.value = false;
  }
};

const confirmBinding = async (taikoId?: string | null) => {
  const target = taikoId || profile.value?.pendingBinding?.taikoId;
  if (!target || confirming.value) return;
  confirming.value = true;
  try {
    await $fetch("/api/account/bindings/confirm", {
      method: "POST",
      body: { taikoId: target }
    });
    ElMessage.success("绑定成功，当前已切换到该 ID");
    bindingInput.value = "";
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "绑定确认失败");
  } finally {
    confirming.value = false;
  }
};

const switchBinding = async (bindingId: number) => {
  if (switchingId.value === bindingId) return;
  switchingId.value = bindingId;
  try {
    await $fetch("/api/account/bindings/current", {
      method: "POST",
      body: { bindingId }
    });
    ElMessage.success("当前绑定 ID 已切换");
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "绑定切换失败");
  } finally {
    switchingId.value = null;
  }
};

const deleteBinding = async (binding: NonNullable<ProfilePayload["bindings"]>[number]) => {
  if (deletingId.value === binding.id) return;

  const isLastBinding = (profile.value?.bindings.length || 0) <= 1;
  try {
    await ElMessageBox.confirm(`确定删除绑定的鼓众 ID ${binding.taikoId} 吗？`, "删除绑定", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消"
    });

    if (isLastBinding) {
      await ElMessageBox.confirm(
        `这是你最后一个鼓众 ID。删除后，网页中的当前绑定、我的小咚和歌曲数据入口都会失去关联，请再次确认。`,
        "二次确认",
        {
          type: "error",
          confirmButtonText: "确认删除最后一个绑定",
          cancelButtonText: "取消"
        }
      );
    }
  } catch {
    return;
  }

  deletingId.value = binding.id;
  try {
    await $fetch("/api/account/bindings/remove", {
      method: "POST",
      body: {
        bindingId: binding.id,
        force: isLastBinding
      }
    });
    ElMessage.success("绑定已删除");
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "绑定删除失败");
  } finally {
    deletingId.value = null;
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
        <el-card class="panel-card profile-main-card">
          <div class="profile-main">
            <div class="avatar-block">
              <el-avatar :size="132" :src="profile.user.avatarUrl" class="profile-avatar">
                {{ profile.user.username.slice(0, 1) }}
              </el-avatar>
              <div class="avatar-actions">
                <el-upload
                  :show-file-list="false"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  :http-request="handleAvatarUpload"
                >
                  <el-button :loading="uploading">上传头像</el-button>
                </el-upload>
                <el-button plain :loading="removingAvatar" @click="removeAvatar">恢复默认</el-button>
              </div>
            </div>
            <div class="profile-info">
              <h2>{{ profile.user.username }}</h2>
              <p>{{ profile.user.email }}</p>
              <div class="status-list">
                <div class="status-chip" :class="profile.verificationStatus.emailVerified ? 'ok' : 'pending'">
                  <span>邮箱认证</span>
                  <strong>{{ profile.verificationStatus.emailVerified ? "已验证" : "未验证" }}</strong>
                </div>
                <div class="status-chip" :class="profile.verificationStatus.taikoVerified ? 'ok' : 'pending'">
                  <span>鼓众 ID 认证</span>
                  <strong>{{ profile.verificationStatus.taikoVerified ? "已认证" : "未认证" }}</strong>
                </div>
              </div>
              <div class="meta-grid">
                <div>
                  <span>当前绑定 ID</span>
                  <strong>{{ profile.currentBinding?.taikoId || "未绑定" }}</strong>
                </div>
                <div>
                  <span>当前称号</span>
                  <strong>{{ profile.currentBinding?.verifiedTitle || "-" }}</strong>
                </div>
                <div>
                  <span>注册时间</span>
                  <strong>{{ new Date(profile.user.createdAt).toLocaleString() }}</strong>
                </div>
              </div>
            </div>
          </div>
        </el-card>

        <el-card class="panel-card binding-card">
          <div class="section-title">
            <h3>绑定鼓众广场 ID</h3>
            <p>输入新的鼓众 ID 后，系统会记录你当前的称号，修改称号后再确认即可完成绑定。</p>
          </div>
          <div class="bind-input-row">
            <el-input v-model="bindingInput" placeholder="输入鼓众广场 ID" />
            <el-button type="primary" :loading="preparing" @click="prepareBinding">开始验证</el-button>
          </div>
          <div v-if="profile.pendingBinding" class="pending-box">
            <div>
              <strong>待确认 ID：</strong>{{ profile.pendingBinding.taikoId }}
            </div>
            <div>
              <strong>记录称号：</strong>{{ profile.pendingBinding.originalTitle || "（空）" }}
            </div>
            <div>
              <strong>到期时间：</strong>{{ new Date(profile.pendingBinding.expiresAt).toLocaleString() }}
            </div>
            <el-button type="success" :loading="confirming" @click="confirmBinding()">我已修改称号，立即确认</el-button>
          </div>
          <el-empty v-if="!profile.bindings.length" description="当前还没有已验证的鼓众 ID" />
          <div v-else class="binding-list">
            <div v-for="binding in profile.bindings" :key="binding.id" class="binding-item">
              <div>
                <strong>{{ binding.taikoId }}</strong>
                <p>{{ binding.verifiedTitle || "-" }}</p>
              </div>
              <div class="binding-actions">
                <el-button
                  :type="binding.isCurrent ? 'primary' : 'default'"
                  :loading="switchingId === binding.id"
                  @click="switchBinding(binding.id)"
                >
                  {{ binding.isCurrent ? "当前使用" : "切换为当前" }}
                </el-button>
                <el-button
                  type="danger"
                  plain
                  :loading="deletingId === binding.id"
                  @click="deleteBinding(binding)"
                >
                  删除绑定
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </section>

      <el-card class="panel-card mydon-card">
        <div class="section-title">
          <h3>我的小咚</h3>
          <p>当前展示内容来自本地 `userdata` 数据；切换当前绑定 ID 后会同步刷新。</p>
        </div>
        <div v-if="!profile.currentBinding" class="mydon-empty">
          <el-empty description="请先绑定鼓众广场 ID" />
        </div>
        <div v-else-if="!myDonErrored" class="mydon-frame">
          <img :src="myDonUrl" alt="我的小咚" class="mydon-image" @error="myDonErrored = true" />
        </div>
        <div v-else class="mydon-empty">
          <el-empty description="我的小咚生成失败，请稍后重试" />
        </div>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.profile-page {
  display: grid;
  gap: 18px;
}

.profile-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr);
  gap: 18px;
}

.profile-main {
  display: grid;
  grid-template-columns: auto 1fr;
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

.profile-info h2 {
  margin: 0;
  font-size: 30px;
}

.profile-info p {
  margin: 6px 0 18px;
  color: #7d6a5a;
}

.status-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.status-chip {
  min-width: 150px;
  padding: 12px 14px;
  border-radius: 14px;
  display: grid;
  gap: 4px;
}

.status-chip.ok {
  background: rgba(121, 197, 135, 0.16);
}

.status-chip.pending {
  background: rgba(233, 174, 77, 0.16);
}

.status-chip span,
.meta-grid span {
  color: #7d6a5a;
  font-size: 13px;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.meta-grid div {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 248, 240, 0.8);
  display: grid;
  gap: 4px;
}

.section-title h3 {
  margin: 0;
  font-size: 22px;
}

.section-title p {
  margin: 6px 0 16px;
  color: #7d6a5a;
  line-height: 1.7;
}

.bind-input-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  margin-bottom: 14px;
}

.pending-box {
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 247, 218, 0.8);
  margin-bottom: 14px;
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
  background: rgba(255, 248, 240, 0.78);
}

.binding-item p {
  margin: 6px 0 0;
  color: #7d6a5a;
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
  background: linear-gradient(135deg, rgba(255, 244, 232, 0.8), rgba(255, 255, 255, 0.9));
  padding: 12px;
}

.mydon-image {
  width: 100%;
  display: block;
  border-radius: 14px;
}

@media (max-width: 1100px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .profile-main {
    grid-template-columns: 1fr;
  }

  .meta-grid {
    grid-template-columns: 1fr;
  }

  .bind-input-row {
    grid-template-columns: 1fr;
  }

  .binding-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .binding-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
