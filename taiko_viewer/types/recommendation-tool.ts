import type { OrdinaryRecommendationItem } from './recommendation-intelligence';
import type { GoalType, PlayerGoal } from './player-goal';
export type RecommendationToolPayload = {
  model: 'v1'; basis: string; profileId: string; scoreRevision: string; generatedAt: string;
  items: Array<OrdinaryRecommendationItem & {starLevel:number|null; recommendationToken:string; canCreateGoal:boolean}>;
  image: string | null;
};
export type RecommendationGoalPreview = {
  profileId:string; scoreRevision:string; songId:number; difficultyType:number; title:string; starLevel:number|null;
  goalOptions:GoalType[]; activeGoal:PlayerGoal|null;
};
