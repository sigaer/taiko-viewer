export type PersonalRatingSummary = {
  current: number | null;
  scoreCount: number;
};

export type PersonalRecommendation = {
  title: string;
  song_id: number;
  level: number;
  is_unplayed: boolean;
  user_indicator: number;
  reference_indicator: number;
};

export type PersonalRecommendationsPayload = {
  items: PersonalRecommendation[];
};
