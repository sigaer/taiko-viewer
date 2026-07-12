import { computed, type Component, type Ref } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { metricAvailable } from "~/utils/annualSummary";

import OpeningSlide from "~/components/account/version-summary/slides/OpeningSlide.vue";
import ProfileSlide from "~/components/account/version-summary/slides/ProfileSlide.vue";
import PeriodSlide from "~/components/account/version-summary/slides/PeriodSlide.vue";
import OverviewSlide from "~/components/account/version-summary/slides/OverviewSlide.vue";
import FavoriteSongSlide from "~/components/account/version-summary/slides/FavoriteSongSlide.vue";
import ObsessionSongSlide from "~/components/account/version-summary/slides/ObsessionSongSlide.vue";
import FavoriteShiftSlide from "~/components/account/version-summary/slides/FavoriteShiftSlide.vue";
import KeywordSlide from "~/components/account/version-summary/slides/KeywordSlide.vue";
import RatingRankSlide from "~/components/account/version-summary/slides/RatingRankSlide.vue";
import MonthlyFavoritesSlide from "~/components/account/version-summary/slides/MonthlyFavoritesSlide.vue";
import WeekdayActivitySlide from "~/components/account/version-summary/slides/WeekdayActivitySlide.vue";
import CalendarActivitySlide from "~/components/account/version-summary/slides/CalendarActivitySlide.vue";
import TimeOfDaySlide from "~/components/account/version-summary/slides/TimeOfDaySlide.vue";
import LateNightSlide from "~/components/account/version-summary/slides/LateNightSlide.vue";
import SpeedProfileSlide from "~/components/account/version-summary/slides/SpeedProfileSlide.vue";
import NearDondafulSlide from "~/components/account/version-summary/slides/NearDondafulSlide.vue";
import ChallengeSlide from "~/components/account/version-summary/slides/ChallengeSlide.vue";
import PoundSlide from "~/components/account/version-summary/slides/PoundSlide.vue";
import HighScoreSlide from "~/components/account/version-summary/slides/HighScoreSlide.vue";
import MilestonesSlide from "~/components/account/version-summary/slides/MilestonesSlide.vue";
import BreakthroughSlide from "~/components/account/version-summary/slides/BreakthroughSlide.vue";
import FinalTitleSlide from "~/components/account/version-summary/slides/FinalTitleSlide.vue";
import PosterSlide from "~/components/account/version-summary/slides/PosterSlide.vue";

export type AnnualChapterKey = "debut" | "habits" | "preference" | "growth" | "keepsake";
export type AnnualPageKey =
  | "opening" | "profile" | "period" | "overview"
  | "favorite" | "obsession" | "favoriteShift" | "keyword" | "ratingRank"
  | "monthly" | "weekday" | "calendar" | "timeOfDay" | "lateNight"
  | "speedProfile" | "nearDondaful" | "challenge" | "pound" | "highScore" | "milestones" | "breakthrough"
  | "final" | "poster";

export type AnnualPageDefinition = {
  key: AnnualPageKey;
  chapter: AnnualChapterKey;
  component: Component;
  labelKey: string;
  visible: (summary: VersionSummaryViewModel) => boolean;
};

const always = () => true;
const has = (field: keyof VersionSummaryViewModel, statusKey = field as keyof NonNullable<VersionSummaryViewModel["sectionStatus"]>) =>
  (summary: VersionSummaryViewModel) => metricAvailable(summary.sectionStatus?.[statusKey], summary[field]);

export const ANNUAL_PAGE_REGISTRY: readonly AnnualPageDefinition[] = [
  { key: "opening", chapter: "debut", component: OpeningSlide, labelKey: "annualSummary.pages.opening", visible: always },
  { key: "profile", chapter: "debut", component: ProfileSlide, labelKey: "annualSummary.pages.profile", visible: always },
  { key: "period", chapter: "debut", component: PeriodSlide, labelKey: "annualSummary.pages.period", visible: always },
  { key: "overview", chapter: "debut", component: OverviewSlide, labelKey: "annualSummary.pages.overview", visible: always },

  { key: "favorite", chapter: "habits", component: FavoriteSongSlide, labelKey: "annualSummary.pages.favorite", visible: has("favoriteSong") },
  { key: "obsession", chapter: "habits", component: ObsessionSongSlide, labelKey: "annualSummary.pages.obsession", visible: has("obsessionSong") },
  { key: "favoriteShift", chapter: "habits", component: FavoriteShiftSlide, labelKey: "annualSummary.pages.favoriteShift", visible: has("favoriteShift") },
  { key: "keyword", chapter: "habits", component: KeywordSlide, labelKey: "annualSummary.pages.keyword", visible: has("keyword") },
  { key: "ratingRank", chapter: "habits", component: RatingRankSlide, labelKey: "annualSummary.pages.ratingRank", visible: has("ratingRank") },

  { key: "monthly", chapter: "preference", component: MonthlyFavoritesSlide, labelKey: "annualSummary.pages.monthly", visible: has("monthlyFavorites") },
  { key: "weekday", chapter: "preference", component: WeekdayActivitySlide, labelKey: "annualSummary.pages.weekday", visible: has("weekdayActivity") },
  { key: "calendar", chapter: "preference", component: CalendarActivitySlide, labelKey: "annualSummary.pages.calendar", visible: has("calendarActivity") },
  { key: "timeOfDay", chapter: "preference", component: TimeOfDaySlide, labelKey: "annualSummary.pages.timeOfDay", visible: has("timeOfDay") },
  { key: "lateNight", chapter: "preference", component: LateNightSlide, labelKey: "annualSummary.pages.lateNight", visible: has("lateNight") },

  { key: "speedProfile", chapter: "growth", component: SpeedProfileSlide, labelKey: "annualSummary.pages.speedProfile", visible: has("speedProfile") },
  { key: "nearDondaful", chapter: "growth", component: NearDondafulSlide, labelKey: "annualSummary.pages.nearDondaful", visible: has("nearDondaful") },
  { key: "challenge", chapter: "growth", component: ChallengeSlide, labelKey: "annualSummary.pages.challenge", visible: has("challenge") },
  { key: "pound", chapter: "growth", component: PoundSlide, labelKey: "annualSummary.pages.pound", visible: has("pound") },
  { key: "highScore", chapter: "growth", component: HighScoreSlide, labelKey: "annualSummary.pages.highScore", visible: has("highScore") },
  { key: "milestones", chapter: "growth", component: MilestonesSlide, labelKey: "annualSummary.pages.milestones", visible: has("milestones") },
  { key: "breakthrough", chapter: "growth", component: BreakthroughSlide, labelKey: "annualSummary.pages.breakthrough", visible: has("breakthrough") },

  { key: "final", chapter: "keepsake", component: FinalTitleSlide, labelKey: "annualSummary.pages.final", visible: always },
  { key: "poster", chapter: "keepsake", component: PosterSlide, labelKey: "annualSummary.pages.poster", visible: always }
] as const;

export const useAnnualPages = (summary: Ref<VersionSummaryViewModel>, locale: Ref<string>) => {
  const { t } = useI18n();
  const pages = computed(() => ANNUAL_PAGE_REGISTRY.filter((page) => page.visible(summary.value)));
  const localizedPages = computed(() => pages.value.map((page) => ({
    ...page,
    labelText: t(page.labelKey),
    chapterLabel: t(`annualSummary.chapters.${page.chapter}`)
  })));
  return { pages: localizedPages };
};
