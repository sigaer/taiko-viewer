import type { TitleCatalogItem } from '../../types/content.ts';

export const TITLE_CATEGORIES = ['event', 'ai', 'play', 'clear', 'fullCombo', 'allPerfect', 'combination', 'other'] as const;
export type TitleCategory = typeof TITLE_CATEGORIES[number];
export type TitleFilter = TitleCategory | 'all';

const normalize = (text: string) => text.normalize('NFKC').toLowerCase();
const PLATE_CATEGORIES: Record<number, TitleCategory> = {
  41: 'clear', 42: 'fullCombo', 43: 'allPerfect',
  59: 'clear', 60: 'fullCombo', 61: 'allPerfect'
};

/** One category per title, based on acquisition conditions rather than the number of linked IDs. */
export function titleCategory(title: TitleCatalogItem): TitleCategory {
  const condition = normalize(title.condition || '');
  const names = [...condition.matchAll(/《([^》]+)》/g)].map((match) => match[1]);
  // Words inside song names cannot describe the acquisition method (e.g. AI TO JOUZAI NO MORI).
  const rule = condition.replace(/《[^》]+》/g, '');
  if (/活动|活動|イベント|大会|比赛|比賽|赛事|賽事|争夺战|決定戦|联动|聯動|コラボ|兑换|兌換|交換|愚人节|エイプリルフール/.test(rule)
      || /\b(?:twcs|twso)\b|\bwec\s*20\d{2}\b/i.test(normalize(title.name))) return 'event';
  if (/ai\s*(?:对战|對戰|対戦|バトル)/.test(rule)) return 'ai';

  // A choice between songs is not a requirement to complete a combination.
  const alternatives = /》\s*(?:或(?:者)?|または|もしくは|or)\s*《/.test(condition);
  const namedCombination = new Set(names).size > 1 && !alternatives;
  const restrictedCredit = !names.length && /1\s*(?:pc|プレイ|次游玩)/.test(rule)
    && /仅(?:游玩|选择)|僅(?:遊玩|選擇)|のみ/.test(rule);
  if (namedCombination || restrictedCredit) return 'combination';

  const plate = PLATE_CATEGORIES[title.rarity];
  if (plate) return plate;
  if (!names.length && !title.songIds.length) return 'other';
  if (/全良|ドンダフルコンボ|all\s*perfect/.test(rule)) return 'allPerfect';
  if (/全连|全連|フルコンボ|full\s*combo/.test(rule)) return 'fullCombo';
  if (/通关|通關|过关|過關|クリア|clear/.test(rule)) return 'clear';
  if (/游玩|遊玩|プレイ|演奏|play/.test(rule)) return 'play';
  return 'other';
}

export const titleMatchesKeyword = (title: TitleCatalogItem, keyword: string): boolean => {
  const q = normalize(keyword.trim());
  return !q || normalize(title.name).includes(q) || normalize(title.condition || '').includes(q) || String(title.rarity) === q;
};
