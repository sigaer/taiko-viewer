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

const buildFinalTitle = (
  locale: VersionSummaryLocale,
  summary: RawVersionSummary,
  keyword: VersionSummaryKeyword | null,
  breakthrough: RawVersionSummary["breakthrough"]
) => {
  const title = keyword?.title || KEYWORD_TITLES[locale].encouragement;
  const eyebrow = locale === "ja" ? "今期の呼び名" : "这一版的称号";
  const themeKey = keyword?.dimensionKey || breakthrough.type || "encouragement";

  if (summary.flags.newcomer || summary.flags.insufficientData) {
    return {
      title,
      eyebrow,
      themeKey: "encouragement",
      body:
        locale === "ja"
          ? "まだ記録は短めですが、鼓面に向かう癖はもう始まっています。次に見返すとき、この呼び名はもっとあなたらしくなります。"
          : "这一版的记录还不算长，但属于你的手感已经开始成形。等下一次再回来看，这个称号会更像你。"
    };
  }

  switch (breakthrough.type) {
    case "dondaful":
      return {
        title,
        eyebrow,
        themeKey,
        body:
          locale === "ja"
            ? "この版でいちばん眩しかった瞬間は、叩き方の精度と意志がぴたりと重なったことでした。"
            : "这一版最耀眼的那一下，是稳定、准度和不肯放手的劲同时落在了同一个点上。"
      };
    case "full_combo":
      return {
        title,
        eyebrow,
        themeKey,
        body:
          locale === "ja"
            ? "積み重ねてきた感触が、ついに一本の流れになって抜けていきました。"
            : "这段时间攒下来的手感，终于被你连成了一次完整穿过的鼓点。"
      };
    case "clear":
      return {
        title,
        eyebrow,
        themeKey,
        body:
          locale === "ja"
            ? "新しい地面を踏めた版でした。越えたあとに残る静けさまで、ちゃんとあなたの記録です。"
            : "这一版你确实踩过了新的门槛，跨过去之后留下的那口气，也属于这段故事。"
      };
    case "score_gain":
      return {
        title,
        eyebrow,
        themeKey,
        body:
          locale === "ja"
            ? "大きな成長はいつも派手とは限りません。数字が上がった一撃が、それを静かに証明しています。"
            : "不是每次成长都会被高声宣告，但分数抬起的那一下，已经替你把变化记了下来。"
      };
    default:
      return {
        title,
        eyebrow,
        themeKey,
        body: keyword
          ? locale === "ja"
            ? `${keyword.dimensionLabel} を軸にしながら、この版の叩き方が少しずつ輪郭を持ちました。`
            : `这一版的手感，最后收成了 ${keyword.dimensionLabel} 这条最清晰的线。`
          : locale === "ja"
            ? "まだ名前はやわらかいままですが、鼓面に向かうリズムはもう始まっています。"
            : "称号还很柔软，但这段时间的鼓点已经慢慢有了自己的模样。"
      };
  }
};

const buildPoster = (
  locale: VersionSummaryLocale,
  summary: RawVersionSummary,
  favoriteSong: VersionSummarySongCard | null,
  keyword: VersionSummaryKeyword | null,
  finalTitle: ReturnType<typeof buildFinalTitle>
): VersionSummaryPoster => {
  const title =
    locale === "ja"
      ? `${summary.user.nickname} の ${summary.version.name}`
      : `${summary.user.nickname} 的 ${summary.version.name}`;
  const subtitle = summary.flags.insufficientData
    ? locale === "ja"
      ? "まだ短いけれど、ここまでの鼓面の光だけを一枚にまとめました。"
      : "这段故事还不算长，但已经足够拼出一张属于这一版的海报。"
    : locale === "ja"
      ? "今期の熱量、手触り、何度も戻った曲を一枚にまとめた記念ポスターです。"
      : "把这一版的热度、手感和反复回去的歌，收成了一张可以留下来的海报。";

  const periodLabel = summary.version.isOngoing
    ? locale === "ja"
      ? `${formatDate(locale, summary.version.startDate)} から現在まで`
      : `${formatDate(locale, summary.version.startDate)} 到当前`
    : `${formatDate(locale, summary.version.startDate)} - ${formatDate(locale, summary.version.effectiveEndDate)}`;

  const closingLine = summary.flags.insufficientData
    ? locale === "ja"
      ? "次の鼓点が増えたら、この景色はもっと濃くなります。"
      : "等下一次鼓点再多一些，这张海报会变得更像你。"
    : locale === "ja"
      ? "すべては載せきれなくても、この一枚には今期の癖と熱量がちゃんと残っています。"
      : "不是每一次敲击都要被逐条写下，但这一页已经足够留下你这一版的节奏。";

  return {
    title,
    subtitle,
    finalTitle: finalTitle.title,
    periodLabel,
    favoriteSong: favoriteSong?.name || (locale === "ja" ? "まだ未確定" : "暂未定格"),
    keyword: keyword?.title || KEYWORD_TITLES[locale].encouragement,
    closingLine,
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
  const finalTitle = buildFinalTitle(locale, summary, keyword, summary.breakthrough);
  const poster = buildPoster(locale, summary, favoriteSong, keyword, finalTitle);

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
          ? "まだ短い版ですが、ここまでの鼓点にもちゃんと色があります。"
          : "这一版的故事还不算长，但已经能听见属于你的鼓点回声。"
        : locale === "ja"
          ? `${summary.version.startDate} から ${summary.version.effectiveEndDate} までの鼓面を、物語としてめくれる形にまとめました。`
          : `${summary.version.startDate} 到 ${summary.version.effectiveEndDate} 的鼓面，被整理成了一段可以翻开的故事。`
    },
    period: {
      eyebrow: locale === "ja" ? "期間" : "版本时间",
      title: summary.version.isOngoing
        ? locale === "ja"
          ? `${formatDate(locale, summary.version.startDate)} から、この瞬間まで`
          : `从 ${formatDate(locale, summary.version.startDate)}，一直到现在`
        : `${formatDate(locale, summary.version.startDate)} - ${formatDate(locale, summary.version.endDate)}`,
      body: summary.period.firstRecordAt
        ? summary.coverage.partialStart
          ? locale === "ja"
            ? `${formatDateTime(locale, summary.period.firstRecordAt)} に追いつけたところから、この版の物語が始まります。`
            : `能追到的第一段鼓点，落在 ${formatDateTime(locale, summary.period.firstRecordAt)}。这段故事，就从这里开始。`
          : locale === "ja"
            ? `最初の記録は ${formatDateTime(locale, summary.period.firstRecordAt)}、最後の余韻は ${formatDateTime(locale, summary.period.lastRecordAt)} に残っています。`
            : `第一条记录出现在 ${formatDateTime(locale, summary.period.firstRecordAt)}，最近一次回响停在 ${formatDateTime(locale, summary.period.lastRecordAt)}。`
        : locale === "ja"
          ? "この期間はまだ、静かな助走の途中です。"
          : "这一段时间还很安静，但节奏已经在起步。"
    },
    overview: {
      eyebrow: locale === "ja" ? "総覧" : "总览",
      title:
        locale === "ja"
          ? `${summary.overview.playCount} 回叩いて、${summary.overview.uniqueSongs} 曲に手を伸ばしました`
          : `${summary.overview.playCount} 次游玩，打到了 ${summary.overview.uniqueSongs} 首歌`,
      body:
        locale === "ja"
          ? `${summary.period.activeDays} 日にわたって動いていて、推定プレイ時間は ${estimatedTimeText} です。`
          : `共活跃 ${summary.period.activeDays} 天，按 180 秒一局估算，这一版大约打了 ${estimatedTimeText}。`
    },
    favoriteSong: {
      eyebrow: locale === "ja" ? "よく叩いた曲" : "最爱歌曲",
      title: favoriteSong?.name || (locale === "ja" ? "まだ定番は未決定" : "最爱歌曲还没定型"),
      body: favoriteSong
        ? locale === "ja"
          ? `${favoriteSong.playCount || 0} 回でトップ。今期、いちばん自然に手が伸びた一曲です。`
          : `这首歌在窗口内一共打了 ${favoriteSong.playCount || 0} 次，是你这一版最自然会回去敲的歌。`
        : locale === "ja"
          ? "まだ一曲に定まるほどの偏りはありません。"
          : "当前还没有偏到足够明显的一首，但它会慢慢浮出来。"
    },
    obsessionSong: {
      eyebrow: locale === "ja" ? "念に残る曲" : "念念不忘",
      title: obsessionSong?.name || (locale === "ja" ? "まだ追いかけ中" : "还在追歌中"),
      body: obsessionSong
        ? locale === "ja"
          ? `${obsessionSong.activeDays || 0} 日に分けて叩いていました。一度では足りず、何度も戻ってきた曲です。`
          : `你在 ${obsessionSong.activeDays || 0} 个不同日期都回去打过它。不是一时上头，是一直放在心里。`
        : locale === "ja"
          ? "まだ、何度も帰りたくなる一曲は固まっていません。"
          : "当前还看不出反复惦记同一首歌的轨迹。"
    },
    keyword: {
      eyebrow: locale === "ja" ? "太鼓キーワード" : "太鼓关键词",
      title: keyword?.title || KEYWORD_TITLES[locale].encouragement,
      body: keyword
        ? locale === "ja"
          ? `もし今期の叩き方を一言にまとめるなら、いちばん前に出ていたのは ${keyword.dimensionLabel} です。`
          : `如果把这一版的手感收成一个词，最先站出来的是 ${keyword.dimensionLabel}。`
        : locale === "ja"
          ? "まだ名前を付けるには少し早いですが、輪郭はでき始めています。"
          : "现在给它下定义还早一点，但轮廓已经开始出现。"
    },
    breakthrough: {
      eyebrow: locale === "ja" ? "ブレイクスルー" : "年度突破",
      title: breakthroughTitle,
      body: breakthroughBody
    },
    finalTitle: {
      eyebrow: finalTitle.eyebrow,
      title: finalTitle.title,
      body: finalTitle.body
    },
    poster: {
      eyebrow: locale === "ja" ? "記念ポスター" : "收尾海报",
      title: poster.title,
      subtitle: poster.subtitle
    },
    controls: {
      versionLabel: locale === "ja" ? "対象バージョン" : "统计版本",
      bindingLabel: locale === "ja" ? "連携 ID" : "当前绑定",
      refresh: locale === "ja" ? "再生成" : "重新生成"
    }
  };

  return {
    estimatedTimeText,
    breakthrough,
    finalTitle,
    poster,
    story: {
      pageCount: 9,
      pageKeys: ["opening", "period", "overview", "favorite", "obsession", "keyword", "breakthrough", "final", "poster"]
    },
    copy
  };
};
