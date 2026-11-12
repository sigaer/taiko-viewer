import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSongIdentityMap, normalizeScoreSongIds } from '../server/domain/catalog-identity.ts';
import { createPublicationScoreReader } from '../server/infrastructure/taiko-publication/reader.ts';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('historical scores resolve to the new song, preserving raw input and actual best attempts', () => {
  const ids = buildSongIdentityMap([{id:1530,legacy_ids:[100138]}]);
  const input = {songs:[{song_no:100138,level:4,high_score:90,play_cnt:8},
    {song_no:1530,level:4,high_score:100,play_cnt:2},{song_no:100138,level:5,high_score:70}],
    songs_removed:[[100138,3],{song_no:100138,level:2},'100138:1']};
  const raw=JSON.stringify(input);
  const output=normalizeScoreSongIds(input,ids);
  assert.equal(JSON.stringify(input),raw);
  assert.deepEqual(output.songs,[{song_no:1530,level:4,high_score:100,play_cnt:2},{song_no:1530,level:5,high_score:70}]);
  assert.deepEqual(output.songs_removed,[[1530,3],{song_no:1530,level:2},'1530:1']);
  assert.equal(normalizeScoreSongIds(output,ids),output);
});

test('unaffected payloads retain ownership, identity collisions fail', () => {
  const input={songs:[{song_no:1,level:4}]};
  assert.equal(normalizeScoreSongIds(input,buildSongIdentityMap([{id:1530,legacy_ids:[100138]}])),input);
  assert.throws(()=>buildSongIdentityMap([{id:1,legacy_ids:[2]},{id:2}]));
  assert.throws(()=>buildSongIdentityMap([{id:1,legacy_ids:[3]},{id:2,legacy_ids:[3]}]));
});

test('score reader resolves IDs while raw bytes and publication revision remain exact', async () => {
  const root = await mkdtemp('/var/tmp/taiko-id-reader-');
  try {
    await mkdir(root+'/songs'); await mkdir(root+'/userdata');
    await writeFile(root+'/songs/song_data.json',JSON.stringify([{id:1530,legacy_ids:[100138]}]));
    const raw='{"songs":[{"song_no":100138,"level":4,"high_score":123}]}';
    await writeFile(root+'/userdata/syntheticdata.json',raw);
    const reader=createPublicationScoreReader({root:root+'/userdata',identity:'synthetic',now:()=>'',assertActive:()=>{},view:()=>null,staged:new Map()});
    const result=await reader.readCurrent('synthetic');
    assert.equal(result.current.songs![0]!.song_no,1530);
    assert.equal(result.raw,raw);
    assert.equal(result.revision,createHash('sha256').update(raw).digest('hex'));
    assert.equal(await readFile(root+'/userdata/syntheticdata.json','utf8'),raw);
  } finally { await rm(root,{recursive:true,force:true}); }
});
