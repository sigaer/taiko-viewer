import type {
  VersionSummaryBreakthrough,
  VersionSummaryKeyword,
  VersionSummaryPoster,
  VersionSummarySongCard,
  VersionSummaryViewModel
} from "~/types/account-version-summary";
import type { RawVersionSummary, VersionSummaryLocale } from "./types";

const LOCALE_TAG: Record<VersionSummaryLocale, string> = {
  zh: "zh-CN",
  ja: "ja-JP"
};

const DIMENSION_LABELS: Record<VersionSummaryLocale, Record<string, string>> = {
  zh: {
    big_song: "大歌力",
    stamina: "体力",
    speed: "高速处理",
    accuracy: "精度力",
    rhythm: "节奏处理",
    complex: "复合处理"
  },
  ja: {
    big_song: "大歌力",
    stamina: "体力",
    speed: "高速処理",
    accuracy: "精度力",
    rhythm: "リズム処理",
    complex: "複合処理"
  }
};

const KEYWORD_TITLES: Record<VersionSummaryLocale, Record<string, string>> = {
  zh: {
    wall_breaker: "拆墙鼓手",
    endless_drummer: "连打不歇",
    speed_runner: "高速追风",
    precision_tuner: "精度调音师",
    rhythm_resonator: "节奏共振体",
    complex_hunter: "复合猎手",
    encouragement: "还在热身"
  },
  ja: {
    wall_breaker: "壁割りドラマー",
    endless_drummer: "叩き続ける人",
    speed_runner: "スピードランナー",
    precision_tuner: "精度チューナー",
    rhythm_resonator: "リズム共鳴体",
    complex_hunter: "複合ハンター",
    encouragement: "まだ助走中"
  }
};

const LEVEL_LABELS: Record<VersionSummaryLocale, Record<number, string>> = {
  zh: {
    1: "简单",
    2: "一般",
    3: "困难",
    4: "魔王",
    5: "里谱"
  },
  ja: {
    1: "かんたん",
    2: "ふつう",
    3: "むずかしい",
    4: "おに",
    5: "裏譜面"
  }
};

const SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
};

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
};

const getDateFormatter = (locale: VersionSummaryLocale, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    ...options,
    timeZone: "Asia/Shanghai"
  });

const formatDate = (locale: VersionSummaryLocale, value?: string | null) => {
  if (!value) return locale === "ja" ? "未記録" : "暂无记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return getDateFormatter(locale, SHORT_DATE_OPTIONS).format(date);
};

const formatDateTime = (locale: VersionSummaryLocale, value?: string | null) => {
  if (!value) return locale === "ja" ? "未記録" : "暂无记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return getDateFormatter(locale, DATE_TIME_OPTIONS).format(date);
};

const formatScore = (value: number) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return numeric >= 10 ? numeric.toFixed(1) : numeric.toFixed(2);
};

const formatDuration = (locale: VersionSummaryLocale, seconds: number) => {
  const totalMinutes = Math.max(0, Math.round((Number(seconds) || 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (locale === "ja") {
    if (hours > 0) return `${hours}時間${minutes}分`;
    return `${Math.max(totalMinutes, 1)}分`;
  }
  if (hours > 0) return `${hours}小时${minutes}分`;
  return `${Math.max(totalMinutes, 1)}分钟`;
};

const getBreakthroughTitle = (
  locale: VersionSummaryLocale,
  breakthrough: RawVersionSummary["breakthrough"],
  keywordTitle: string
) => {
  switch (breakthrough.type) {
    case "dondaful":
      return locale === "ja" ? "初の全良" : "首次全良";
    case "full_combo":
      return locale === "ja" ? "初のフルコンボ" : "首次全接";
    case "clear":
      return locale === "ja" ? "初のクリア" : "首次通关";
    case "score_gain":
      return locale === "ja" ? "最大スコア上昇" : "单次分数提升最多";
    default:
      return keywordTitle;
  }
};

const getBreakthroughBody = (
  locale: VersionSummaryLocale,
  breakthrough: RawVersionSummary["breakthrough"],
  song: VersionSummarySongCard | null
) => {
  if (breakthrough.type === "encouragement" || !song) {
    return locale === "ja"
      ? "この期間のイベントはまだ少なめです。もう少し叩いたら、ここに次の変化点を載せます。"
      : "这段时间的事件记录还不够多，继续打下去，这里会很快出现下一次变化。";
  }

  const levelLabel =
    breakthrough.level && LEVEL_LABELS[locale][breakthrough.level]
      ? ` ${LEVEL_LABELS[locale][breakthrough.level]}`
      : "";

  if (breakthrough.type === "dondaful") {
    return locale === "ja"
      ? `${song.name}${levelLabel} で全良を確認。今回の虹2025でいちばん目立つ到達点です。`
      : `${song.name}${levelLabel} 在虹2025里迎来了全良，这是这段时间最醒目的一次突破。`;
  }
  if (breakthrough.type === "full_combo") {
    return locale === "ja"
      ? `${song.name}${levelLabel} でフルコンボを確認。積み上げてきた手応えが、はっきり数字に出ました。`
      : `${song.name}${levelLabel} 在窗口内完成了全接，这次提升已经清楚地写进了记录里。`;
  }
  if (breakthrough.type === "clear") {
    return locale === "ja"
      ? `${song.name}${levelLabel} を初クリア。このバージョンで新しい地面を踏みました。`
      : `${song.name}${levelLabel} 完成首次通关，这一版里你确实跨过了一道新的门槛。`;
  }
  return locale === "ja"
    ? `${song.name}${levelLabel} の単次スコア上昇が最大で、+${breakthrough.scoreDelta.toLocaleString()} 点でした。`
    : `${song.name}${levelLabel} 的单次分数提升最多，一次抬高了 ${breakthrough.scoreDelta.toLocaleString()} 分。`;
};

const buildPoster = (
  locale: VersionSummaryLocale,
  summary: RawVersionSummary,
  favoriteSong: VersionSummarySongCard | null,
  keyword: VersionSummaryKeyword | null
): VersionSummaryPoster => {
  const title =
    locale === "ja"
      ? `${summary.user.nickname} の ${summary.version.name}`
      : `${summary.user.nickname} 的 ${summary.version.name}`;
  const subtitle = summary.flags.insufficientData
    ? locale === "ja"
      ? "まだ記録は少なめ。次の更新でもう一度見に来てください。"
      : "当前样本还不够多，等下一次同步后再回来看看。"
    : locale === "ja"
      ? `${summary.version.startDate} から ${summary.version.effectiveEndDate} までの鼓面ログ。`
      : `${summary.version.startDate} 到 ${summary.version.effectiveEndDate} 的鼓面记录。`;

  return {
    title,
    subtitle,
    favoriteSong: favoriteSong?.name || (locale === "ja" ? "まだ未確定" : "暂未定格"),
    keyword: keyword?.title || KEYWORD_TITLES[locale].encouragement,
    shareCopy: locale === "ja"
      ? `${summary.version.name} では ${summary.overview.playCount} 回叩いて、${summary.period.activeDays} 日動いていました。`
      : `${summary.version.name} 里一共打了 ${summary.overview.playCount} 次，活跃了 ${summary.period.activeDays} 天。`,
    stats: [
      {
        label: locale === "ja" ? "プレイ回数" : "游玩次数",
        value: String(summary.overview.playCount)
      },
      {
        label: locale === "ja" ? "活動日数" : "活跃天数",
        value: String(summary.period.activeDays)
      },
      {
        label: locale === "ja" ? "触れた曲数" : "涉及歌曲",
        value: String(summary.overview.uniqueSongs)
      }
    ]
  };
};

export const getVersionSummaryDimensionLabel = (locale: VersionSummaryLocale, dimensionKey: string) =>
  DIMENSION_LABELS[locale][dimensionKey] || dimensionKey;

export const getVersionSummaryKeywordTitle = (locale: VersionSummaryLocale, titleKey: string) =>
  KEYWORD_TITLES[locale][titleKey] || KEYWORD_TITLES[locale].encouragement;

export const buildVersionSummaryPresentation = (
  locale: VersionSummaryLocale,
  summary: RawVersionSummary,
  favoriteSong: VersionSummarySongCard | null,
  obsessionSong: VersionSummarySongCard | null,
  keyword: VersionSummaryKeyword | null,
  breakthroughSong: VersionSummarySongCard | null
) => {
  const estimatedTimeText = formatDuration(locale, summary.overview.estimatedSeconds);
  const keywordTitle = keyword?.title || KEYWORD_TITLES[locale].encouragement;
  const breakthroughTitle = getBreakthroughTitle(locale, summary.breakthrough, keywordTitle);
  const breakthroughBody = getBreakthroughBody(locale, summary.breakthrough, breakthroughSong);
  const poster = buildPoster(locale, summary, favoriteSong, keyword);

  const breakthrough: VersionSummaryBreakthrough = {
    type: summary.breakthrough.type,
    occurredAt: summary.breakthrough.occurredAt,
    song: breakthroughSong,
    scoreDelta: summary.breakthrough.scoreDelta,
    playDelta: summary.breakthrough.playDelta,
    title: breakthroughTitle,
    body: breakthroughBody,
    happenedLabel: formatDateTime(locale, summary.breakthrough.occurredAt)
  };

  const copy: VersionSummaryViewModel["copy"] = {
    opening: {
      eyebrow: `${summary.version.name} / ${locale === "ja" ? "バージョンサマリー" : "版本总结"}`,
      title:
        locale === "ja"
          ? `${summary.user.nickname} の鼓面記録`
          : `${summary.user.nickname} 的鼓面记录`,
      subtitle: summary.flags.insufficientData
        ? locale === "ja"
          ? "まだイベントは少なめです。今ある記録だけで、まず 8 ページにまとめました。"
          : "当前事件记录还比较少，先把现有内容整理成这一版的 8 页。"
        : locale === "ja"
          ? `${summary.version.startDate} から ${summary.version.effectiveEndDate} まで、${summary.overview.playCount} 回の記録をまとめました。`
          : `${summary.version.startDate} 到 ${summary.version.effectiveEndDate}，一共留下了 ${summary.overview.playCount} 次鼓面记录。`
    },
    period: {
      eyebrow: locale === "ja" ? "期間" : "版本时间",
      title: summary.version.isOngoing
        ? locale === "ja"
          ? `${formatDate(locale, summary.version.startDate)} から現在まで`
          : `${formatDate(locale, summary.version.startDate)} 到当前`
        : `${formatDate(locale, summary.version.startDate)} - ${formatDate(locale, summary.version.endDate)}`,
      body: summary.period.firstRecordAt
        ? summary.coverage.partialStart
          ? locale === "ja"
            ? `最初の記録は ${formatDateTime(locale, summary.period.firstRecordAt)}。期間前の基準スナップショットがないため、最初に取れた記録から集計しています。`
            : `第一条记录出现在 ${formatDateTime(locale, summary.period.firstRecordAt)}。由于窗口前没有更早基线快照，这次从首个可用快照开始统计。`
          : locale === "ja"
            ? `最初の記録は ${formatDateTime(locale, summary.period.firstRecordAt)}、最後は ${formatDateTime(locale, summary.period.lastRecordAt)}。`
            : `你的第一条记录出现在 ${formatDateTime(locale, summary.period.firstRecordAt)}，最后一条记录落在 ${formatDateTime(locale, summary.period.lastRecordAt)}。`
        : locale === "ja"
          ? "この期間にイベントとして認識できる記録はまだありません。"
          : "当前窗口内还没有识别到可计入事件的游玩记录。"
    },
    overview: {
      eyebrow: locale === "ja" ? "総覧" : "总览",
      title:
        locale === "ja"
          ? `${summary.overview.playCount} 回叩いて、${summary.overview.uniqueSongs} 曲を触りました`
          : `${summary.overview.playCount} 次游玩，打到了 ${summary.overview.uniqueSongs} 首歌`,
      body:
        locale === "ja"
          ? `${summary.period.activeDays} 日動いていて、推定プレイ時間は ${estimatedTimeText}。`
          : `共活跃 ${summary.period.activeDays} 天，按 180 秒一局估算，大约打了 ${estimatedTimeText}。`
    },
    favoriteSong: {
      eyebrow: locale === "ja" ? "よく叩いた曲" : "最爱歌曲",
      title: favoriteSong?.name || (locale === "ja" ? "まだ定番は未決定" : "最爱歌曲还没定型"),
      body: favoriteSong
        ? locale === "ja"
          ? `${favoriteSong.playCount || 0} 回でトップ。今期いちばん素直に手が伸びた曲です。`
          : `这首歌在窗口内一共打了 ${favoriteSong.playCount || 0} 次，是你这一版最常回去敲的歌。`
        : locale === "ja"
          ? "十分な增量がまだなく、よく叩いた曲は次回以降に確定します。"
          : "当前还没有足够的正向增量，最爱歌曲会在后续记录里慢慢定型。"
    },
    obsessionSong: {
      eyebrow: locale === "ja" ? "念に残る曲" : "念念不忘",
      title: obsessionSong?.name || (locale === "ja" ? "まだ追いかけ中" : "还在追歌中"),
      body: obsessionSong
        ? locale === "ja"
          ? `${obsessionSong.activeDays || 0} 日に分けて叩いていました。思い出すたびに戻ってきた曲です。`
          : `你在 ${obsessionSong.activeDays || 0} 个不同日期都回去打过它，这首歌明显一直挂在心里。`
        : locale === "ja"
          ? "まだ同じ曲に通い続けた痕迹は薄めです。"
          : "当前还看不出反复惦记同一首歌的痕迹。"
    },
    keyword: {
      eyebrow: locale === "ja" ? "太鼓キーワード" : "太鼓关键词",
      title: keyword?.title || KEYWORD_TITLES[locale].encouragement,
      body: keyword
        ? locale === "ja"
          ? `${keyword.dimensionLabel} がいちばん前に出ています。加重スコアは ${formatScore(keyword.score)}。`
          : `${keyword.dimensionLabel} 是你这一版最突出的维度，加权分值来到 ${formatScore(keyword.score)}。`
        : locale === "ja"
          ? "六维关键词を出すには、もう少し正向增量が必要です。"
          : "六维关键词需要更多正向增量，当前样本还不够。"
    },
    breakthrough: {
      eyebrow: locale === "ja" ? "ブレイクスルー" : "年度突破",
      title: breakthroughTitle,
      body: breakthroughBody
    },
    poster: {
      eyebrow: locale === "ja" ? "ポスター" : "海报页",
      title: poster.title,
      subtitle: poster.subtitle
    },
    controls: {
      versionLabel: locale === "ja" ? "対象バージョン" : "统计版本",
      bindingLabel: locale === "ja" ? "連携 ID" : "当前绑定",
      refresh: locale === "ja" ? "重新生成" : "重新生成"
    }
  };

  return {
    estimatedTimeText,
    breakthrough,
    poster,
    copy
  };
};
