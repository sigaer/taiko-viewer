// The content of /grade/2023 and /grade/2024 (one course each, written into the page templates until slice F), kept
// word for word in the shape of the 2025 / 2026 data files so both years render through the same dan course
// component. The two years differ only in the year row of the navigation table.
import type { GradePage } from "~/utils/rework/dan";

const songsHtml =
  '<ul class="list1"><li>楽曲情報<div class="h-scrollable"><table><thead><tr><td colspan="2" style="text-align: center;">曲名</td><td style="text-align: center;">難易度</td><td style="text-align: center;">最大コンボ数</td><td style="text-align: center;">BPM</td></tr></thead>' +
  '<tfoot><tr><td colspan="2" style="text-align: center;"><strong>合計</strong></td><td style="text-align: center;">-</td><td style="text-align: center;"><strong>1961</strong></td><td style="text-align: center;">-</td></tr></tfoot>' +
  '<tbody><tr><td style="text-align: center;">1曲目</td><td style="text-align: center;"><a href="#" class="rel-wiki-page">GO GET\'EM!(裏譜面)</a></td><td style="text-align: center;">おに★×9</td><td style="text-align: center;">648</td><td style="text-align: center;">146</td></tr>' +
  '<tr><td style="text-align: center;">2曲目</td><td style="text-align: center;"><a href="#" class="rel-wiki-page">RIDGE RACER STEPS</a></td><td style="text-align: center;">おに★×9</td><td style="text-align: center;">536</td><td style="text-align: center;">240</td></tr>' +
  '<tr><td style="text-align: center;">3曲目</td><td style="text-align: center;"><a href="#" class="rel-wiki-page">よーいドン！</a></td><td style="text-align: center;">おに★×10</td><td style="text-align: center;">777</td><td style="text-align: center;">6.06-194</td></tr></tbody></table></div></li></ul>';

const conditionsHtml =
  '<ul class="list1"><li>合格条件<div class="h-scrollable"><table><thead><tr><td style="text-align: center;"></td><td style="text-align: center;">条件1</td><td style="text-align: center;">条件2</td><td style="text-align: center;">条件3</td><td style="text-align: center;">条件4</td></tr></thead>' +
  '<tbody><tr><td rowspan="3" style="background-color: #e42112; color: black; text-align: center;"><strong>合格条件</strong></td><td rowspan="3" style="text-align: center;"><strong>魂ゲージ100%</strong></td><td rowspan="3" style="text-align: center;"><strong>可107未満</strong></td><td rowspan="3" style="text-align: center;"><strong>不可7未満</strong></td><td style="text-align: center;"><strong>連打数0打</strong></td></tr>' +
  '<tr><td style="text-align: center;"><strong>連打数77打以上</strong></td></tr><tr><td style="text-align: center;"><strong>連打数24打以上</strong></td></tr></tbody></table></div></li></ul>';

const pending = '<ul class="list1"><li>内容待补充。</li></ul>';

export function legacyGradePage(year: "2023" | "2024"): GradePage {
  const previous = year === "2023" ? "ニジイロ2022" : "ニジイロ2023";
  return {
    slug: "九段",
    title: `虹段位道场 ${year}`,
    displayTitle: "九段 NINTH DAN",
    sourceUrl: "",
    lastModified: "Last-modified: -",
    navigationHtml:
      '<div class="h-scrollable"><table><thead><tr><td>←前へ</td><td></td><td>次へ→</td></tr></thead><tbody>' +
      '<tr><td><a href="#" class="rel-wiki-page">八段</a></td><td><strong>九段 NINTH DAN</strong></td><td><a href="#" class="rel-wiki-page">十段</a></td></tr>' +
      `<tr><td><a href="#" class="rel-wiki-page">${previous}</a></td><td>ニジイロ${year}</td><td>-</td></tr></tbody></table></div>`,
    sections: [
      { title: "详细", blocks: [{ type: "ul", html: songsHtml }, { type: "ul", html: conditionsHtml }] },
      { title: "攻略", blocks: [], tabs: ["1曲目", "2曲目", "3曲目"].map((title) => ({ title, html: pending })) },
      { title: "対策・合格の目安", blocks: [{ type: "ul", html: pending }] },
      { title: "その他", blocks: [{ type: "ul", html: pending }] }
    ]
  };
}
