import type { OrdinaryRecommendationItem, OrdinaryRecommendationsPayload, PlayerRatingIntelligence } from "./recommendation-intelligence";

export type PersonalRatingSummary = PlayerRatingIntelligence;

export type PersonalRecommendation = OrdinaryRecommendationItem & { song_id: number; is_unplayed: boolean };

export type PersonalRecommendationsPayload = Omit<OrdinaryRecommendationsPayload, "items"> & { items: PersonalRecommendation[] };
