<script setup lang="ts">
import { computed } from "vue";
import { buildPageDescription } from "~/utils/seo";

const { locale } = useI18n();

definePageMeta({
  pageTitle: "网页成绩 token",
  pageDesc: "网页成绩 token 用户指南与开发者 API 文档",
  navKey: "/account/sync",
  breadcrumbs: [
    { label: "多端同步", to: "/account/sync" },
    { label: "网页成绩 token", to: "/docs/score-token" }
  ]
});

useViewerSeo(() => ({
  title: locale.value === "ja" ? "Web スコア token" : "网页成绩 token",
  description: buildPageDescription(
    locale.value === "ja"
      ? "Web スコア token の利用ガイドと開発者向け API リファレンス"
      : "网页成绩 token 用户指南与开发者 API 文档"
  ),
  path: "/docs/score-token",
  keywords: ["scoretoken", "网页成绩 token", "太鼓成绩 API"]
}));

const copy = computed(() =>
  locale.value === "ja"
    ? {
        title: "Web スコア token",
        lead: "連携中の太鼓 ID の最新 userdata を、許可したサイトやツールから読み取るための秘密キーです。",
        userTitle: "ユーザーガイド",
        steps: [
          "Viewer にログインし、「アカウント > 多端同期」を開きます。",
          "対象の太鼓 ID が現在の連携先になっていることを確認します。",
          "「token を発行」を押し、今回だけ表示される 48 文字の token を利用先へ登録します。",
          "漏えいした可能性がある場合は、同じ画面で更新または無効化します。"
        ],
        safetyTitle: "安全上の注意",
        safety: "token はスコア閲覧用パスワードと同等です。公開チャット、スクリーンショット、ソースコード、公開リポジトリには載せないでください。更新すると旧 token は直ちに無効になります。",
        devTitle: "開発者 API",
        requestTitle: "リクエスト",
        responseTitle: "成功レスポンス",
        errorsTitle: "主なエラー",
        notesTitle: "実装上の注意",
        notes: [
          "ブラウザから直接呼び出せる CORS 対応 API ですが、バックエンド経由の利用を推奨します。",
          "レスポンス前に最新スコアの取得を試みるため、連続リクエストは避け、短時間キャッシュを設けてください。",
          "token をログ、分析イベント、URL クエリに記録しないでください。"
        ],
        back: "多端同期に戻る"
      }
    : {
        title: "网页成绩 token",
        lead: "它是一把只读密钥，让你授权的网页、工具或服务读取当前绑定太鼓 ID 的最新完整 userdata。",
        userTitle: "用户使用指南",
        steps: [
          "登录 Viewer，进入“个人账户 > 多端同步”。",
          "确认页面顶部显示的是你要授权的当前绑定 ID。",
          "点击“生成 token”，立即保存本次唯一展示的 48 位 token，并填写到需要接入的应用中。",
          "怀疑泄露时，在同一页面轮换或撤销 token；旧 token 会立即失效。"
        ],
        safetyTitle: "安全须知",
        safety: "token 等同于成绩读取密码。不要发到群聊、截图、前端源码或公开仓库。Viewer 和 bot 管理的是同一个 token，在任意一端重新生成都会让旧 token 失效。",
        devTitle: "开发者 API",
        requestTitle: "请求",
        responseTitle: "成功响应",
        errorsTitle: "常见错误",
        notesTitle: "接入约束",
        notes: [
          "接口支持 CORS，可由浏览器直接请求；有后端时建议服务端代调用，减少 token 暴露。",
          "接口返回前会尝试拉取最新成绩。请避免高频轮询，并在业务侧设置短时间缓存。",
          "不要把 token 写入日志、埋点、URL 查询参数或错误上报。"
        ],
        back: "返回多端同步"
      }
);

const requestExample = `curl -X POST "https://sakura-bot.cn/api/public-score/by-token" \\
  -H "Content-Type: application/json" \\
  -d '{"token":"用户的48位token"}'`;

const responseExample = `{
  "ok": true,
  "taikoId": "2258735",
  "fetchedAt": "2026-08-05T12:30:20Z",
  "data": {
    "profile": {},
    "songs": [],
    "achievement": {}
  }
}`;
</script>

<template>
  <article class="token-docs">
    <header class="docs-header">
      <p class="docs-kicker">Sakura Taiko Viewer / scoretoken</p>
      <h1>{{ copy.title }}</h1>
      <p>{{ copy.lead }}</p>
      <NuxtLink class="back-link" to="/account/sync">{{ copy.back }}</NuxtLink>
    </header>

    <section class="docs-section">
      <h2>{{ copy.userTitle }}</h2>
      <ol class="step-list">
        <li v-for="(step, index) in copy.steps" :key="step">
          <span>{{ index + 1 }}</span>
          <p>{{ step }}</p>
        </li>
      </ol>
      <aside class="safety-note">
        <strong>{{ copy.safetyTitle }}</strong>
        <p>{{ copy.safety }}</p>
      </aside>
    </section>

    <section class="docs-section api-section">
      <h2>{{ copy.devTitle }}</h2>
      <div class="api-facts">
        <div><span>Method</span><strong>POST</strong></div>
        <div><span>Endpoint</span><code>https://sakura-bot.cn/api/public-score/by-token</code></div>
        <div><span>Content-Type</span><code>application/json</code></div>
      </div>

      <h3>{{ copy.requestTitle }}</h3>
      <pre><code>{{ requestExample }}</code></pre>
      <h3>{{ copy.responseTitle }}</h3>
      <pre><code>{{ responseExample }}</code></pre>

      <h3>{{ copy.errorsTitle }}</h3>
      <div class="error-table">
        <div><code>400</code><span>请求体或 token 字段不合法</span></div>
        <div><code>401</code><span>token 无效、已轮换或已撤销</span></div>
        <div><code>404</code><span>绑定 ID 或本地成绩不存在</span></div>
        <div><code>502</code><span>上游成绩拉取失败</span></div>
      </div>

      <h3>{{ copy.notesTitle }}</h3>
      <ul>
        <li v-for="note in copy.notes" :key="note">{{ note }}</li>
      </ul>
    </section>
  </article>
</template>

<style scoped>
.token-docs {
  display: grid;
  gap: 28px;
  width: 100%;
  min-width: 0;
  max-width: 980px;
  margin: 0 auto;
}

.docs-header {
  padding: 30px 0 24px;
  border-bottom: 2px solid #d45b4d;
}

.docs-kicker {
  margin: 0 0 10px;
  color: #a0443a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
}

.docs-header h1 {
  margin: 0;
  color: #3f332b;
  font-size: 42px;
  letter-spacing: 0;
}

.docs-header > p:not(.docs-kicker) {
  max-width: 760px;
  margin: 14px 0;
  color: #6f5d50;
  font-size: 17px;
  line-height: 1.8;
}

.back-link {
  color: var(--el-color-primary);
  font-weight: 600;
}

.docs-section {
  min-width: 0;
  padding-bottom: 28px;
  border-bottom: 1px solid rgba(125, 106, 90, 0.22);
}

.docs-section h2 {
  margin: 0 0 18px;
  color: #3f332b;
  font-size: 25px;
}

.docs-section h3 {
  margin: 26px 0 10px;
  color: #4b3d34;
  font-size: 17px;
}

.step-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step-list li {
  display: grid;
  grid-template-columns: 34px 1fr;
  align-items: start;
  gap: 12px;
}

.step-list li > span {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  background: #d45b4d;
  color: #fff;
  font-weight: 700;
}

.step-list p,
.safety-note p {
  margin: 2px 0 0;
  color: #625146;
  line-height: 1.8;
}

.safety-note {
  margin-top: 18px;
  padding: 16px 18px;
  border-left: 4px solid #d79a36;
  background: #fff8ea;
}

.api-facts {
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr) 180px;
  border: 1px solid rgba(125, 106, 90, 0.22);
  border-radius: 8px;
  overflow: hidden;
}

.api-facts > div {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 14px;
  background: rgba(255, 248, 240, 0.72);
}

.api-facts > div + div {
  border-left: 1px solid rgba(125, 106, 90, 0.22);
}

.api-facts span {
  color: #7d6a5a;
  font-size: 12px;
}

.api-facts code,
pre code,
.error-table code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0;
}

.api-facts code {
  overflow-wrap: anywhere;
}

.api-facts > div:last-child code {
  white-space: nowrap;
}

pre {
  overflow-x: auto;
  margin: 0;
  padding: 16px;
  border-radius: 8px;
  background: #2f2a27;
  color: #fffaf5;
  line-height: 1.7;
}

.error-table {
  display: grid;
  border-top: 1px solid rgba(125, 106, 90, 0.22);
}

.error-table > div {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(125, 106, 90, 0.22);
}

.docs-section ul {
  display: grid;
  gap: 8px;
  padding-left: 22px;
  color: #625146;
  line-height: 1.7;
}

@media (max-width: 720px) {
  .docs-header {
    padding-top: 12px;
  }

  .docs-header h1 {
    font-size: 30px;
  }

  .api-facts {
    grid-template-columns: 1fr;
  }

  .api-facts > div + div {
    border-top: 1px solid rgba(125, 106, 90, 0.22);
    border-left: 0;
  }
}
</style>
