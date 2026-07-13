export type AccountSongScore = {
  songNo: number;
  level: number;
  levelLabel: string;
  starLevel: string | number;
  maxCombo: string | number;
  highScore: number;
  bestScoreRank: number;
  goodCnt: number;
  okCnt: number;
  ngCnt: number;
  poundCnt: number;
  stageCnt: number;
  clearCnt: number;
  fullComboCnt: number;
  dondafulComboCnt: number;
  comboCnt: number;
  updateDatetime: string;
  highscoreDatetime: string;
};

export type AccountSongScoresPayload = {
  items: AccountSongScore[];
};
