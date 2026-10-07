// Synthetic presentation DTOs only. No recommendation or attribution model.
export const fixtureDay = '2026-10-07';
export const moveDay = (day, delta) => new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86400000).toISOString().slice(0, 10);
export const dimensions = (value = 10.28) => ({ big_song: value + .2, stamina: value + .1, speed: value -.1, accuracy_power: value -.4, rhythm: value, complex: value + .05 });
const fact = (type, before, after) => ({ type, before, after, delta: after - before });
const event = (songId, title, facts) => ({ songId, title, level: 4, occurredAt: `${fixtureDay} 12:00:00`, evidence: 'history', evidenceRevision: 'observed-new', importance: 60, facts });
export const presentationGoal = (status = 'completed') => ({ id: 'goal-closure', profileId: '1', songId: 101, difficultyType: 4, title: 'HIMAWARI HAPPY', starLevel: 9, goalType: 'ng-reduced', status, source: 'today-plan', baselineVersion: 1, baseline: { highScore: 980000, ngCnt: 1, clearCnt: 1, fullComboCnt: 0, dondafulComboCnt: 0 }, completionEvidence: status === 'completed' ? { observationRevision: 'observed-new', result: { goalType: 'ng-reduced', before: 1, after: 0, delta: -1, facts: { total: 700 } } } : undefined });
const recentFact = (event, change) => ({ ...change, id: `${event.songId}:${change.type}`, factKey: `${event.songId}:${change.type}`, ownerId: '990092', bindingId: '1', songId: event.songId, difficultyType: 4, title: event.title, evidence: { source: 'score-history', sourceRevision: event.evidenceRevision, evidenceVersion: 1 }, temporal: { attributedDay: fixtureDay, observedAt: `${fixtureDay}T06:00:00Z`, precision: 'day' } });
export function homePresentationFixture(scenario) {
  const chosen = event(101, 'HIMAWARI HAPPY', [fact('ng-reduced', 1, 0), fact('score-pb', 980000, 995440)]);
  const unrelated = [event(102, 'Turquoise Tachometer', [fact('score-pb', 950000, 977000), fact('combo-improved', 650, 717)]), event(103, 'VIVIVID', [fact('score-pb', 950000, 959850)])];
  const completed = scenario.startsWith('goal-');
  const active = scenario === 'active-goal';
  const quiet = scenario === 'quiet-daily';
  const recentOnly = scenario === 'recent-only';
  const dailyEvents = quiet || recentOnly ? [] : scenario === 'goal-unrelated' ? unrelated : [chosen, ...unrelated];
  const recentEvents = (scenario.startsWith('goal-recent') || ['recent-daily', 'recent-only', 'active-goal'].includes(scenario)) ? [chosen] : [];
  const recentFacts = recentEvents.flatMap(item => item.facts.map(change => recentFact(item, change)));
  if (scenario === 'goal-recent-different-baseline') recentFacts.find(fact => fact.type === 'score-pb').before = 970000;
  if (scenario.startsWith('goal-recent')) recentFacts.push({ ...recentFact(chosen, fact('goal-completed', 1, 0)), goalId: 'goal-closure', goalType: 'ng-reduced', evidence: { source: 'goal', sourceRevision: 'observed-new', evidenceVersion: 1 } });
  return {
    overview: { profileId: '1', scoreRevision: 'observed-new', activeGoal: active ? presentationGoal('active') : null, recentCompletedGoal: completed ? presentationGoal() : null, playerState: { overallRating: 10.28, skills: Object.entries(dimensions()).map(([key, value]) => ({ key, value })), priorityDimension: 'accuracy_power', tiedDimensions: ['accuracy_power'], dataSufficiency: 'ready', basis: 'lowest-valid-dimension', sampleCount: 60 }, todayPlan: { targetDimension: 'accuracy_power', usedFallback: false, items: [101, 102, 103].map(songId => ({ songId, title: `Next Song ${songId}`, difficultyType: 4, starLevel: 9, targetDimension: 'accuracy_power', currentBestScore: 900000, isUnplayed: false, reason: 'target-dimension', goalOptions: ['score-pb', 'ng-reduced'] })) }, dailyProgress: { calendarDay: fixtureDay, dataMode: 'FULL_HISTORY', attendance: quiet || recentOnly ? 'not_played' : 'played', uniqueCharts: quiet || recentOnly ? 0 : 28, events: dailyEvents }, dataStatus: { mode: 'FULL_HISTORY', timezone: 'Asia/Shanghai' } },
    recent: { profileId: '1', state: recentFacts.length ? 'new' : 'caught-up', observedAt: `${fixtureDay}T06:00:00Z`, facts: recentFacts, totalFacts: recentFacts.length, boundary: { currentToken: 'closure-boundary', acknowledgedToken: null, acknowledgeRequired: true, recovered: false } }
  };
}
export function passportPresentationFixture(scenario, requestedDays = 90) {
  const span = { '4-day': 4, '42-day': 42, '120-day': 120, '250-day': 250, '365-day': 400, 'model-break': 42, 'one-point': 1, limited: 4, stable: 42, 'focus-change': 42 }[scenario] || 4;
  const points = Array.from({ length: Math.min(span, requestedDays) }, (_, i) => {
    const day = moveDay(fixtureDay, -(Math.min(span, requestedDays) - 1 - i));
    const value = scenario === 'stable' ? 10.28 : 10 + i / 1000;
    return { id: `p${i}`, day, capturedAt: `${day}T04:00:00.000Z`, rating: value, dimensions: dimensions(value), focus: scenario === 'focus-change' && i > 20 ? 'rhythm' : 'accuracy_power', availabilityState: scenario === 'limited' ? 'limited' : 'ready', modelRevision: 'a'.repeat(64), algorithmVersion: 'growth-v1', measurementVersion: 1 };
  });
  const segment = (id, items) => ({ id, from: items[0].day, to: items.at(-1).day, points: items });
  const segments = scenario === 'model-break' && points.length > 1 ? [segment('old', points.slice(0, -1)), segment('new', points.slice(-1))] : [segment('current', points)];
  const last = points.at(-1), start = segments.at(-1).points[0];
  return {
    profileId: '1', coverage: { measurementFrom: `${moveDay(fixtureDay, -(span - 1))}T04:00:00Z`, measurementTo: `${fixtureDay}T04:00:00Z`, measurementDays: span, recentFactsFrom: moveDay(fixtureDay, -89), recentFactsTo: fixtureDay, recentFactsState: 'complete' },
    current: { rating: last.rating, dimensions: last.dimensions, focus: last.focus, readiness: scenario === 'limited' ? 'limited' : 'ready' },
    range: { requestedDays, actualFrom: points[0].day, actualTo: last.day, timezone: 'Asia/Shanghai', selectedDimension: 'rating' }, segments,
    currentSegmentChange: { compatible: segments.at(-1).points.length > 1 && scenario !== 'limited', reason: scenario === 'limited' ? 'limited' : segments.at(-1).points.length > 1 ? 'compatible' : 'insufficient', start, end: last, ratingDelta: last.rating - start.rating, dimensionDeltas: null, primaryDimensionChange: null, focusFrom: start.focus, focusTo: last.focus },
    focusTimeline: scenario === 'focus-change' ? [{ id: 'focus-1', focus: 'accuracy_power', startedAt: points[0].day, endedAt: points[20].day, current: false }, { id: 'focus-2', focus: 'rhythm', startedAt: points[21].day, endedAt: last.day, current: true }] : [{ id: 'focus-1', focus: last.focus, startedAt: points[0].day, endedAt: last.day, current: true }],
    milestones: [{ id: 'milestone', primaryType: 'score-pb', title: 'Recent Song', songId: 101, difficultyType: 4, day: fixtureDay, before: 900000, after: 920000, delta: 20000, goalCompleted: false }], activeGoal: null, recentCompletedGoal: null, currentNextAction: null
  };
}
