import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import zh from '../locales/zh.json' with { type: 'json' };
import ja from '../locales/ja.json' with { type: 'json' };
import { composeRecommendationCopy, composeGoalCopy, composeRecentGrowthCopy, composeDailyNarrative, composeDailyFactCopy, composeWeeklyNarrative, composePassportNarrative, growthCopyIndex, GROWTH_COPY_POOL_SIZES, type GrowthVoiceContext, type GrowthVoiceLine } from '../utils/growthVoice.ts';
import type { GrowthDailyProgress, RecentGrowthResponse, WeeklyGrowthTheme } from '../types/player-growth.ts';

const context: GrowthVoiceContext = { profileId: '42:7', businessDate: '2026-10-07', focus: 'accuracy_power', readiness: 'ready', goalState: 'none', activity: 'unknown' };
const text = (messages: typeof zh | typeof ja, line: GrowthVoiceLine) => {
  const value = line.key.split('.').reduce((node: any, part) => node?.[part], messages);
  assert.equal(typeof value, 'string', line.key);
  return (value as string).replace(/\{(\w+)\}/g, (_, key) => String(line.params?.[key] ?? `{${key}}`));
};
const recent = (facts: any[] = [], overrides = {}): RecentGrowthResponse => ({ profileId: '7', state: 'new', facts, totalFacts: facts.length, observedAt: null, boundary: { acknowledgedToken: 'old', currentToken: 'new', recovered: false, acknowledgeRequired: true }, ...overrides });
const daily = (attendance: GrowthDailyProgress['attendance'], facts: any[] = []): GrowthDailyProgress => ({ calendarDay: '2026-10-07', attendance, dataMode: 'FULL_HISTORY', uniqueCharts: attendance === 'played' ? 1 : 0, events: facts.length ? [{ songId: 1, level: 4, title: 'Song', facts, evidence: 'history', occurredAt: '2026-10-07', importance: 1 }] : [] });
const fact = { type: 'score-pb' as const, before: 950000, after: 977000, delta: 27000 };

for (const pool of Object.keys(GROWTH_COPY_POOL_SIZES) as (keyof typeof GROWTH_COPY_POOL_SIZES)[]) test(`reviewed zh/ja palette ${pool} has every slot and matching parameters`, () => {
  const count = GROWTH_COPY_POOL_SIZES[pool];
  assert.ok(count >= 4);
  for (let i = 0; i < count; i++) {
    const line = { key: `home.growth.voice.${pool}.${i}` };
    const a = text(zh, line), b = text(ja, line);
    assert.deepEqual(a.match(/\{\w+\}/g) || [], b.match(/\{\w+\}/g) || []);
    assert.ok(a.length < 65 && b.length < 90, 'mobile sentence bound');
  }
  assert.equal(Object.keys(zh.home.growth.voice[pool]).length, count);
  assert.equal(Object.keys(ja.home.growth.voice[pool]).length, count);
});
for (const focus of ['big_song', 'stamina', 'speed', 'accuracy_power', 'rhythm', 'complex', 'balanced'] as const) test(`${focus} recommendation stays in its reviewed pool`, () => {
  const copy = composeRecommendationCopy({ ...context, focus });
  assert.match(copy.observation.key, new RegExp(`voice\\.${focus}\\.`));
  for (const messages of [zh, ja]) assert.ok(text(messages, copy.observation));
});
test('deterministic fixed context golden and state-aware overrides', () => {
  const copy = composeRecommendationCopy(context);
  assert.deepEqual(copy, { observation: { key: 'home.growth.voice.accuracy_power.3' }, invitation: { key: 'home.growth.voice.invitation.4' } });
  assert.equal(text(zh, copy.observation), '精度这边，可以慢慢磨一磨。');
  assert.equal(text(ja, copy.observation), '精度は、少しずつ詰めていくのもよさそう。');
  assert.equal(text(zh, copy.invitation), '想打几首的话，可以从这里开始');
  assert.equal(text(ja, copy.invitation), '何曲か叩きたいなら、ここからでも');
  for (let i = 0; i < 50; i++) assert.deepEqual(composeRecommendationCopy({ ...context }), copy);
  assert.match(composeRecommendationCopy({ ...context, readiness: 'limited' }).observation.key, /voice.limited/);
  assert.match(composeRecommendationCopy({ ...context, activity: 'quiet' }).observation.key, /voice.quiet/);
  assert.match(composeRecommendationCopy({ ...context, goalState: 'active' }).invitation.key, /voice.active/);
  assert.match(composeRecommendationCopy({ ...context, goalState: 'completed' }).invitation.key, /voice.completed/);
  assert.match(composeRecommendationCopy({ ...context, readiness: 'insufficient', activity: 'quiet' }).observation.key, /voice.limited/);
  const variants = new Set(Array.from({ length: 28 }, (_, i) => growthCopyIndex({ ...context, businessDate: `2026-10-${String(i + 1).padStart(2, '0')}` }, 'hero', 4)));
  assert.equal(variants.size, 4);
});
const golden: [GrowthVoiceLine, string, string][] = [
  [composeGoalCopy('active'), '这次想练', '今回練習したい曲'],
  [composeGoalCopy('completed'), '这次练成了', '今回できたこと'],
  [composeGoalCopy('inconclusive'), '暂时还确认不了这次进展。更新成绩后可以再试一次。', '今回の進み具合は、まだ確認できません。成績を更新したあと、もう一度お試しください。'],
  [composeRecentGrowthCopy(recent([fact])), '最近一次同步里，留下了这些变化。', '最近の同期で、こんな変化が見つかりました。'],
  [composeRecentGrowthCopy(recent()), '这次同步还没有新的变化。', '今回の同期では、新しい変化はありません。'],
  [composeRecentGrowthCopy(recent([], { boundary: { recovered: false, acknowledgedToken: null } })), '这里会记下之后同步到的新变化。', 'これから同期で見つかった変化を、ここに残していきます。'],
  [composeRecentGrowthCopy(recent([], { boundary: { recovered: true, acknowledgedToken: null } })), '上次看到哪儿暂时还确认不了，这里先记下最近同步的变化。', '前回どこまで見たか確認できないため、最近同期した変化をまとめています。'],
  [composeDailyNarrative(daily('played', [fact])), '今天留下了新的变化。', '今日は新しい変化がありました。'],
  [composeDailyNarrative(daily('played')), '今天有新的游玩记录，还没有特别明显的变化。', '今日は新しいプレイ記録があります。目立った変化はまだありません。'],
  [composeDailyNarrative(daily('not_played')), '今天还没有新的游玩记录。', '今日はまだ新しいプレイ記録がありません。'],
  [composePassportNarrative('new'), '这里会慢慢留下你的成绩与能力记录。', 'スコアや力の記録が、ここに少しずつ残っていきます。'],
  [composePassportNarrative('stable', { dimension: 'Rating', value: '10.28' }), '最近几次记录里，Rating基本保持在 10.28。', '最近の記録では、Ratingは10.28前後で落ち着いています。'],
  [composePassportNarrative('up', { dimension: 'Rating', from: '10.20', to: '10.28' }), '这段时间，Rating从 10.20 到了 10.28。', 'この間、Ratingは10.20から10.28に。'],
  [composePassportNarrative('limited'), '记录还不多，再多几次同步后趋势会更清楚。', 'まだ記録が少ないので、あと何回か同期すると変化が見えてきます。'],
  [composePassportNarrative('accumulating'), '记录还在积累，再多几次同步后趋势会更清楚。', '記録はまだ増えている途中。あと何回か同期すると、変化が見えてきます。'],
  [composePassportNarrative('updated'), '记录方式更新过', '記録方法が変わりました']
];
for (const [line, chinese, japanese] of golden) test(`golden ${line.key}`, () => {
  assert.equal(text(zh, line), chinese); assert.equal(text(ja, line), japanese);
});
const weeklyGolden = {
  'score-breakthrough': ['这一周留下了更高的最好成绩。', 'この一週間は、ベストが伸びました。'],
  'stability': ['这一周打得更稳了', 'この一週間でいちばん目立ったのは、より安定して叩けたこと。'],
  'new-crown': ['这一周留下了新的冠。', 'この一週間は、新しい王冠が増えました。'],
  'goal-follow-through': ['这一周，自己选下的练习有了结果。', 'この一週間は、自分で選んだ練習に結果が出ました。'],
  'quiet': ['这周还没有特别集中的变化。', '今週は、目立ってまとまった変化はまだありません。'],
  'limited-coverage': ['这周暂时还看不全，先看看已经记下的变化。', '今週は確認できない記録もあります。見えている変化から振り返れます。']
};
for (const [type, expected] of Object.entries(weeklyGolden)) test(`weekly reviewed text ${type}`, () => {
  const line = composeWeeklyNarrative({ type, confidence: 'high' } as WeeklyGrowthTheme);
  assert.equal(text(zh, line), expected[0]); assert.equal(text(ja, line), expected[1]);
});
for (const type of ['score-breakthrough', 'stability', 'new-crown', 'goal-follow-through', 'quiet', 'limited-coverage'] as const) test(`weekly ${type} confidence-aware reviewed golden`, () => {
  for (const confidence of ['low', 'medium', 'high'] as const) {
    const line = composeWeeklyNarrative({ type, confidence } as WeeklyGrowthTheme);
    assert.equal(line.key, `weekly.${confidence !== 'high' && !['quiet', 'limited-coverage'].includes(type) ? 'observedTheme' : 'theme'}.${type}`);
    assert.ok(text(zh, line)); assert.ok(text(ja, line));
  }
});
test('missing delta and deduplicated facts never invent growth or quiet', () => {
  const line = composeDailyFactCopy({ ...fact, before: null, delta: null }, context, '977,000', '0');
  assert.equal(text(zh, line), '最好成绩到了 977,000');
  assert.equal(composeDailyNarrative(daily('played'), daily('played', [fact])).key, 'home.growth.dailyElsewhere');
  assert.equal(composeDailyNarrative(daily('unknown')).key, 'home.growth.progressUnavailable');
});
test('primary locale copy contains no technical, commanding, fake encouragement or Session phrases', () => {
  const banned = /当前计算口径|根据数据分析|系统建议|当前优先提升项|下一步先练|任务完成|成长指数|超过\s*\w+%\s*玩家|modelRevision|algorithmVersion|measurement segment|\bschema\b|\brevision\b|太棒了|继续加油|冲冲冲|突破自己|继续保持|我帮你挑了|这一轮|这次游玩|刚刚打了|システム推奨|タスク完了|頑張って|測定モデル|測定バージョン/;
  for (const messages of [zh, ja]) {
    for (const section of [messages.home.growth, messages.home.goal, messages.weekly, messages.passport]) assert.doesNotMatch(JSON.stringify(section), banned);
  }
});
test('selection has no IO/randomness/persistence and stays within small compute budget', () => {
  const source = readFileSync(new URL('../utils/growthVoice.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Math\.random|Date\.now|\$fetch|fetch\(|localStorage|node:fs|node:child_process|mysql|\.query\(/);
  const started = performance.now();
  for (let i = 0; i < 100000; i++) composeRecommendationCopy(context);
  assert.ok(performance.now() - started < 2000, 'pure copy selection exceeded two seconds for 100k selections');
});
