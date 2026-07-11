import type {
  VersionSummaryBreakthrough,
  VersionSummaryKeyword,
  VersionSummaryPoster,
  VersionSummaryRatingRank,
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
      : `${song.name}${levelLabel} 在虹2025里迎来了全良。那一刻，谱面没有变简单，是你变强了。`;
  }
  if (breakthrough.type === "full_combo") {
    return locale === "ja"
      ? `${song.name}${levelLabel} でフルコンボを確認。積み上げてきた手応えが、はっきり数字に出ました。`
      : `${song.name}${levelLabel} 在窗口内完成了全连。那一刻，谱面没有变简单，是你变强了。`;
  }
  if (breakthrough.type === "clear") {
    return locale === "ja"
      ? `${song.name}${levelLabel} を初クリア。このバージョンで新しい地面を踏みました。`
      : `${song.name}${levelLabel} 完成首次通关。那一刻，谱面没有变简单，是你变强了。`;
  }
  return locale === "ja"
    ? `${song.name}${levelLabel} の単次スコア上昇が最大で、+${breakthrough.scoreDelta.toLocaleString()} 点でした。`
    : `${song.name}${levelLabel} 的单次分数提升最多，一次抬高了 ${breakthrough.scoreDelta.toLocaleString()} 分。谱面没有变简单，是你变强了。`;
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
      },
      {
        label: locale === "ja" ? "最長連続" : "最长连续",
        value: locale === "ja" ? `${summary.calendarActivity?.longestStreak || 0}日` : `${summary.calendarActivity?.longestStreak || 0} 天`
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
  breakthroughSong: VersionSummarySongCard | null,
  ratingRank: VersionSummaryRatingRank | null = null
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
  const weekdayLabels = locale === "ja" ? ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"] : ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const periodLabels: Record<string, string> = locale === "ja"
    ? { early_morning: "早朝", morning: "午前", noon: "昼", afternoon: "午後", evening: "夜", late_night: "深夜" }
    : { early_morning: "早上", morning: "上午", noon: "中午", afternoon: "下午", evening: "晚上", late_night: "深夜" };
  const topWeekday = summary.weekdayActivity ? weekdayLabels[summary.weekdayActivity.topWeekday] : "";
  const bottomWeekday = summary.weekdayActivity ? weekdayLabels[summary.weekdayActivity.bottomWeekday] : "";
  const topPeriod = summary.timeOfDay ? periodLabels[summary.timeOfDay.topPeriod] : "";
  const topHour = summary.timeOfDay ? `${String(summary.timeOfDay.favoriteHour).padStart(2, "0")}:00–${String((summary.timeOfDay.favoriteHour + 1) % 24).padStart(2, "0")}:00` : "";
  const ratingBodies: Record<string, string> = locale === "ja"
    ? { top1: "譜面に覚えられるほどの位置です。", top5: "ここまで来た鼓棒には、もう鋭さがあります。", top20: "多くの仲間を越えてきました。", top50: "安定して強くなっています。", growing: "一打ごとに、次の成長の伏線が残ります。" }
    : { top1: "你已经不是普通玩家，是谱面会记住的人。", top5: "能走到这里的人，鼓棒都带着锋芒。", top20: "你已经超过了大多数同行者。", top50: "你正在稳定变强。", growing: "每一次敲下去，都是下一次进步的伏笔。" };

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
    favoriteShift: {
      eyebrow: locale === "ja" ? "新旧の旋律" : "新欢与旧爱",
      title: locale === "ja" ? "新しい旋律と出会い、最初の一曲も忘れなかった" : "你结识了新的旋律，也没有忘记最初让你停留的那一首",
      body: summary.favoriteShift ? (locale === "ja" ? `最初は「${summary.favoriteShift.oldFavorite.songName}」、今は「${summary.favoriteShift.newFavorite.songName}」。` : `旧爱：《${summary.favoriteShift.oldFavorite.songName}》\n新欢：《${summary.favoriteShift.newFavorite.songName}》`) : ""
    },
    monthlyFavorites: {
      eyebrow: locale === "ja" ? "月ごとの BGM" : "月度最爱",
      title: locale === "ja" ? "毎月に、一曲ずつ残った" : "每个月，都留下了一首 BGM",
      body: locale === "ja" ? "太鼓と過ごした日々には、毎月それぞれの BGM がありました。" : "有太鼓陪伴的日子，每个月都有自己的 BGM。"
    },
    weekdayActivity: {
      eyebrow: locale === "ja" ? "一週間のリズム" : "每周太鼓",
      title: locale === "ja" ? `${topWeekday} にいちばん太鼓を叩きました` : `你最爱在${topWeekday}打鼓`,
      body: locale === "ja" ? `いちばん静かだったのは ${bottomWeekday}。自分のために時間を残す曜日が見えてきます。` : `也许那一天，你终于把时间留给了自己。最少游玩的日子是${bottomWeekday}。`
    },
    calendarActivity: {
      eyebrow: locale === "ja" ? "太鼓カレンダー" : "太鼓日历",
      title: locale === "ja" ? `${summary.calendarActivity?.activeDays || 0} 日、太鼓を叩きました` : `这一版，有 ${summary.calendarActivity?.activeDays || 0} 天你都在打鼓`,
      body: locale === "ja" ? `最長連続記録は ${summary.calendarActivity?.longestStreak || 0} 日。太鼓のない日も、楽しく。` : `最长连续记录是 ${summary.calendarActivity?.longestStreak || 0} 天。没有太鼓的日子，也要愉快。`
    },
    timeOfDay: {
      eyebrow: locale === "ja" ? "一日の拍子" : "活跃时段",
      title: locale === "ja" ? `${topPeriod} にいちばん太鼓を叩きました` : `你最爱在${topPeriod}打鼓`,
      body: locale === "ja" ? `${topHour} が最も活発な時間帯でした。ひとつひとつの 3 分間を太鼓に残しました。` : `${topHour}，是你最活跃的时段。人来人往，但这一小时里，你把一个又一个 3 分钟留给了太鼓。`
    },
    lateNight: {
      eyebrow: locale === "ja" ? "午前零時のあと" : "深夜记录",
      title: summary.lateNight ? (locale === "ja" ? `${summary.lateNight.latestAt}、まだ太鼓を叩いていました` : `${formatDateTime(locale, summary.lateNight.latestAt)}，你还在打《${summary.lateNight.song.songName}》`) : "",
      body: locale === "ja" ? `この版では ${summary.lateNight?.activeDays || 0} 夜、鼓点が夜更かしに付き合いました。` : `这一版，有 ${summary.lateNight?.activeDays || 0} 个夜晚，鼓点陪你晚睡。`
    },
    ratingRank: {
      eyebrow: locale === "ja" ? "サイト内プレイヤー標本" : "站内玩家样本",
      title: locale === "ja" ? "今の実力がいる場所" : "你的当前实力，在这里留下坐标",
      body: ratingRank ? `${ratingBodies[ratingRank.tier] || ratingBodies.growing}${locale === "ja" ? " サイト内標本であり、公式順位ではありません。" : " 这是站内玩家样本，不是官方全服排名。"}` : ""
    },
    milestones: {
      eyebrow: locale === "ja" ? "大切な瞬間" : "重要时刻存档",
      title: locale === "ja" ? "たくさんの大切な瞬間が、鼓点に残った" : "你的很多重要时刻，都被鼓点悄悄存档",
      body: locale === "ja" ? "初クリア、初フルコンボ、初全良。残せた瞬間だけを、ここに並べます。" : "第一次过关。第一次全连。第一次全良。能被可靠确认的时刻，都留在这里。"
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

  const pageKeys = ["opening", "period", "overview", "favorite"];
  if (summary.obsessionSong) pageKeys.push("obsession");
  if (summary.favoriteShift) pageKeys.push("favoriteShift");
  if (summary.monthlyFavorites?.length) pageKeys.push("monthly");
  if (summary.weekdayActivity?.totalPlays) pageKeys.push("weekday");
  if (summary.calendarActivity?.days?.length) pageKeys.push("calendar");
  if (summary.timeOfDay?.totalPlays) pageKeys.push("timeOfDay");
  if (summary.lateNight) pageKeys.push("lateNight");
  if (summary.keyword) pageKeys.push("keyword");
  if (ratingRank) pageKeys.push("ratingRank");
  if (summary.milestones?.length) pageKeys.push("milestones");
  pageKeys.push("breakthrough", "final", "poster");

  return {
    estimatedTimeText,
    breakthrough,
    finalTitle,
    poster,
    story: {
      pageCount: pageKeys.length,
      pageKeys
    },
    copy
  };
};
