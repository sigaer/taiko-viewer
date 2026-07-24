export type SongCatalogItem = {
  id: number;
  song_name: string;
  song_name_jp?: string;
  subtitle?: string;
  open_day?: string;
  type: string;
  bpm?: string;
  version?: string[];
  artists?: string[];
  max_combo?: Array<number | string>;
  shelf_status?: number | string;
  level_1?: number | string;
  level_2?: number | string;
  level_3?: number | string;
  level_4?: number | string;
  level_5?: number | string;
};

export type RatingContentItem = {
  id?: number | string;
  level?: number | string;
  combo?: number | string;
  曲名?: string;
  复合处理?: number | string;
  平均密度?: number | string;
  瞬间密度?: number | string;
  叩き分け?: number | string;
  BPM变化?: number | string;
  hs变化?: number | string;
};

export type SongTrackKey = "EASY" | "NORMAL" | "HARD" | "ONI" | "EDIT";

export type SongBranchAudioLabel = "普通" | "玄人" | "达人";

export type SongBranchAudioVariant = {
  label: SongBranchAudioLabel;
  aliases: SongBranchAudioLabel[];
};

export type SongBranchAudioVariants = Partial<Record<SongTrackKey, SongBranchAudioVariant[]>>;

export type SongDetailPayload = {
  song: SongCatalogItem | null;
  ratingEntries: RatingContentItem[];
  branchAudioVariants: SongBranchAudioVariants;
  tjaBundleUrl: string | null;
};

export type HomeContentPayload = {
  latestSongs: SongCatalogItem[];
};

export type SongCatalogPayload = {
  songs: SongCatalogItem[];
};

export type V2ConstantsDifficulty = "hard" | "oni" | "edit";

export type V2ConstantsSortKey =
  | "id"
  | "songName"
  | "difficulty"
  | "totalNotes"
  | "subConstant1"
  | "mainConstant"
  | "subConstant2"
  | "stamina"
  | "handspeed"
  | "burst"
  | "complex"
  | "rhythm";

export type V2ConstantsItem = {
  id: number;
  songName: string;
  difficulty: V2ConstantsDifficulty;
  totalNotes: number;
  subConstant1: number;
  mainConstant: number;
  subConstant2: number;
  stamina: number;
  handspeed: number;
  burst: number;
  complex: number;
  rhythm: number;
};

export type V2ConstantsPayload = {
  total: number;
  page: number;
  pageSize: number;
  generatedAt: string;
  fetchedAt: string;
  stale: boolean;
  items: V2ConstantsItem[];
};

export type TitleCatalogItem = {
  id: number;
  name: string;
  rarity: number;
  condition: string;
  songIds: number[];
};

export type TitlesPagePayload = {
  titles: TitleCatalogItem[];
  total: number;
};

export type GuideDifficultyOption = {
  value: number;
  label: string;
  max: number;
  iconImage: string;
};

export type GuideTagSummary = {
  id: number;
  label: string;
  count: number;
};

export type GuideSummaryKey =
  | "overPlus"
  | "over"
  | "strong"
  | "middle"
  | "weak"
  | "under"
  | "underMinus"
  | "total";

export type GuideSummaryTable = Record<GuideSummaryKey, number>;

export type GuidePagePayload = {
  difficulty: number;
  difficultyLabel: string;
  level: number;
  tags: GuideTagSummary[];
  summary: GuideSummaryTable;
};

export type GuideTagItem = {
  id: number;
  rowKey: string;
  title: string;
  bpm: string;
  category: string;
  tag: string;
  feature: string;
  noteCount: string;
};

export type GuideTagItemsPayload = {
  difficulty: number;
  level: number;
  tagId: number;
  tagLabel: string;
  items: GuideTagItem[];
};
