<script setup lang="ts">
import { ElMessage } from "element-plus";
import type { ForumSection } from "~/types/forum";

type UploadedImage = {
  imageUrl: string;
  caption: string;
};

const router = useRouter();
const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

const pageMeta = {
  title: "发布新帖",
  desc: "发布图文攻略、晒分战报或一般讨论。"
};

definePageMeta({
  middleware: "account-auth",
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/forum",
  breadcrumbs: [
    { label: "论坛社区", to: "/forum" },
    { label: "发布新帖", to: "/forum/new" }
  ]
});

useSeoMeta({
  title: pageMeta.title,
  description: pageMeta.desc
});

const form = reactive({
  sectionSlug: "score-guides",
  threadType: "guide",
  title: "",
  summary: "",
  tagsInput: "",
  songId: "",
  difficultyType: "",
  level: "",
  paragraphDraft: ""
});

const paragraphBlocks = ref<string[]>([]);
const imageBlocks = ref<UploadedImage[]>([]);
const uploading = ref(false);
const submitting = ref(false);

const { data: sectionsData } = await useAsyncData<{ items: ForumSection[] }>(
  "forum-new-sections",
  () => $fetch("/api/forum/sections", { headers }),
  {
    default: () => ({ items: [] })
  }
);

const threadTypeTips: Record<string, string> = {
  discussion: "适合普通交流、提问和经验分享。",
  guide: "适合写谱面思路、手法拆解和练习路线。",
  achievement: "适合晒分、全良战报和冲分复盘。",
  official: "仅供站务/版主用途。"
};

const addParagraph = () => {
  if (!form.paragraphDraft.trim()) return;
  paragraphBlocks.value.push(form.paragraphDraft.trim());
  form.paragraphDraft = "";
};

const removeParagraph = (index: number) => {
  paragraphBlocks.value.splice(index, 1);
};

const removeImage = (index: number) => {
  imageBlocks.value.splice(index, 1);
};

const uploadImage = async (options: any) => {
  uploading.value = true;
  try {
    const body = new FormData();
    body.append("image", options.file);
    const result = await $fetch<{ imageUrl: string }>("/api/forum/media/images", {
      method: "POST",
      body
    });
    imageBlocks.value.push({
      imageUrl: result.imageUrl,
      caption: ""
    });
    ElMessage.success("图片上传完成");
    options.onSuccess?.(result, options.file);
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "图片上传失败");
    options.onError?.(error);
  } finally {
    uploading.value = false;
  }
};

const submit = async () => {
  if (submitting.value) return;
  if (form.paragraphDraft.trim()) {
    addParagraph();
  }
  const contentBlocks = [
    ...paragraphBlocks.value.map((text) => ({ type: "paragraph" as const, text })),
    ...imageBlocks.value.map((image) => ({
      type: "image" as const,
      imageUrl: image.imageUrl,
      caption: image.caption || undefined
    }))
  ];
  if (!contentBlocks.length) {
    ElMessage.error("至少需要一段正文或一张图片");
    return;
  }
  submitting.value = true;
  try {
    const thread = await $fetch<{ id: number }>("/api/forum/threads", {
      method: "POST",
      body: {
        sectionSlug: form.sectionSlug,
        threadType: form.threadType,
        title: form.title,
        summary: form.summary,
        tags: form.tagsInput
          .split(/[\s,，#]+/)
          .map((item) => item.trim())
          .filter(Boolean),
        songId: form.songId || undefined,
        difficultyType: form.difficultyType || undefined,
        level: form.level || undefined,
        contentBlocks
      }
    });
    ElMessage.success("帖子已发布");
    await router.push(`/forum/thread/${thread.id}`);
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "发帖失败");
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="forum-new-page">
    <section class="panel-card composer-panel">
      <div class="composer-panel__head">
        <div>
          <h2>发布新帖</h2>
          <p>{{ threadTypeTips[form.threadType] }}</p>
        </div>
        <NuxtLink to="/forum" class="composer-back-link">返回论坛</NuxtLink>
      </div>

      <el-form label-position="top">
        <div class="composer-grid">
          <el-form-item label="版块">
            <el-select v-model="form.sectionSlug">
              <el-option v-for="section in sectionsData.items" :key="section.id" :label="section.name" :value="section.slug" />
            </el-select>
          </el-form-item>
          <el-form-item label="帖子类型">
            <el-select v-model="form.threadType">
              <el-option label="讨论" value="discussion" />
              <el-option label="攻略" value="guide" />
              <el-option label="战报" value="achievement" />
              <el-option label="公告" value="official" />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="标题">
          <el-input v-model="form.title" maxlength="120" show-word-limit placeholder="例如：虹2025 三曲段过段思路整理" />
        </el-form-item>

        <el-form-item label="摘要">
          <el-input v-model="form.summary" maxlength="280" show-word-limit placeholder="不填则自动从首段正文提取" />
        </el-form-item>

        <el-form-item label="标签">
          <el-input v-model="form.tagsInput" placeholder="用空格或逗号分隔，如：段位 全良 配速" />
        </el-form-item>

        <div class="composer-grid composer-grid--song">
          <el-form-item label="关联曲目 ID">
            <el-input v-model="form.songId" placeholder="可选，用于攻略或战报贴" />
          </el-form-item>
          <el-form-item label="关联难度">
            <el-select v-model="form.difficultyType" clearable>
              <el-option label="简单" value="1" />
              <el-option label="普通" value="2" />
              <el-option label="困难" value="3" />
              <el-option label="魔王" value="4" />
              <el-option label="里谱" value="5" />
            </el-select>
          </el-form-item>
          <el-form-item label="星级">
            <el-input v-model="form.level" placeholder="例如 10" />
          </el-form-item>
        </div>

        <section class="block-editor">
          <div class="block-editor__head">
            <h3>正文段落</h3>
            <span>{{ paragraphBlocks.length }} 段</span>
          </div>
          <el-input
            v-model="form.paragraphDraft"
            type="textarea"
            :rows="5"
            maxlength="4000"
            show-word-limit
            placeholder="输入一段正文，点击加入正文后进入内容序列"
          />
          <div class="block-editor__actions">
            <el-button type="primary" plain @click="addParagraph">加入正文</el-button>
          </div>
          <div class="block-list">
            <div v-for="(text, index) in paragraphBlocks" :key="`paragraph-${index}`" class="block-list__item">
              <p>{{ text }}</p>
              <el-button text @click="removeParagraph(index)">移除</el-button>
            </div>
          </div>
        </section>

        <section class="block-editor">
          <div class="block-editor__head">
            <h3>插图</h3>
            <span>{{ imageBlocks.length }} 张</span>
          </div>
          <el-upload :show-file-list="false" :http-request="uploadImage" accept="image/*">
            <el-button :loading="uploading">上传图片</el-button>
          </el-upload>
          <div class="image-grid">
            <div v-for="(image, index) in imageBlocks" :key="image.imageUrl" class="image-card">
              <img :src="image.imageUrl" alt="论坛插图" />
              <el-input v-model="image.caption" maxlength="120" placeholder="图片说明（可选）" />
              <el-button text @click="removeImage(index)">移除图片</el-button>
            </div>
          </div>
        </section>

        <div class="composer-submit">
          <el-button type="primary" :loading="submitting" @click="submit">发布主题</el-button>
        </div>
      </el-form>
    </section>
  </div>
</template>

<style scoped>
.forum-new-page {
  display: flex;
  justify-content: center;
}

.composer-panel {
  width: min(980px, 100%);
  padding: 22px;
}

.composer-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.composer-panel__head h2 {
  margin: 0;
  font-size: 32px;
}

.composer-panel__head p {
  margin: 8px 0 0;
  color: #745d4a;
  line-height: 1.8;
}

.composer-back-link {
  color: #b25237;
  text-decoration: none;
}

.composer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.composer-grid--song {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.block-editor {
  display: grid;
  gap: 12px;
  padding: 18px;
  margin-top: 10px;
  border-radius: 22px;
  background: rgba(255, 249, 242, 0.9);
}

.block-editor__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.block-editor__head h3 {
  margin: 0;
  font-size: 18px;
}

.block-editor__head span {
  color: #866957;
  font-size: 12px;
}

.block-editor__actions,
.composer-submit {
  display: flex;
  justify-content: flex-end;
}

.block-list,
.image-grid {
  display: grid;
  gap: 12px;
}

.block-list__item,
.image-card {
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.88);
}

.block-list__item p {
  margin: 0 0 10px;
  white-space: pre-wrap;
  line-height: 1.8;
}

.image-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.image-card {
  display: grid;
  gap: 10px;
}

.image-card img {
  width: 100%;
  border-radius: 18px;
}

body.theme-dark .composer-panel__head p,
body.theme-dark .block-editor__head span {
  color: #c6b2a4;
}

body.theme-dark .block-editor {
  background: rgba(50, 36, 29, 0.68);
}

body.theme-dark .block-list__item,
body.theme-dark .image-card {
  background: rgba(30, 23, 20, 0.74);
}

@media (max-width: 860px) {
  .composer-panel__head,
  .composer-grid,
  .composer-grid--song {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .image-grid {
    grid-template-columns: 1fr;
  }
}
</style>
