<script setup lang="ts">
import { buildPageDescription } from "~/utils/seo";

const pageMeta = {
  title: "虹段位道场 2024",
  desc: buildPageDescription("太鼓达人虹段位道场 2024 入口，查看各级段位课题曲与合格条件。")
};

const dojoTitle = "虹段位道场 2024";

definePageMeta({
  contentLayout: "wide",
  pageTitle: "段位查询",
  pageDesc: "虹 2024",
  navKey: "/grade/2024",
  breadcrumbs: [{ label: "段位查询", to: "/grade/2025" }, { label: "虹 2024", to: "/grade/2024" }]
});

useViewerSeo({
  title: pageMeta.title,
  description: pageMeta.desc,
  path: "/grade/2024",
  keywords: ["段位查询", "虹段位道场", "2024"]
});
</script>

<template>
  <div id="body" class="grade-body">
    <div id="title" class="grade-title">
      <h1 class="title">{{ dojoTitle }}</h1>
      <div id="lastmodified" class="lastmodified">Last-modified: -</div>
    </div>
    <div id="content" class="grade-content">
      <div class="h-scrollable">
        <table class="nav-table">
          <thead>
            <tr>
              <td style="text-align: left; width: 999px;">←前へ</td>
              <td style="text-align: center; width: 999px;"></td>
              <td style="text-align: right; width: 999px;">次へ→</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: left; width: 999px;"><a href="#" class="rel-wiki-page">八段</a></td>
              <td style="text-align: center; width: 999px;"><strong>九段 NINTH DAN</strong></td>
              <td style="text-align: right; width: 999px;"><a href="#" class="rel-wiki-page">十段</a></td>
            </tr>
            <tr>
              <td style="text-align: left; width: 999px;"><a href="#" class="rel-wiki-page">ニジイロ2023</a></td>
              <td style="text-align: center; width: 999px;">ニジイロ2024</td>
              <td style="text-align: right; width: 999px;">-</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="h3_content_1_0" class="heading-with-anchor-link">详细</h3>
      <ul class="list1">
        <li>
          楽曲情報
          <div class="h-scrollable">
            <table>
              <thead>
                <tr>
                  <td colspan="2" style="text-align: center;">曲名</td>
                  <td style="text-align: center;">難易度</td>
                  <td style="text-align: center;">最大コンボ数</td>
                  <td style="text-align: center;">BPM</td>
                </tr>
              </thead>
              <tfoot>
                <tr>
                  <td colspan="2" style="text-align: center;"><strong>合計</strong></td>
                  <td style="text-align: center;">-</td>
                  <td style="text-align: center;"><strong>1961</strong></td>
                  <td style="text-align: center;">-</td>
                </tr>
              </tfoot>
              <tbody>
                <tr>
                  <td style="text-align: center;">1曲目</td>
                  <td style="text-align: center;"><a href="#" class="rel-wiki-page">GO GET'EM!(裏譜面)</a></td>
                  <td style="text-align: center;">おに★×9</td>
                  <td style="text-align: center;">648</td>
                  <td style="text-align: center;">146</td>
                </tr>
                <tr>
                  <td style="text-align: center;">2曲目</td>
                  <td style="text-align: center;"><a href="#" class="rel-wiki-page">RIDGE RACER STEPS</a></td>
                  <td style="text-align: center;">おに★×9</td>
                  <td style="text-align: center;">536</td>
                  <td style="text-align: center;">240</td>
                </tr>
                <tr>
                  <td style="text-align: center;">3曲目</td>
                  <td style="text-align: center;"><a href="#" class="rel-wiki-page">よーいドン！</a></td>
                  <td style="text-align: center;">おに★×10</td>
                  <td style="text-align: center;">777</td>
                  <td style="text-align: center;">6.06-194</td>
                </tr>
              </tbody>
            </table>
          </div>
        </li>
      </ul>
      <ul class="list1">
        <li>
          合格条件
          <div class="h-scrollable">
            <table>
              <thead>
                <tr>
                  <td style="text-align: center;"></td>
                  <td style="text-align: center;">条件1</td>
                  <td style="text-align: center;">条件2</td>
                  <td style="text-align: center;">条件3</td>
                  <td style="text-align: center;">条件4</td>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td rowspan="3" style="background-color: #e42112; color: black; text-align: center;">
                    <strong>合格条件</strong>
                  </td>
                  <td rowspan="3" style="text-align: center;"><strong>魂ゲージ100%</strong></td>
                  <td rowspan="3" style="text-align: center;"><strong>可107未満</strong></td>
                  <td rowspan="3" style="text-align: center;"><strong>不可7未満</strong></td>
                  <td style="text-align: center;"><strong>連打数0打</strong></td>
                </tr>
                <tr>
                  <td style="text-align: center;"><strong>連打数77打以上</strong></td>
                </tr>
                <tr>
                  <td style="text-align: center;"><strong>連打数24打以上</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </li>
      </ul>

      <h3 id="h3_content_1_1" class="heading-after-first heading-with-anchor-link">攻略</h3>
      <div class="tab-container">
        <div class="tabs left">
          <ul>
            <li class="tab active"><button type="button" title="1曲目">1曲目</button></li>
            <li class="tab"><button type="button" title="2曲目">2曲目</button></li>
            <li class="tab"><button type="button" title="3曲目">3曲目</button></li>
            <li class="spacer"></li>
          </ul>
        </div>
        <div class="tab-contents">
          <div class="tab-content">
            <ul class="list1">
              <li>内容待补充。</li>
            </ul>
          </div>
        </div>
      </div>

      <h3 id="h3_content_1_2" class="heading-after-first heading-with-anchor-link">対策・合格の目安</h3>
      <ul class="list1">
        <li>内容待补充。</li>
      </ul>

      <h3 id="h3_content_1_3" class="heading-after-first heading-with-anchor-link">その他</h3>
      <ul class="list1">
        <li>内容待补充。</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.grade-body {
  width: 100%;
  margin: 0 auto;
  padding: 24px 28px 40px;
  background:var(--viewer-surface-subtle);
  border-radius: 18px;
  box-shadow:0 18px 32px var(--viewer-shadow);
}

.grade-title {
  border-bottom: 1px solid var(--viewer-border);
  padding-bottom: 12px;
  margin-bottom: 20px;
}

.title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
  color:var(--viewer-text);
}

.lastmodified {
  font-size: 12px;
  color:var(--viewer-text-muted);
}

.grade-content {
  min-height: 200px;
}

.h-scrollable {
  overflow-x: auto;
  margin-bottom: 18px;
}

.nav-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.nav-table td {
  padding: 10px 8px;
  border-bottom: 1px solid var(--viewer-border);
}

.grade-content table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.grade-content td {
  padding: 6px 8px;
  border: 1px solid var(--viewer-border);
}

.heading-with-anchor-link,
.heading-after-first {
  margin: 16px 0 10px;
  font-size: 16px;
  color:var(--viewer-text);
}

.list1 {
  margin: 0 0 16px;
  padding-left: 18px;
  color:var(--viewer-text);
  font-size: 13px;
}

.tab-container {
  border: 1px solid rgba(165, 138, 110, 0.25);
  border-radius: 12px;
  padding: 12px;
  background:var(--viewer-surface-subtle);
  margin-bottom: 16px;
}

.tabs ul {
  list-style: none;
  display: flex;
  gap: 8px;
  padding: 0;
  margin: 0 0 12px;
}

.tab button {
  border: none;
  background:#f6efe6;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  color:#5a4a3b;
  cursor: default;
}

.tab.active button {
  background:#eddcc9;
  font-weight: 600;
}

.rel-wiki-page {
  color:inherit;
  text-decoration: none;
}
</style>
