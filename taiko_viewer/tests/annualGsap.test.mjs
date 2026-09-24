import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnnualTimeline, setAnnualTargets } from '../utils/annualGsap.ts';

test('empty optional stages create no tweens or warnings and do not move explicit timings', () => {
  const warnings = [], original = console.warn;
  console.warn = (...args) => warnings.push(args);
  const timeline = createAnnualTimeline({ paused: true });
  try {
    const state = { value: 0 };
    timeline.to([], { duration: 3 }, 0).fromTo([], { value: 0 }, { value: 1 }, .2).set([], { value: 1 }, 0);
    setAnnualTargets([], { opacity: 0 });
    assert.equal(timeline.getChildren().length, 0);
    timeline.to(state, { value: 100, duration: 1, ease: 'none' }, .5);
    timeline.time(1);
    assert.equal(state.value, 50);
    assert.equal(warnings.length, 0);
  } finally { timeline.kill(); console.warn = original; }
});
