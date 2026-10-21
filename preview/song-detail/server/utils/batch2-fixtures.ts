// Synthetic page fixtures only. No business server or production account is loaded.
import { binding, publicSongs, songScores } from './site-fixtures';
export const manualBinding = { ...binding, id: 2, taikoId: 'synthetic-manual', source: 'manual', displayName: '手动成绩 / 手動記録', isManual: true, canExternalSync: false };
export const progressOptions = { dani: [{version:'2025',grades:['九段','十段','玄人']},{version:'2024',grades:['八段','九段']}], constants:{pass:['10.0','10.5'],comprehensive:['11.0','11.5']},stars:[9,10],named:['上位','最上位'],pages:{pass:{'10.0':2,'10.5':1},comprehensive:{'11.0':2,'11.5':1},star:{'9':2,'10':3},named:{'上位':2,'最上位':1}} };
export function batch2Data(path:string, query:Record<string,any>, state:string) {
 const current=state==='manual'?manualBinding:binding;
 if(path==='/api/account/bindings')return {bindings:state==='unbound'?[]:[binding,manualBinding],currentBinding:state==='unbound'?null:current};
 if(path==='/api/account/progress/options')return state==='empty'?{dani:[],constants:{pass:[],comprehensive:[]},stars:[],named:[],pages:{pass:{},comprehensive:{},star:{},named:{}}}:progressOptions;
 if(path==='/api/account/songs'){
  let rows=state==='empty'||state==='unbound'?[]:publicSongs.slice(0,30).flatMap(song=>songScores(song.id,'scores'));
  rows=rows.map((row,i)=>({...row,level:i%5+1,levelLabel:['简单','普通','困难','魔王','里谱'][i%5],isCustom:i===2,shelfStatus:i===3?1:0,isLocked:i===4,title:i===0?'长曲名测试 — 幸福之歌 / ハピネスの長い曲名を最後まで確認するための記録':row.title}));
  if(query.keyword)rows=rows.filter(row=>`${row.title} ${row.titleJp} ${row.songNo}`.toLowerCase().includes(String(query.keyword).toLowerCase()));
  if(Number(query.level))rows=rows.filter(row=>row.level===Number(query.level));
  const page=Math.max(1,Number(query.page)||1),pageSize=Number(query.pageSize)||25;
  return {currentBinding:current,total:rows.length,page,pageSize,items:rows.slice((page-1)*pageSize,page*pageSize)};
 }
}
const escape=(s:unknown)=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
export function batch2Image(path:string,q:Record<string,any>){
 const b30=path.endsWith('/b30'),n=b30?Math.min(50,Math.max(1,Number(q.n)||30)):24;
 const label=b30?`Top ${n} · ${q.dim||'Rating'} · origin ${q.r==='1'?'dynamic':'default'}`:`${q.kind} · ${q.version||q.mode||''} ${q.grade||q.constant||q.star||q.name||''} · page ${q.page||1}`;
 const rows=Array.from({length:n},(_,i)=>`<g transform="translate(24 ${124+i*44})"><rect width="712" height="40" fill="${i%2?'#f5f8fa':'#fff'}"/><text x="12" y="26">${String(i+1).padStart(2,'0')}  ${escape(publicSongs[i%publicSongs.length].song_name_jp||publicSongs[i%publicSongs.length].song_name)}  ·  ${b30?'980,000 · 11.18':'FC / 980,000'}</text></g>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="${150+n*44}" viewBox="0 0 760 ${150+n*44}"><rect width="100%" height="100%" fill="#edf4f6"/><g fill="#243b46" font-family="sans-serif" font-size="15"><text x="24" y="32" font-size="23">${b30?'B30':'Progress'} — SYNTHETIC PAGE FIXTURE</text><text x="24" y="65">${escape(label)}</text><text x="24" y="94">Fixed sample · UI validation only · not calculated player results</text>${rows}</g></svg>`;
}
