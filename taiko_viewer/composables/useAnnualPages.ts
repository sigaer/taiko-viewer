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
export type AnnualSceneIntensity = "low" | "medium" | "high";
export type AnnualSceneMood = "rainbow-stage" | "stage-blue" | "bright-impact" | "cover-spectrum" | "time-blue" | "midnight" | "award-purple" | "award-stage";
export type AnnualTransitionKey = "fade" | "slide" | "taiko-ripple" | "cover-turn" | "night-fade" | "gold-burst";
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
  bgMood: AnnualSceneMood;
  intensity: AnnualSceneIntensity;
  transitionIn: AnnualTransitionKey;
  transitionOut: AnnualTransitionKey;
  visible: (summary: VersionSummaryViewModel) => boolean;
};

const always = () => true;
const has = (field: keyof VersionSummaryViewModel, statusKey = field as keyof NonNullable<VersionSummaryViewModel["sectionStatus"]>) =>
  (summary: VersionSummaryViewModel) => metricAvailable(summary.sectionStatus?.[statusKey], summary[field]);

export const ANNUAL_PAGE_REGISTRY: readonly AnnualPageDefinition[] = [
  { key: "opening", chapter: "debut", component: OpeningSlide, labelKey: "annualSummary.pages.opening", bgMood: "rainbow-stage", intensity: "high", transitionIn: "fade", transitionOut: "taiko-ripple", visible: always },
  { key: "profile", chapter: "debut", component: ProfileSlide, labelKey: "annualSummary.pages.profile", bgMood: "stage-blue", intensity: "medium", transitionIn: "taiko-ripple", transitionOut: "fade", visible: always },
  { key: "period", chapter: "debut", component: PeriodSlide, labelKey: "annualSummary.pages.period", bgMood: "stage-blue", intensity: "medium", transitionIn: "fade", transitionOut: "cover-turn", visible: always },
  { key: "overview", chapter: "debut", component: OverviewSlide, labelKey: "annualSummary.pages.overview", bgMood: "bright-impact", intensity: "high", transitionIn: "cover-turn", transitionOut: "fade", visible: always },

  { key: "favorite", chapter: "habits", component: FavoriteSongSlide, labelKey: "annualSummary.pages.favorite", bgMood: "cover-spectrum", intensity: "high", transitionIn: "fade", transitionOut: "slide", visible: has("favoriteSong") },
  { key: "obsession", chapter: "habits", component: ObsessionSongSlide, labelKey: "annualSummary.pages.obsession", bgMood: "cover-spectrum", intensity: "medium", transitionIn: "slide", transitionOut: "slide", visible: has("obsessionSong") },
  { key: "favoriteShift", chapter: "habits", component: FavoriteShiftSlide, labelKey: "annualSummary.pages.favoriteShift", bgMood: "cover-spectrum", intensity: "medium", transitionIn: "slide", transitionOut: "slide", visible: has("favoriteShift") },
  { key: "keyword", chapter: "habits", component: KeywordSlide, labelKey: "annualSummary.pages.keyword", bgMood: "cover-spectrum", intensity: "high", transitionIn: "slide", transitionOut: "fade", visible: has("keyword") },
  { key: "ratingRank", chapter: "habits", component: RatingRankSlide, labelKey: "annualSummary.pages.ratingRank", bgMood: "cover-spectrum", intensity: "medium", transitionIn: "fade", transitionOut: "slide", visible: has("ratingRank") },

  { key: "monthly", chapter: "preference", component: MonthlyFavoritesSlide, labelKey: "annualSummary.pages.monthly", bgMood: "time-blue", intensity: "medium", transitionIn: "slide", transitionOut: "slide", visible: has("monthlyFavorites") },
  { key: "weekday", chapter: "preference", component: WeekdayActivitySlide, labelKey: "annualSummary.pages.weekday", bgMood: "time-blue", intensity: "low", transitionIn: "slide", transitionOut: "slide", visible: has("weekdayActivity") },
  { key: "calendar", chapter: "preference", component: CalendarActivitySlide, labelKey: "annualSummary.pages.calendar", bgMood: "time-blue", intensity: "medium", transitionIn: "slide", transitionOut: "slide", visible: has("calendarActivity") },
  { key: "timeOfDay", chapter: "preference", component: TimeOfDaySlide, labelKey: "annualSummary.pages.timeOfDay", bgMood: "time-blue", intensity: "medium", transitionIn: "slide", transitionOut: "night-fade", visible: has("timeOfDay") },
  { key: "lateNight", chapter: "preference", component: LateNightSlide, labelKey: "annualSummary.pages.lateNight", bgMood: "midnight", intensity: "high", transitionIn: "night-fade", transitionOut: "fade", visible: has("lateNight") },

  { key: "speedProfile", chapter: "growth", component: SpeedProfileSlide, labelKey: "annualSummary.pages.speedProfile", bgMood: "award-purple", intensity: "medium", transitionIn: "fade", transitionOut: "slide", visible: has("speedProfile") },
  { key: "nearDondaful", chapter: "growth", component: NearDondafulSlide, labelKey: "annualSummary.pages.nearDondaful", bgMood: "award-purple", intensity: "medium", transitionIn: "slide", transitionOut: "slide", visible: has("nearDondaful") },
  { key: "challenge", chapter: "growth", component: ChallengeSlide, labelKey: "annualSummary.pages.challenge", bgMood: "award-purple", intensity: "medium", transitionIn: "slide", transitionOut: "slide", visible: has("challenge") },
  { key: "pound", chapter: "growth", component: PoundSlide, labelKey: "annualSummary.pages.pound", bgMood: "award-purple", intensity: "medium", transitionIn: "slide", transitionOut: "slide", visible: has("pound") },
  { key: "highScore", chapter: "growth", component: HighScoreSlide, labelKey: "annualSummary.pages.highScore", bgMood: "award-purple", intensity: "high", transitionIn: "slide", transitionOut: "gold-burst", visible: has("highScore") },
  { key: "milestones", chapter: "growth", component: MilestonesSlide, labelKey: "annualSummary.pages.milestones", bgMood: "award-purple", intensity: "medium", transitionIn: "gold-burst", transitionOut: "slide", visible: has("milestones") },
  { key: "breakthrough", chapter: "growth", component: BreakthroughSlide, labelKey: "annualSummary.pages.breakthrough", bgMood: "award-stage", intensity: "high", transitionIn: "gold-burst", transitionOut: "gold-burst", visible: has("breakthrough") },

  { key: "final", chapter: "keepsake", component: FinalTitleSlide, labelKey: "annualSummary.pages.final", bgMood: "award-stage", intensity: "high", transitionIn: "gold-burst", transitionOut: "fade", visible: always },
  { key: "poster", chapter: "keepsake", component: PosterSlide, labelKey: "annualSummary.pages.poster", bgMood: "award-stage", intensity: "medium", transitionIn: "fade", transitionOut: "fade", visible: always }
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
