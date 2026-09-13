import type {
  AnnualMetricStatus,
  AnnualSummaryV4,
  VersionSummaryBreakthrough,
  VersionSummaryCopyBlock,
  VersionSummaryPayload,
  VersionSummarySongCard,
  VersionSummaryViewModel
} from "~/types/account-version-summary";
import { buildSongCoverThumbnailUrl } from "~/utils/songCover";

type UnknownRecord = Record<string, unknown>;
type Translate = (key: string, params?: Record<string, unknown>) => string;

const record = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};

// The annual recap reports every day boundary in the season time zone, so the
// "how many days has this story been running" figure must be anchored to the
// same calendar day the player actually saw.
const ANNUAL_CALENDAR_TIME_ZONE = "Asia/Shanghai";
const MONTH_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const annualCalendarFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ANNUAL_CALENDAR_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const calendarParts = (value: unknown): string => {
  const date = value instanceof Date
    ? value
    : (() => {
        const raw = typeof value === "string" ? value.trim() : "";
        if (!raw) return null;
        return MONTH_DAY_PATTERN.test(raw) ? new Date(`${raw}T00:00:00Z`) : new Date(raw);
      })();
  if (!date || Number.isNaN(date.getTime())) return "";
  const parts = annualCalendarFormatter.formatToParts(date);
  const year = parts.find((item) => item.type === "year")?.value || "";
  const month = parts.find((item) => item.type === "month")?.value || "";
  const day = parts.find((item) => item.type === "day")?.value || "";
  return year && month && day ? `${year}-${month}-${day}` : "";
};

const calendarDayNumber = (dayKey: string): number | null => {
  const match = dayKey.match(MONTH_DAY_PATTERN);
  if (!match) return null;
  return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000);
};

const earliestCalendarDay = (values: unknown[]): string => {
  let earliest = "";
  for (const value of values) {
    const dayKey = calendarParts(value);
    if (!dayKey) continue;
    if (!earliest || dayKey < earliest) earliest = dayKey;
  }
  return earliest;
};

// Inclusive span in calendar days, counted from the first real play day to the
// current day in the season time zone.
const calendarDaySpan = (startDay: string, endDay: string): number | null => {
  const start = calendarDayNumber(startDay);
  const end = calendarDayNumber(endDay);
  if (start === null || end === null || end < start) return null;
  return end - start + 1;
};

const stringValue = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const numberValue = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nullableNumber = (value: unknown) => value === null || value === undefined || value === "" ? null : numberValue(value);

export const ANNUAL_RATING_RANK_LABELS = {
  zh: ["五级", "四级", "三级", "二级", "一级", "初段", "二段", "三段", "四段", "五段", "六段", "七段", "八段", "九段", "十段", "玄人", "名人", "超人", "达人"],
  ja: ["五級", "四級", "三級", "二級", "一級", "初段", "二段", "三段", "四段", "五段", "六段", "七段", "八段", "九段", "十段", "玄人", "名人", "超人", "達人"]
} as const;

export const getAnnualRatingRankLabels = (locale: "zh" | "ja") => [...ANNUAL_RATING_RANK_LABELS[locale]];

const formatDanGrade = (value: unknown, locale: "zh" | "ja") => {
  const raw = stringValue(value).trim();
  if (!raw) return "";
  const names = locale === "ja"
    ? ["", ...ANNUAL_RATING_RANK_LABELS.ja]
    : ["", ...ANNUAL_RATING_RANK_LABELS.zh];
  const code = Number(raw);
  if (Number.isInteger(code) && code > 0 && code < names.length) return names[code] || raw;
  return locale === "ja" ? raw.replaceAll("级", "級").replaceAll("达人", "達人") : raw.replaceAll("級", "级").replaceAll("達人", "达人");
};

// Strong Dan results switch the FinalTitle *presentation* only (same titleKey).
// The mapping is derived from the frozen evidence key set, so identical data always
// renders an identical title (no randomness, no hidden state).
const DAN_PRESENTATION_EVIDENCE = new Set([
  "dan_kanzui_gold",
  "dan_kanzui_red",
  "dan_fullgood_gold",
  "dan_fullgood_red",
  "dan_gold_pass",
  "dan_major_progress"
]);

type FinalEvidenceContext = {
  t: (key: string, params?: Record<string, unknown>) => string;
  locale: "zh" | "ja";
  breakthroughTitle: string;
  keywordTitle?: string;
  finalTitleLabel: string;
};

const formatIntegerFor = (locale: "zh" | "ja", value: number) =>
  new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "zh-CN").format(value);

const completionLabel = (value: unknown, t: FinalEvidenceContext["t"]) => {
  const code = numberValue(value);
  if (!Number.isFinite(code) || code < 0 || code > 6) return "";
  return t(`annualSummary.danCompletion.${Math.trunc(code)}`);
};

/** Render the Finale evidence line for a generator-provided evidenceKey. */
const renderFinalEvidence = (
  key: string,
  value: unknown,
  context: FinalEvidenceContext
): { label: string; text: string } | null => {
  const { t, locale } = context;
  if (key === "observed_play_count") {
    return { label: t("annualSummary.slides.final.firstSteps"), text: t("annualSummary.slides.final.times", { count: formatIntegerFor(locale, numberValue(value)) }) };
  }
  if (key === "breakthrough") {
    return { label: t("annualSummary.slides.final.fromBreakthrough"), text: context.breakthroughTitle };
  }
  if (key === "speed") {
    return { label: t("annualSummary.slides.final.fromSpeed"), text: `${numberValue(value)}×` };
  }
  if (key === "keyword") {
    return { label: t("annualSummary.slides.final.fromKeyword"), text: context.keywordTitle || context.finalTitleLabel };
  }
  const payload = record(value);
  const isDan = key.startsWith("dan_");
  const evidenceKey = (() => {
    if (key === "sparse_basic" || key === "endurance_volume") {
      const days = numberValue(payload.days);
      return days > 0 ? key : `${key}_no_days`;
    }
    return key;
  })();
  const templateKey = `annualSummary.finalEvidence.templates.${evidenceKey}`;
  const template = t(templateKey);
  if (!template || template === templateKey) return null;
  const params: Record<string, string> = {
    dan: formatDanGrade(String(numberValue(payload.dan)), locale),
    danBefore: formatDanGrade(String(numberValue(payload.danBefore)), locale),
    danAfter: formatDanGrade(String(numberValue(payload.danAfter)), locale),
    levels: formatIntegerFor(locale, Math.max(0, numberValue(payload.danAfter) - numberValue(payload.danBefore))),
    mark: completionLabel(payload.mark, t),
    markBefore: completionLabel(payload.markBefore, t),
    markAfter: completionLabel(payload.markAfter, t),
    milestones: formatIntegerFor(locale, numberValue(payload.milestones)),
    fullCombo: formatIntegerFor(locale, numberValue(payload.fullCombo)),
    dondaful: formatIntegerFor(locale, numberValue(payload.dondaful)),
    clears: formatIntegerFor(locale, numberValue(payload.clears)),
    speed: numberValue(payload.speed).toFixed(1),
    charts: formatIntegerFor(locale, numberValue(payload.charts)),
    plays: formatIntegerFor(locale, numberValue(payload.plays)),
    days: formatIntegerFor(locale, numberValue(payload.days)),
    songs: formatIntegerFor(locale, numberValue(payload.songs)),
    song: stringValue(payload.song),
    lateDays: formatIntegerFor(locale, numberValue(payload.lateDays))
  };
  // vue-i18n performs the named interpolation itself: `{dan}` / `{milestones}` / ...
  const text = t(templateKey, params);
  const labelKey = isDan
    ? (key.startsWith("dan_standing_") ? "danHistory" : "dan")
    : (key === "sparse_basic" ? "sparse" : "personality");
  return { label: t(`annualSummary.finalEvidence.labels.${labelKey}`), text };
};

const unwrapMetric = (value: unknown) => {
  const metric = record(value);
  return {
    status: stringValue(metric.status, "unavailable") as AnnualMetricStatus,
    data: metric.data ?? null,
    reason: stringValue(metric.reason) || null
  };
};


const makeSongMapper = (locale: "zh" | "ja") => (value: unknown): VersionSummarySongCard | null => {
  const song = record(value);
  const songNo = numberValue(song.songNo);
  if (!songNo) return null;
  const localizedName = locale === "ja" ? stringValue(song.songNameJa) : stringValue(song.songName);
  return {
    songNo,
    name: stringValue(song.name) || localizedName || stringValue(song.songName) || stringValue(song.songNameJa) || `ID ${songNo}`,
    subtitle: stringValue(song.subtitle),
    // Cached summaries created before the thumbnail rollout may still contain
    // the legacy proxy/original URL. The song number is the stable source of
    // truth, so every interactive story uses the lightweight derivative.
    coverUrl: songNo === 1405 ? "" : buildSongCoverThumbnailUrl(songNo, 400),
    playCount: song.playCount === undefined ? undefined : numberValue(song.playCount),
    activeDays: song.activeDays === undefined ? undefined : numberValue(song.activeDays),
    level: nullableNumber(song.level),
    stars: nullableNumber(song.stars),
    difficulty: stringValue(song.difficulty) || null,
    score: song.highScore === undefined ? null : numberValue(song.highScore),
    okCount: song.okCount === undefined ? null : numberValue(song.okCount),
    poundCount: song.poundCount === undefined ? null : numberValue(song.poundCount)
  };
};

type AnnualNarrativeContext = Record<string, string | number> & {
  mode: "version_observed" | "current_archive";
  profileBodyKey: "body" | "bodyWithTitle" | "bodyWithDan" | "bodyWithTitleAndDan";
};

const narrativeBlock = (
  t: Translate,
  key: string,
  context: AnnualNarrativeContext,
  bodyKey = "body"
): VersionSummaryCopyBlock => ({
  eyebrow: t(`annualSummary.copy.${key}.eyebrow`, context),
  title: t(`annualSummary.copy.${key}.title`, context),
  body: t(`annualSummary.copy.${key}.${bodyKey}`, context)
});

const makeCopy = (t: Translate, context: AnnualNarrativeContext): VersionSummaryViewModel["copy"] => ({
  opening: {
    eyebrow: t("annualSummary.copy.opening.eyebrow", context),
    title: t("annualSummary.copy.opening.title", context),
    subtitle: t("annualSummary.copy.opening.body", context)
  },
  profile: narrativeBlock(t, "profile", context, context.profileBodyKey),
  period: narrativeBlock(t, "period", context),
  overview: narrativeBlock(t, "overview", context, context.mode === "version_observed" ? "observedBody" : "archiveBody"),
  favoriteSong: narrativeBlock(t, "favorite", context, context.mode === "version_observed" ? "observedBody" : "archiveBody"),
  obsessionSong: narrativeBlock(t, "obsession", context),
  favoriteShift: narrativeBlock(t, "favoriteShift", context),
  monthlyFavorites: narrativeBlock(t, "monthly", context),
  weekdayActivity: narrativeBlock(t, "weekday", context),
  calendarActivity: narrativeBlock(t, "calendar", context),
  timeOfDay: narrativeBlock(t, "timeOfDay", context),
  lateNight: narrativeBlock(t, "lateNight", context),
  ratingRank: narrativeBlock(t, "rating", context),
  milestones: narrativeBlock(t, "milestones", context),
  keyword: narrativeBlock(t, "keyword", context),
  speedProfile: narrativeBlock(t, "speed", context),
  nearDondaful: narrativeBlock(t, "near", context),
  challenge: narrativeBlock(t, "challenge", context),
  pound: narrativeBlock(t, "pound", context),
  highScore: narrativeBlock(t, "highScore", context),
  breakthrough: narrativeBlock(t, "breakthrough", context),
  finalTitle: narrativeBlock(t, "final", context),
  poster: {
    eyebrow: t("annualSummary.copy.poster.eyebrow", context),
    title: t("annualSummary.copy.poster.title", context),
    subtitle: t("annualSummary.copy.poster.body", context)
  },
  controls: { versionLabel: t("annualSummary.drawer.version"), bindingLabel: t("annualSummary.drawer.binding"), refresh: t("annualSummary.controls.refresh") }
});

const formatMonth = (month: string, locale: "zh" | "ja") => {
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? month : new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "zh-CN", { year: "numeric", month: "long" }).format(date);
};

const formatDateTime = (value: unknown, locale: "zh" | "ja") => {
  const date = new Date(stringValue(value));
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
};

export const normalizeAnnualSummary = (
  input: VersionSummaryPayload["summary"],
  locale: "zh" | "ja",
  t: Translate
): VersionSummaryViewModel => {
  if (Number((input as AnnualSummaryV4).schemaVersion || 0) !== 4) {
    throw new Error("ANNUAL_SCHEMA_MISMATCH");
  }
  const raw = input as AnnualSummaryV4;
  const mapSong = makeSongMapper(locale);
  const version = record(raw.version);
  const coverage = record(raw.coverage);
  const timeCoverage = record(coverage.time);
  const profile = record(raw.profileCard);
  const period = record(raw.period);
  const overviewMetric = unwrapMetric(raw.overview);
  const overview = record(overviewMetric.data);
  const coverSongs = (Array.isArray(overview.coverSongs) ? overview.coverSongs : []).flatMap((item) => {
    const song = mapSong(item);
    return song ? [song] : [];
  });
  const sections = record(raw.sections);
  const getSection = (key: string) => unwrapMetric(sections[key]);
  const favoriteMetric = getSection("favoriteSong");
  const obsessionMetric = getSection("obsessionSong");
  const shiftMetric = getSection("favoriteShift");
  const monthlyMetric = getSection("monthlyFavorites");
  const weekdayMetric = getSection("weekdayActivity");
  const calendarMetric = getSection("calendarActivity");
  const timeMetric = getSection("timeOfDay");
  const lateMetric = getSection("lateNight");
  const keywordMetric = getSection("keyword");
  const ratingMetric = getSection("ratingRank");
  const speedMetric = getSection("speedProfile");
  const nearMetric = getSection("nearDondaful");
  const challengeMetric = getSection("challenge");
  const poundMetric = getSection("pound");
  const highScoreMetric = getSection("highScore");
  const milestonesMetric = getSection("milestones");
  const breakthroughMetric = getSection("breakthrough");

  const favoriteRaw = record(favoriteMetric.data);
  const favoriteSong = mapSong(favoriteRaw);
  if (favoriteSong) {
    favoriteSong.playCount = numberValue(favoriteRaw.playCount);
    favoriteSong.activeDays = numberValue(favoriteRaw.activeDays);
  }
  const obsessionRaw = record(obsessionMetric.data);
  const obsessionSong = mapSong(obsessionRaw);
  if (obsessionSong) {
    obsessionSong.playCount = numberValue(obsessionRaw.playCount);
    obsessionSong.activeDays = numberValue(obsessionRaw.activeDays);
  }

  const shiftRaw = record(shiftMetric.data);
  const oldFavorite = mapSong(shiftRaw.oldFavorite);
  const newFavorite = mapSong(shiftRaw.newFavorite);
  const favoriteShift = oldFavorite && newFavorite ? { oldFavorite, newFavorite } : null;

  const monthlyFavorites = (Array.isArray(monthlyMetric.data) ? monthlyMetric.data : []).flatMap((item) => {
    const row = record(item);
    const song = mapSong(row.song);
    if (!song) return [];
    const seconds = numberValue(row.estimatedSeconds);
    return [{
      month: stringValue(row.month),
      monthLabel: formatMonth(stringValue(row.month), locale),
      playCount: numberValue(row.playCount),
      estimatedSeconds: seconds,
      estimatedTimeText: seconds >= 3600 ? `${(seconds / 3600).toFixed(1)} h` : `${Math.round(seconds / 60)} min`,
      song
    }];
  });

  const weekdayRaw = record(weekdayMetric.data);
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "zh-CN", { weekday: "short" }).format(new Date(2026, 0, 5 + index)));
  const weekdayCounts = Array.isArray(weekdayRaw.counts) ? weekdayRaw.counts.map((value) => numberValue(value)) : [];
  const topWeekday = numberValue(weekdayRaw.topWeekday);
  const bottomWeekday = numberValue(weekdayRaw.bottomWeekday);
  const weekdayActivity = weekdayCounts.length === 7 ? {
    counts: weekdayCounts,
    labels: weekdayLabels,
    topWeekday,
    bottomWeekday,
    topLabel: weekdayLabels[topWeekday] || "—",
    bottomLabel: weekdayLabels[bottomWeekday] || "—",
    totalPlays: numberValue(weekdayRaw.totalPlays)
  } : null;

  const calendarRaw = record(calendarMetric.data);
  const calendarDaysRaw = Array.isArray(calendarRaw.days) ? calendarRaw.days : [];
  const calendarMax = Math.max(numberValue(calendarRaw.maxPlayCount), 1);
  const calendarActivity = calendarDaysRaw.length ? {
    days: calendarDaysRaw.map((item) => {
      const day = record(item); const count = numberValue(day.playCount);
      return { date: stringValue(day.date), playCount: count, intensity: Math.min(count / calendarMax, 1) };
    }),
    maxPlayCount: numberValue(calendarRaw.maxPlayCount), activeDays: numberValue(calendarRaw.activeDays),
    longestStreak: numberValue(calendarRaw.longestStreak), streakStart: stringValue(calendarRaw.streakStart) || null,
    streakEnd: stringValue(calendarRaw.streakEnd) || null,
    streakLabel: calendarRaw.streakStart && calendarRaw.streakEnd ? `${calendarRaw.streakStart} — ${calendarRaw.streakEnd}` : "—"
  } : null;

  const timeRaw = record(timeMetric.data);
  const rawPeriods = record(timeRaw.periods);
  const periodRanges: Record<string, string> = { early_morning: "05–08", morning: "09–11", noon: "12–13", afternoon: "14–17", evening: "18–21", late_night: "22–04" };
  const periods = Object.keys(periodRanges).map((key) => ({ key, label: t(`annualSummary.slides.time.periods.${key}`), range: periodRanges[key], playCount: numberValue(rawPeriods[key]) }));
  const favoriteHour = numberValue(timeRaw.favoriteHour);
  const timeOfDay = Array.isArray(timeRaw.hourlyCounts) ? {
    periods, hourlyCounts: timeRaw.hourlyCounts.map((value) => numberValue(value)), topPeriod: stringValue(timeRaw.topPeriod),
    topLabel: t(`annualSummary.slides.time.periods.${stringValue(timeRaw.topPeriod)}`), favoriteHour,
    favoriteHourLabel: `${String(favoriteHour).padStart(2, "0")}:00`, favoriteSong: mapSong(timeRaw.favoriteSong), totalPlays: numberValue(timeRaw.totalPlays)
  } : null;

  const lateRaw = record(lateMetric.data);
  const lateSong = mapSong(lateRaw.song);
  const lateNight = lateSong ? { playCount: numberValue(lateRaw.playCount), activeDays: numberValue(lateRaw.activeDays), latestAt: stringValue(lateRaw.latestAt), latestLabel: formatDateTime(lateRaw.latestAt, locale), song: lateSong } : null;

  const keywordRaw = record(keywordMetric.data);
  const dimensionKey = stringValue(keywordRaw.dimensionKey);
  const keywordTitleKey = stringValue(keywordRaw.titleKey);
  const keywordScore = numberValue(keywordRaw.score);
  const keyword = dimensionKey ? {
    dimensionKey,
    dimensionLabel: t(`annualSummary.keywords.dimensions.${dimensionKey}`),
    titleKey: keywordTitleKey,
    title: t(`annualSummary.keywords.titles.${keywordTitleKey}`),
    score: keywordScore,
    radarValues: record(keywordRaw.radarValues) as Record<string, number>,
    body: t("annualSummary.keywords.body", { dimension: t(`annualSummary.keywords.dimensions.${dimensionKey}`), score: keywordScore.toFixed(2) })
  } : null;

  const ratingRaw = record(ratingMetric.data);
  const ratingDistributionRaw = record(ratingRaw.distribution);
  const ratingRank = ratingMetric.status !== "unavailable" ? {
    rating: numberValue(ratingRaw.rating), rank: numberValue(ratingRaw.rank), rankMin: nullableNumber(ratingRaw.rankMin), rankMax: nullableNumber(ratingRaw.rankMax),
    sampleSize: numberValue(ratingRaw.sampleSize), percentile: numberValue(ratingRaw.percentile), tier: stringValue(ratingRaw.tier), generatedAt: stringValue(ratingRaw.asOf, raw.generatedAt),
    rankKey: stringValue(ratingRaw.rankKey) || null, rankLabel: stringValue(ratingRaw.rankLabel) || null,
    distribution: Array.isArray(ratingDistributionRaw.ranks) ? {
      ratingMin: numberValue(ratingDistributionRaw.ratingMin),
      ratingMax: numberValue(ratingDistributionRaw.ratingMax),
      ratingStep: numberValue(ratingDistributionRaw.ratingStep),
      ranks: ratingDistributionRaw.ranks.flatMap((item) => {
        const rankRow = record(item);
        const bins = Array.isArray(rankRow.bins) ? rankRow.bins.flatMap((bin) => {
          const binRow = record(bin);
          return [{
            ratingMin: numberValue(binRow.ratingMin),
            ratingMax: numberValue(binRow.ratingMax),
            relative: Math.min(1, Math.max(0, numberValue(binRow.relative)))
          }];
        }) : [];
        return [{
          key: stringValue(rankRow.key),
          label: stringValue(rankRow.label),
          order: numberValue(rankRow.order),
          colorGroup: ["low", "mid", "high"].includes(stringValue(rankRow.colorGroup)) ? stringValue(rankRow.colorGroup) as "low" | "mid" | "high" : undefined,
          bins
        }];
      })
    } : null
  } : null;

  const speedRaw = record(speedMetric.data);
  const speedProfile = speedMetric.status !== "unavailable" ? { speed: numberValue(speedRaw.speed), chartCount: numberValue(speedRaw.chartCount), eligibleChartCount: numberValue(speedRaw.eligibleChartCount) } : null;
  const nearRaw = record(nearMetric.data); const nearSong = mapSong(nearRaw);
  const nearDondaful = nearSong ? { song: nearSong, okCount: numberValue(nearRaw.okCount), score: numberValue(nearRaw.highScore) } : null;
  const challengeRaw = record(challengeMetric.data); const challengeSong = mapSong(challengeRaw);
  const challenge = challengeSong ? {
    song: challengeSong,
    playCount: numberValue(challengeRaw.playCount),
    observedPlayCount: numberValue(challengeRaw.observedPlayCount, numberValue(challengeRaw.playCount)),
    level: nullableNumber(challengeRaw.stars)
  } : null;
  const poundRaw = record(poundMetric.data); const poundTopSong = mapSong(poundRaw.topSong);
  const poundSpeed = [poundRaw.speed, poundRaw.maxSpeed, poundRaw.topSpeed, poundRaw.hitsPerSecond].map(nullableNumber).find((value) => value !== null) ?? null;
  const pound = poundMetric.status !== "unavailable" ? { totalPoundCount: numberValue(poundRaw.totalPoundCount), topSong: poundTopSong, topPoundCount: numberValue(poundRaw.topPoundCount), speed: poundSpeed } : null;
  const highRaw = record(highScoreMetric.data); const highSong = mapSong(highRaw);
  const highScore = highSong ? { song: highSong, score: numberValue(highRaw.highScore), occurredAt: stringValue(highRaw.recordedAt) || null, happenedLabel: formatDateTime(highRaw.recordedAt, locale) } : null;

  const milestones = (Array.isArray(milestonesMetric.data) ? milestonesMetric.data : []).flatMap((item) => {
    const row = record(item); const song = mapSong(row.song); if (!song) return [];
    const type = stringValue(row.type); const observed = record(row.observedBetween);
    return [{
      type,
      title: t(`annualSummary.milestoneTypes.${type}`),
      occurredAt: stringValue(row.observedAt) || stringValue(observed.to),
      happenedLabel: formatDateTime(row.observedAt || observed.to, locale),
      level: song.level ?? null,
      song,
      playCount: numberValue(row.playCount, song.playCount || 0),
      observedPlayCount: numberValue(row.observedPlayCount),
      achievementCount: numberValue(row.achievementCount)
    }];
  });

  const breakthroughRaw = record(breakthroughMetric.data);
  const breakthroughType = stringValue(breakthroughRaw.type);
  const breakthroughSong = mapSong(breakthroughRaw);
  const breakthroughTitleKey = breakthroughType ? `breakthrough_${breakthroughType}` : "encouragement";
  const localizedInteger = new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "zh-CN");
  const localizedRating = new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "zh-CN", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const breakthroughEvidence: VersionSummaryBreakthrough["evidence"] = [];
  if (breakthroughType === "dan") {
    breakthroughEvidence.push({
      key: "dan",
      label: t("annualSummary.slides.breakthrough.dan"),
      value: `${formatDanGrade(String(numberValue(breakthroughRaw.danBefore)), locale)} → ${formatDanGrade(String(numberValue(breakthroughRaw.danAfter)), locale)}`
    });
  } else if (breakthroughType === "rating_gain") {
    breakthroughEvidence.push({
      key: "ratingDelta",
      label: t("annualSummary.slides.breakthrough.ratingGain"),
      value: `+${localizedRating.format(numberValue(breakthroughRaw.ratingDelta))}`
    });
    breakthroughEvidence.push({
      key: "ratingRange",
      label: t("annualSummary.slides.breakthrough.ratingJourney"),
      value: `${localizedRating.format(numberValue(breakthroughRaw.ratingBefore))} → ${localizedRating.format(numberValue(breakthroughRaw.ratingAfter))}`
    });
  } else if (breakthroughType) {
    const plays = numberValue(breakthroughRaw.playCount);
    if (plays > 0) {
      breakthroughEvidence.push({
        key: "plays",
        label: t("annualSummary.slides.breakthrough.songAttempts"),
        value: t("annualSummary.slides.breakthrough.times", { count: localizedInteger.format(plays) })
      });
    }
    const stars = nullableNumber(breakthroughRaw.stars);
    if (stars !== null) {
      breakthroughEvidence.push({ key: "stars", label: t("annualSummary.slides.breakthrough.difficulty"), value: `★${stars}` });
    }
  }
  const breakthrough = {
    type: breakthroughType || "none", occurredAt: stringValue(breakthroughRaw.occurredAt) || null, song: breakthroughSong,
    scoreDelta: numberValue(breakthroughRaw.ratingDelta ?? breakthroughRaw.scoreDelta), playDelta: numberValue(breakthroughRaw.playCount),
    title: t(`annualSummary.breakthroughTitles.${breakthroughTitleKey}.title`), body: t(`annualSummary.breakthroughTitles.${breakthroughTitleKey}.body`),
    happenedLabel: breakthroughRaw.occurredAt ? formatDateTime(breakthroughRaw.occurredAt, locale) : t("annualSummary.common.observed"),
    evidence: breakthroughEvidence
  };

  const finalRaw = record(raw.finalTitle);
  const finalTitleKey = stringValue(finalRaw.titleKey, "encouragement");
  const finalEvidenceKey = stringValue(finalRaw.evidenceKey, "mode");
  const finalEvidenceValue = finalRaw.evidenceValue;
  // Copy-3B: the Finale reads the curated `finalTitles` dictionary. Strong Dan results
  // additionally switch the *presentation* title (same titleKey, deterministic mapping
  // from the evidence key) -- the Poster consumes the resolved title so both stay equal.
  const finalPresentationKey = DAN_PRESENTATION_EVIDENCE.has(finalEvidenceKey)
    ? `annualSummary.danPresentation.${finalEvidenceKey}.title`
    : `annualSummary.finalTitles.${finalTitleKey}.title`;
  const finalTitleLabel = t(finalPresentationKey) || t(`annualSummary.finalTitles.${finalTitleKey}.title`);
  const finalEvidence = renderFinalEvidence(finalEvidenceKey, finalEvidenceValue, {
    t, locale, breakthroughTitle: breakthrough.title, keywordTitle: keyword?.title, finalTitleLabel
  }) ?? { label: t("annualSummary.slides.final.fromJourney"), text: t(raw.mode === "current_archive" ? "annualSummary.common.archive" : "annualSummary.common.observed") };
  const finalTitle = {
    title: finalTitleLabel, eyebrow: t("annualSummary.copy.final.eyebrow"),
    // Curated zh body; the ja dictionary intentionally ships titles only until a ja body
    // pass lands, so ja keeps the existing localised closing line (never the zh text).
    // (`copy` is built below, so the ja branch is filled in there.)
    body: locale === "ja" ? "" : t(`annualSummary.finalTitles.${finalTitleKey}.body`),
    themeKey: finalTitleKey,
    evidenceKey: finalEvidenceKey, evidenceValue: finalEvidenceValue,
    evidenceLabel: finalEvidence.label, evidenceText: finalEvidence.text
  };
  const nickname = stringValue(profile.nickname, locale === "ja" ? "太鼓プレイヤー" : "太鼓玩家");
  const mode = raw.mode === "current_archive" ? "current_archive" : "version_observed";
  const playCount = numberValue(overview.playCount);
  const activeDays = period.activeDays === null || period.activeDays === undefined ? 0 : numberValue(period.activeDays);
  const uniqueSongs = numberValue(overview.uniqueSongs);
  const uniqueCharts = numberValue(overview.uniqueCharts);
  const formatNumber = localizedInteger.format;
  const profileTitle = stringValue(profile.title);
  const profileDan = formatDanGrade(profile.danName, locale);
  const profileBodyKey = profileTitle && profileDan
    ? "bodyWithTitleAndDan"
    : profileTitle
      ? "bodyWithTitle"
      : profileDan
        ? "bodyWithDan"
        : "body";
  const monthlyHighlight = monthlyFavorites.reduce<VersionSummaryViewModel["monthlyFavorites"][number] | null>(
    (best, item) => !best || item.playCount > best.playCount ? item : best,
    null
  );
  const ratingRankMin = ratingRank?.rankMin || ratingRank?.rank || 0;
  const ratingRankMax = ratingRank?.rankMax || ratingRank?.rank || ratingRankMin;
  const ratingPosition = ratingRankMin && ratingRankMax && ratingRankMin !== ratingRankMax
    ? `#${formatNumber(ratingRankMin)}–${formatNumber(ratingRankMax)}`
    : ratingRankMin
      ? `#${formatNumber(ratingRankMin)}`
      : "—";
  // The Period page reports how long the player's own story has been running, so
  // it counts from the first record the backend actually observed for this
  // account up to the moment that report was generated. `firstActualPlayDate` is
  // that anchor as published by the generator; the window-scoped fields remain
  // only as a fallback for summaries generated before the anchor existed.
  const firstActualPlayDay = calendarParts(period.firstActualPlayDate);
  const earliestPlayDay = firstActualPlayDay
    || earliestCalendarDay([
      calendarParts(period.firstRecordAt),
      ...(calendarActivity?.days.map((day) => day.date) || [])
    ]);
  // "Now" is the backend generation timestamp, never the visitor's clock: the
  // figure has to be identical on the server render, on hydration and on a later
  // reopen, and must not depend on a local time zone.
  const generatedDay = calendarParts(raw.generatedAt);
  const periodTotalDays = (() => {
    const storySpan = earliestPlayDay && generatedDay ? calendarDaySpan(earliestPlayDay, generatedDay) : null;
    // Without a provable first record the only honest figure left is what the
    // algorithm reported for its own window.
    return storySpan ?? numberValue(period.totalDays);
  })();
  const narrativeContext: AnnualNarrativeContext = {
    mode,
    profileBodyKey,
    nickname,
    playerTitle: profileTitle,
    dan: profileDan,
    playCount: formatNumber(playCount),
    uniqueSongs: formatNumber(uniqueSongs),
    uniqueCharts: formatNumber(uniqueCharts),
    totalDays: formatNumber(periodTotalDays),
    activeDays: formatNumber(activeDays),
    favoriteSong: favoriteSong?.name || "—",
    favoriteCount: formatNumber(favoriteSong?.playCount || 0),
    obsessionSong: obsessionSong?.name || "—",
    obsessionDays: formatNumber(obsessionSong?.activeDays || 0),
    oldFavorite: oldFavorite?.name || "—",
    newFavorite: newFavorite?.name || "—",
    keywordTitle: keyword?.title || finalTitle.title,
    keywordDimension: keyword?.dimensionLabel || "—",
    rating: ratingRank ? ratingRank.rating.toFixed(4) : "—",
    ratingPosition,
    ratingSample: formatNumber(ratingRank?.sampleSize || 0),
    ratingTier: ratingRank?.tier ? t(`annualSummary.slides.rating.tiers.${ratingRank.tier}`) : "—",
    monthlyMonth: monthlyHighlight?.monthLabel || "—",
    monthlySong: monthlyHighlight?.song.name || "—",
    topWeekday: weekdayActivity?.topLabel || "—",
    calendarDays: formatNumber(calendarActivity?.activeDays || 0),
    longestStreak: formatNumber(calendarActivity?.longestStreak || 0),
    favoriteHour: timeOfDay?.favoriteHourLabel || "—",
    timeSong: timeOfDay?.favoriteSong?.name || "—",
    lateTime: lateNight?.latestLabel || "—",
    lateNights: formatNumber(lateNight?.activeDays || 0),
    lateSong: lateNight?.song.name || "—",
    speed: speedProfile?.speed || 0,
    speedCharts: formatNumber(speedProfile?.chartCount || 0),
    nearSong: nearDondaful?.song.name || "—",
    nearOk: formatNumber(nearDondaful?.okCount || 0),
    challengeSong: challenge?.song.name || "—",
    challengeCount: formatNumber(challenge?.playCount || 0),
    poundTotal: formatNumber(pound?.totalPoundCount || 0),
    poundSong: pound?.topSong?.name || "—",
    poundTop: formatNumber(pound?.topPoundCount || 0),
    highScoreSong: highScore?.song.name || "—",
    highScoreValue: formatNumber(highScore?.score || 0),
    highScoreTime: highScore?.happenedLabel || "—",
    milestoneCount: formatNumber(milestones.length),
    breakthroughTitle: breakthrough.title,
    breakthroughSong: breakthrough.song?.name || breakthrough.title,
    finalTitle: finalTitle.title
  };
  const copy = makeCopy(t, narrativeContext);
  breakthrough.body = copy.breakthrough.body;
  // FinalTitle body = curated per-key copy (Copy-3B). The ja dictionary intentionally
  // ships titles only until a ja body pass lands, so ja keeps the existing localised
  // closing line; the zh copy is never overwritten.
  const narrativeBody = locale === "ja" ? copy.finalTitle.body : finalTitle.body;
  // The Finale has no dedicated evidence node (and Copy-3B must not add DOM), so the
  // evidence is composed into the existing body slot: "<evidence>｜<narrative>".
  finalTitle.body = finalEvidence.text ? `${finalEvidence.text}｜${narrativeBody}` : narrativeBody;
  if (keyword) keyword.body = copy.keyword.body;

  return {
    schemaVersion: 4, summaryId: raw.summaryId, generatedAt: raw.generatedAt, mode, user: { nickname },
    profileCard: { nickname, title: stringValue(profile.title) || null, titleplateId: nullableNumber(profile.titleplateId), danName: profileDan || null, danLevel: nullableNumber(profile.danLevel), myDonUrl: stringValue(profile.myDonUrl) || null },
    version: {
      key: stringValue(version.key, "annual_2026"),
      name: t("annualSummary.name"),
      startDate: stringValue(version.startDate, "2026-01-01"),
      endDate: stringValue(version.endDate) || null,
      effectiveEndDate: stringValue(version.effectiveEndDate, raw.generatedAt.slice(0, 10)),
      isOngoing: version.isOngoing !== false
    },
    coverage: { snapshotCount: numberValue(coverage.snapshotCount), firstSnapshotAt: stringValue(coverage.firstSnapshotAt) || null, lastSnapshotAt: stringValue(coverage.lastSnapshotAt) || null, partialStart: Boolean(coverage.partialStart) },
    timeCoverage: { status: stringValue(timeCoverage.status, "unavailable") as AnnualMetricStatus, ratio: numberValue(timeCoverage.ratio), trustedPlayCount: numberValue(timeCoverage.trustedProxyPlayCount), totalPlayCount: numberValue(timeCoverage.totalObservedPlayCount), precision: timeCoverage.eligible ? "batch_last_play_proxy" : "none", note: null },
    period: { firstActualPlayDate: firstActualPlayDay || null, firstRecordAt: stringValue(period.firstRecordAt) || null, lastRecordAt: stringValue(period.lastRecordAt) || null, totalDays: periodTotalDays, activeDays },
    overview: { playCount, uniqueSongs, uniqueCharts: numberValue(overview.uniqueCharts), estimatedSeconds: numberValue(overview.estimatedSeconds), estimatedTimeText: stringValue(overview.estimatedTimeText) || (numberValue(overview.estimatedSeconds) >= 3600 ? `${(numberValue(overview.estimatedSeconds) / 3600).toFixed(1)} h` : `${Math.round(numberValue(overview.estimatedSeconds) / 60)} min`), currentClearCharts: numberValue(overview.currentClearCharts), currentFullComboCharts: numberValue(overview.currentFullComboCharts), currentDondafulCharts: numberValue(overview.currentDondafulCharts), currentKiwamiCharts: numberValue(overview.currentKiwamiCharts) },
    coverSongs,
    favoriteSong, obsessionSong, favoriteShift, monthlyFavorites, weekdayActivity, calendarActivity, timeOfDay, lateNight,
    milestones, ratingRank, speedProfile, nearDondaful, challenge, pound, highScore, keyword, keywordProfile: keyword,
    breakthrough, finalTitle,
    poster: { title: copy.poster.title, subtitle: copy.poster.subtitle, finalTitle: finalTitle.title, periodLabel: `${stringValue(version.startDate, "2026-01-01")} — ${stringValue(version.effectiveEndDate, raw.generatedAt.slice(0, 10))}`, favoriteSong: favoriteSong?.name || "", keyword: keyword?.title || "", closingLine: finalTitle.body, shareCopy: `${nickname} · ${finalTitle.title}`, stats: [{ label: t("annualSummary.slides.overview.plays"), value: String(playCount) }, { label: t("annualSummary.slides.overview.songs"), value: String(uniqueSongs) }, { label: t("annualSummary.slides.overview.clear"), value: String(numberValue(overview.currentClearCharts)) }] },
    story: { pageCount: 0, pageKeys: [] },
    sectionStatus: { profile: "exact", period: stringValue(period.status, raw.mode === "version_observed" ? "observed" : "exact") as AnnualMetricStatus, overview: overviewMetric.status, favoriteSong: favoriteMetric.status, obsessionSong: obsessionMetric.status, favoriteShift: shiftMetric.status, keyword: keywordMetric.status, ratingRank: ratingMetric.status, monthlyFavorites: monthlyMetric.status, weekdayActivity: weekdayMetric.status, calendarActivity: calendarMetric.status, timeOfDay: timeMetric.status, lateNight: lateMetric.status, speedProfile: speedMetric.status, nearDondaful: nearMetric.status, challenge: challengeMetric.status, pound: poundMetric.status, highScore: highScoreMetric.status, milestones: milestonesMetric.status, breakthrough: breakthroughMetric.status, finalTitle: "exact", poster: "exact" },
    copy,
    flags: { newcomer: finalTitleKey === "newcomer", insufficientData: mode === "current_archive" }
  } as VersionSummaryViewModel;
};

const metricHasPayload = (data: unknown) =>
  data !== null && data !== undefined && (!Array.isArray(data) || data.length > 0);

// A section is only worth a story page when the algorithm published it AND the
// payload can actually be rendered. Treating a published-but-empty section as
// visible would mount a full-height page with nothing on it.
export const metricAvailable = (status: AnnualMetricStatus | undefined, data: unknown) =>
  status ? status !== "unavailable" && metricHasPayload(data) : metricHasPayload(data);
