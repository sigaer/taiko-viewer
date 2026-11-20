import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TitleCatalogItem } from '../types/content.ts';
import { TITLE_CATEGORIES, titleCategory, titleMatchesKeyword } from '../utils/rework/titles.ts';

const title = (condition: string, extra: Partial<TitleCatalogItem> = {}): TitleCatalogItem =>
  ({ id: 100, name: '称号', rarity: 2, condition, songIds: [], ...extra });

test('event conditions and tournament names take priority over song and AI requirements', () => {
  for (const condition of ['在活动中全连《Song》', '在限时活动中完成AI对战', '在愚人节期间游玩《Song》', 'イベントでクリア']) {
    assert.equal(titleCategory(title(condition)), 'event');
  }
  for (const name of ["TWCS'24参加だドン！", "TWSO'25 参加だドン！", 'WEC2026 以光之明']) {
    assert.equal(titleCategory(title('（なし）', { name })), 'event');
  }
});

test('AI mode requires an acquisition condition, not AI in a song name', () => {
  assert.equal(titleCategory(title('在AI对战演奏模式中取得1次胜利！')), 'ai');
  assert.equal(titleCategory(title('AIバトル演奏で勝利')), 'ai');
  assert.equal(titleCategory(title('在魔王难度全连《AI TO JOUZAI NO MORI》')), 'fullCombo');
  assert.equal(titleCategory(title('通关《AI对战活动全良》')), 'clear');
});

test('song achievements distinguish play, clear, full combo and all perfect', () => {
  for (const [condition, category] of [
    ['游玩《Song》', 'play'], ['在任意难度通关《Song》', 'clear'],
    ['全连《Song》', 'fullCombo'], ['全良《Song》', 'allPerfect'],
    ['Songをクリア', 'clear'], ['Songをフルコンボ', 'fullCombo'],
    ['Songをドンダフルコンボ', 'allPerfect']
  ]) assert.equal(titleCategory(title(condition, { songIds: [7] })), category);
});

test('known song plate variants classify even when conditions are unavailable', () => {
  for (const rarity of [41, 59]) assert.equal(titleCategory(title('', { rarity })), 'clear');
  for (const rarity of [42, 60]) assert.equal(titleCategory(title('', { rarity })), 'fullCombo');
  for (const rarity of [43, 61]) assert.equal(titleCategory(title('', { rarity })), 'allPerfect');
  assert.equal(titleCategory(title('', { rarity: 2 })), 'other');
});

test('combinations include multi-song and restricted one-credit challenges', () => {
  for (const condition of [
    '在魔王或魔王（里）难度下，全连《A》《B》两首乐曲',
    '在1PC内，全连《A》《B》《C》',
    '1PC内仅游玩物量为765的谱面，并全部全连',
    '1PC内，仅游玩本家为初音未来的曲目并全部通关',
    '在1p侧的1PC内，仅选择A、B、C的裏譜面，并全部全连'
  ]) assert.equal(titleCategory(title(condition)), 'combination');
});

test('alternative songs, duplicated IDs and one named song remain song achievements', () => {
  for (const condition of ['在《A》或《B》或《C》中达成全连', '全连《A》《A》', '在1PC内仅游玩《A》并全连']) {
    assert.equal(titleCategory(title(condition, { songIds: [1, 2] })), 'fullCombo');
  }
  assert.equal(titleCategory(title('全连《Hater》', { songIds: [1146, 1264] })), 'fullCombo');
});

test('generic options, series and unknown conditions stay available under other', () => {
  for (const condition of ['', '（なし）', '？？？', '在1PC内，所有歌曲均取得全良',
    '在1PC内，所有歌曲均在使用选项【颠倒】情况下通关', '通关VOCALOID演唱的乐曲']) {
    assert.equal(titleCategory(title(condition)), 'other');
  }
  assert.equal(new Set(TITLE_CATEGORIES).size, 8);
});

test('keyword matching preserves width-insensitive name, condition and plate searches', () => {
  const row = title('AI对战获胜', { name: 'ＡＬｉＶＥ', rarity: 42 });
  assert.equal(titleMatchesKeyword(row, ' alive '), true);
  assert.equal(titleMatchesKeyword(row, 'ai对战'), true);
  assert.equal(titleMatchesKeyword(row, '４２'), true);
  assert.equal(titleMatchesKeyword(row, 'missing'), false);
  assert.equal(titleMatchesKeyword(row, ''), true);
});
