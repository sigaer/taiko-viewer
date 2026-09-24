import { annualCoverTexturePath } from '../utils/annualCoverTexture.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { coverMotion, coverPitch, coverRotation, COVER_CYCLE_MS } from '../utils/annualCoverMotion.ts';

test('every cover resets only when invisible, for both directions and every slot', () => {
  for (const upper of [true, false]) for (let slot = 0; slot < 6; slot++) {
    const wrap = COVER_CYCLE_MS * (1 - slot / 6);
    for (const offset of [-.1, 0, .1]) assert.ok(coverMotion(wrap + offset, slot, upper).opacity < .000001);
    const exit = wrap + COVER_CYCLE_MS / 2;
    for (const offset of [-.1, 0, .1]) assert.ok(coverMotion(exit + offset, slot, upper).opacity < .000001);
  }
});

test('cover opacity is continuous across two cycles at 60Hz', () => {
  for (const upper of [true, false]) {
    let last = coverMotion(0, 0, upper);
    for (let time = 16.667; time <= 72000; time += 16.667) {
      const next = coverMotion(time, 0, upper);
      assert.ok(Math.abs(next.opacity - last.opacity) < .012);
      if (Math.abs(next.travel - last.travel) > .1) assert.ok(next.opacity < .000001 && last.opacity < .000001);
      last = next;
    }
  }
});

test('the local plane rotation settles at rectangle and diamond endpoints', () => {
  assert.equal(coverRotation(0), 0);
  assert.equal(coverRotation(1600), Math.PI / 4);
  assert.equal(coverRotation(-100), 0);
  assert.equal(coverRotation(5000), Math.PI / 4);
});

test('cover fronts stay facing the camera throughout their vertical path', () => {
  for (const upper of [true, false]) for (const height of [667, 844, 1080]) {
    for (let travel=0; travel<=1; travel+=.01) {
      const z=-380*(1-travel), y=(upper?1:-1)*height*(.23+travel*.4)*(900-z)/900;
      const pitch = coverPitch(upper, height*(.23+travel*.4), travel);
      const dot = Math.sin(pitch)*y + Math.cos(pitch)*(900-z);
      assert.ok(dot>0,'a visible plane must never cross edge-on or expose its reverse side');
    }
  }
});

test('WebGL cover URLs retain the shared fallback and never proxy arbitrary external URLs', () => {
  assert.equal(annualCoverTexturePath({songNo:1405,coverUrl:'https://static.sakura-bot.cn/cover/1384.png'}),'/api/content/covers/1384/texture');
  assert.equal(annualCoverTexturePath({songNo:1,coverUrl:'//other.test/image'}),'/api/content/covers/1/texture');
  assert.equal(annualCoverTexturePath({songNo:-1}), '');
});
