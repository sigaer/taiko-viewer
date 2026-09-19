// Synthetic authoritative payloads: no production identity or private profile data.
// _meta.full / _meta.ts and chart records match writeUserdataWithHistory.
export const clock = '2026-09-17T15:00:00+08:00';
const old = {song_no:1,level:4,high_score:900000,good_cnt:89,ok_cnt:3,ng_cnt:8,combo_cnt:60,clear_cnt:0,full_combo_cnt:0,dondaful_combo_cnt:0,best_score_rank:6,highscore_datetime:'2026-09-16 18:00:00',update_datetime:'2026-09-16 18:00:00'};
const today = {...old,highscore_datetime:'2026-09-17 12:00:00',update_datetime:'2026-09-17 12:00:00'};
const snapshot = (full,songs,ts) => ({_meta:{full,ts,source:'acceptance-fixture'},songs});
const fact = (type,before,after) => ({type,before,after,delta:before===null?null:after-before});
const played = fact('played',null,null);
const fixture = (id,after,expected,before=old) => ({id,clock,snapshots:[snapshot(true,before?[before]:[],'2026-09-17 00:00:00'),snapshot(false,[after],'2026-09-17 12:01:00')],expected:{attendance:'played',uniqueCharts:1,facts:[expected]}});
export const fixtures = [
 {...fixture('no-play',old,[]),expected:{attendance:'not_played',uniqueCharts:0,facts:[]}},
 fixture('ordinary',{...today,highscore_datetime:old.highscore_datetime},[played]),
 fixture('pb',{...today,high_score:907130},[fact('score-pb',900000,907130)]),
 {...fixture('old-pb-restore',{...today,high_score:950000},[played]),snapshots:[snapshot(true,[{...old,high_score:990000}],'2026-09-16 18:01:00'),snapshot(false,[old],'2026-09-17 00:00:00'),snapshot(false,[{...today,high_score:950000}],'2026-09-17 12:01:00')]},
 fixture('improvement',{...today,good_cnt:93,ng_cnt:4},[fact('ng-reduced',8,4)]),
 fixture('combo',{...today,combo_cnt:80},[fact('combo-improved',60,80)]),
 fixture('clear',{...today,clear_cnt:1},[fact('clear-upgrade',-1,0)]),
 fixture('crown',{...today,clear_cnt:1,full_combo_cnt:1},[fact('fc',0,1)],{...old,clear_cnt:1}),
 fixture('df',{...today,clear_cnt:1,full_combo_cnt:1,dondaful_combo_cnt:1},[fact('df',1,2)],{...old,clear_cnt:1,full_combo_cnt:1}),
 fixture('rank',{...today,best_score_rank:7},[fact('rank-upgrade',6,7)]),
 fixture('merged',{...today,high_score:907130,good_cnt:97,ng_cnt:0,full_combo_cnt:1},[fact('fc',-1,1),fact('score-pb',900000,907130),fact('ng-reduced',8,0)]),
 {...fixture('multiple',today,[played]),snapshots:[snapshot(true,[old,{...old,song_no:2}],'2026-09-17 00:00:00'),snapshot(false,[today,{...today,song_no:2}],'2026-09-17 12:01:00')],expected:{attendance:'played',uniqueCharts:2,facts:[[played],[played]]}},
 {...fixture('duplicate',{...today,high_score:907130},[fact('score-pb',900000,907130)]),snapshots:[snapshot(true,[old],'2026-09-17 00:00:00'),snapshot(false,[{...today,high_score:907130}],'2026-09-17 12:01:00'),snapshot(false,[{...today,high_score:907130}],'2026-09-17 12:02:00')]},
 fixture('midnight',{...today,high_score:907130,highscore_datetime:'2026-09-16T16:01:00Z',update_datetime:'2026-09-16T16:01:00Z'},[fact('score-pb',900000,907130)],{...old,highscore_datetime:'2026-09-16T15:59:00Z',update_datetime:'2026-09-16T15:59:00Z'}),
 fixture('missing-before',{...today,high_score:907130,full_combo_cnt:1},[played],null),
 {...fixture('truncated',{...today,full_combo_cnt:1},[played],null),snapshots:[snapshot(false,[{...today,full_combo_cnt:1}],'2026-09-17 12:01:00')]},
 {...fixture('crown-midnight',{...today,full_combo_cnt:1},[played]),snapshots:[snapshot(true,[old],'2026-09-16 18:01:00'),snapshot(false,[{...today,full_combo_cnt:1}],'2026-09-17 12:01:00')]}
];
export const catalog = [{id:1,song_name:'Replay Song Alpha',level_4:9},{id:2,song_name:'Replay Song Beta',level_4:10}];
