import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRecommendDim } from '../server/services/account/recommendation-dimensions.ts';
const bases=['rating','big_song','stamina','speed','accuracy_power','rhythm','complex'];
test('Viewer resolves every public basis and keeps Core aliases out of projection/token basis',()=>{
  for(const basis of bases) assert.equal(resolveRecommendDim(basis).dimKey,basis);
  for(const alias of ['大歌力','大歌','daigouryoku','BIG_SONG']) assert.equal(resolveRecommendDim(alias).dimKey,'big_song');
  assert.equal(resolveRecommendDim('').dimKey,'rating');
  assert.equal(resolveRecommendDim('unknown'),null);
});
