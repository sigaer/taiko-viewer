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

export type SongDetailPayload = {
  song: SongCatalogItem | null;
  ratingEntries: RatingContentItem[];
  branchAudioTracks: SongTrackKey[];
};

export type HomeContentPayload = {
  latestSongs: SongCatalogItem[];
};

export type SongCatalogPayload = {
  songs: SongCatalogItem[];
};

export type TableCell = {
  tag: "th" | "td";
  attrs: Record<string, string>;
  html: string;
};

export type TableRow = {
  attrs: Record<string, string>;
  cells: TableCell[];
};

export type TitlesPagePayload = {
  table: {
    attrs: Record<string, string> & { style?: string };
  };
  rows: TableRow[];
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

export type GuideSummaryTable = Record<string, number>;

export type GuidePagePayload = {
  difficulty: number;
  difficultyLabel: string;
  level: number;
  tags: GuideTagSummary[];
  summary: GuideSummaryTable;
};

export type GuideTagItem = {
  id: number;
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
