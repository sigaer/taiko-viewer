import type { VersionSummaryHighScore, VersionSummaryPound, VersionSummarySpeedProfile } from "~/types/account-version-summary";

const hash = (value: string) => Array.from(value).reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 0);
const pick = <T>(items: T[], seed: string) => items[hash(seed) % items.length];

export const getPoundSpeedCopy = (pound: VersionSummaryPound | null | undefined, locale: "zh" | "ja" = "zh") => {
  if (!pound?.speed || pound.speed <= 0) {
    return locale === "ja"
      ? { title: "今年の最高秒速は、まだ記録されていません", body: "次の連打で、鼓面をもっと速い場所へ。" }
      : { title: "今年还没有记录到最高秒速", body: "等下一段连打，把鼓点推到更快的位置。" };
  }
  const seed = `${pound.topSong?.songNo || 0}:${pound.speed}`;
  const zh = ["今年最快的一首歌", "你的最高秒速，停在这一刻", "鼓槌冲到最快的那一刻"];
  const ja = ["今年いちばん速かった一曲", "あなたの最高秒速は、この瞬間に", "バチが最速へ駆け抜けた一打"];
  const bodyZh = ["不是每一次连打都会被记住，但这一秒足够快。", "这首歌记录了你今年最锋利的一次爆发。", "速度没有停在鼓面上，它冲进了年度记录。"];
  const bodyJa = ["すべての連打が残るわけじゃない。でも、この一秒は速かった。", "この曲が、今年いちばん鋭い爆発を記録しました。", "速さは鼓面を越えて、年間の記録へ駆け抜けました。"];
  return { title: pick(locale === "ja" ? ja : zh, seed), body: pick(locale === "ja" ? bodyJa : bodyZh, `${seed}:body`) };
};

export const getHighScoreCopy = (highScore: VersionSummaryHighScore | null | undefined, locale: "zh" | "ja" = "zh") => {
  if (!highScore) return locale === "ja"
    ? { title: "今年の最高得点は、まだありません", body: "次のプレイが、年間ハイスコアの始まりかもしれません。" }
    : { title: "今年还没有最高分记录", body: "下一次游玩，也许就是年度高分的起点。" };
  const seed = `${highScore.song.songNo}:${highScore.score}`;
  const zh = ["今年最高分，停在这一刻", "你把这一首打到了最高处", "这一局，是分数的顶点"];
  const ja = ["今年の最高得点は、この瞬間に", "この一曲を、いちばん高い場所へ", "この一打が、スコアの頂点"];
  const bodyZh = ["分数不会说谎，这一局确实很亮。", "所有判定、连段和节奏，都在这里收束成一个数字。", "当鼓点落下，分数也停在了最漂亮的位置。"];
  const bodyJa = ["スコアは嘘をつかない。この一局は確かに輝いていました。", "判定も連段もリズムも、ひとつの数字へ集まりました。", "音が止まったとき、スコアもいちばん美しい場所に。"];
  return { title: pick(locale === "ja" ? ja : zh, seed), body: pick(locale === "ja" ? bodyJa : bodyZh, `${seed}:body`) };
};

export const getSpeedProfileCopy = (profile: VersionSummarySpeedProfile | null | undefined, locale: "zh" | "ja" = "zh") => {
  if (!profile || profile.speed <= 0) return locale === "ja"
    ? { title: "今年の倍速プロフィールは、まだありません", body: "もう少し遊べば、あなたのテンポが見えてきます。", tag: "これから形になる" }
    : { title: "今年还没有形成倍速画像", body: "多打几首歌，你的节奏档位就会慢慢浮现。", tag: "画像はこれから" };
  const speed = profile.speed.toFixed(1).replace(/\.0$/, "");
  const fast = profile.speed >= 3;
  const tag = locale === "ja"
    ? (fast ? "高速読譜型" : profile.speed <= 1 ? "原速信仰型" : "安定巡航型")
    : (fast ? "高速读谱型" : profile.speed <= 1 ? "原速信仰型" : "稳定巡航型");
  return locale === "ja"
    ? { title: `${speed}×、あなたの年間テンポ`, body: `いちばん多く選んだ ${speed}× が、あなたのリズムの口ぐせになりました。`, tag }
    : { title: `${speed}×，你的年度倍速画像`, body: `这一年最常用的 ${speed}×，已经变成你的读谱口音。`, tag };
};
