<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<template>
  <div id="body" class="grade-body">
    <div id="title" class="grade-title">
      <h1 class="title">
        <span class="title-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M7 4h10v3a5 5 0 0 1-10 0V4z M5 6H3v1a4 4 0 0 0 4 4 M19 6h2v1a4 4 0 0 1-4 4 M9 18h6"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        {{ title }}
      </h1>
      <div id="lastmodified" class="lastmodified">Last-modified: -</div>
    </div>
    <div id="content" class="grade-content">
      <div class="h-scrollable">
        <table class="nav-table">
          <thead>
            <tr>
              <td class="nav-left">←前へ</td>
              <td class="nav-center"></td>
              <td class="nav-right">次へ→</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="nav-left"><a href="#" class="rel-wiki-page">八段</a></td>
              <td class="nav-center"><strong>九段 NINTH DAN</strong></td>
              <td class="nav-right"><a href="#" class="rel-wiki-page">十段</a></td>
            </tr>
            <tr>
              <td class="nav-left"><a href="#" class="rel-wiki-page">ニジイロ2024</a></td>
              <td class="nav-center">ニジイロ2025</td>
              <td class="nav-right">-</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="h3_content_1_0" class="heading-with-anchor-link">
        <span class="heading-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M5 7h14M5 12h14M5 17h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </span>
        详细
      </h3>
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

      <h3 id="h3_content_1_1" class="heading-after-first heading-with-anchor-link">
        <span class="heading-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M4.5 5.5h7.5a2 2 0 0 1 2 2v11H6.5a2 2 0 0 0-2 2v-15z M19.5 5.5h-7.5a2 2 0 0 0-2 2v11h7.5a2 2 0 0 1 2 2v-15z"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        攻略
      </h3>
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

      <h3 id="h3_content_1_2" class="heading-after-first heading-with-anchor-link">
        <span class="heading-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12l4 4L19 6"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        対策・合格の目安
      </h3>
      <ul class="list1">
        <li>内容待补充。</li>
      </ul>

      <h3 id="h3_content_1_3" class="heading-after-first heading-with-anchor-link">
        <span class="heading-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 8v4m0 4h.01M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </span>
        その他
      </h3>
      <ul class="list1">
        <li>内容待补充。</li>
      </ul>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.grade-body {
  max-width: 980px;
  margin: 0 auto;
  padding: 24px 28px 40px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 18px;
  box-shadow: 0 18px 32px rgba(165, 138, 110, 0.12);
}

.grade-title {
  border-bottom: 1px solid rgba(165, 138, 110, 0.2);
  padding-bottom: 12px;
  margin-bottom: 20px;
}

.title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
  color: #3b2f25;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.title-icon {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(196, 127, 79, 0.2);
  color: #9a6d47;
}

.title-icon svg {
  width: 14px;
  height: 14px;
}

.lastmodified {
  font-size: 12px;
  color: #7a6552;
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
  border-bottom: 1px solid rgba(165, 138, 110, 0.2);
}

.grade-content table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.grade-content td {
  padding: 6px 8px;
  border: 1px solid rgba(165, 138, 110, 0.2);
}

.heading-with-anchor-link,
.heading-after-first {
  margin: 16px 0 10px;
  font-size: 16px;
  color: #3b2f25;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.heading-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(196, 127, 79, 0.15);
  color: #9a6d47;
}

.heading-icon svg {
  width: 12px;
  height: 12px;
}

.list1 {
  margin: 0 0 16px;
  padding-left: 18px;
  color: #3b2f25;
  font-size: 13px;
}

.tab-container {
  border: 1px solid rgba(165, 138, 110, 0.25);
  border-radius: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.75);
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
  background: #f6efe6;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  color: #5a4a3b;
  cursor: default;
}

.tab.active button {
  background: #eddcc9;
  font-weight: 600;
}

.nav-left {
  text-align: left;
  color: #7a6552;
}

.nav-center {
  text-align: center;
  font-weight: 600;
  color: #3b2f25;
}

.nav-right {
  text-align: right;
  color: #7a6552;
}

.dojo-section {
  margin-bottom: 24px;
}

.section-title {
  margin: 0 0 10px;
  font-size: 16px;
  color: #3b2f25;
}

.section-body {
  min-height: 90px;
  border-radius: 12px;
  border: 1px dashed rgba(165, 138, 110, 0.35);
  background: rgba(255, 247, 238, 0.6);
  padding: 12px;
  display: grid;
  gap: 8px;
}

.placeholder-line {
  height: 10px;
  border-radius: 999px;
  background: rgba(199, 169, 144, 0.4);
}

.placeholder-line.short {
  width: 60%;
}
</style>
