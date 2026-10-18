/** Pure read projection; unknown region/mode never become an inferred default. */
export function difficultyToTjaCourse(difficulty){
 if(!Number.isInteger(difficulty)||difficulty<1||difficulty>5)throw new Error('Invalid difficulty');return difficulty-1;
}
export function projectCatalog(rows,revision,aliasRows=[]){
 if(!Array.isArray(rows)||rows.length>10000)throw new Error('Invalid catalog');
 if(!Array.isArray(aliasRows)||aliasRows.length>20000)throw new Error('Invalid alias catalog');
 const songs=[],charts=[],ids=new Set(),aliasesById=new Map();
 for(const row of aliasRows){
  if(!row||typeof row!=='object'||!/^([1-9][0-9]*)$/.test(String(row.id))||!Number.isSafeInteger(Number(row.id)))throw new Error('Invalid alias song ID');
  const id=String(row.id);if(aliasesById.has(id))throw new Error('Ambiguous alias catalog');
  aliasesById.set(id,row);
 }
 for(const row of rows){
  if(!row||typeof row!=='object'||!['string','number'].includes(typeof row.id)||!/^([1-9][0-9]*)$/.test(String(row.id))||!Number.isSafeInteger(Number(row.id))||Number(row.id)<=0)throw new Error('Invalid song ID');
  const songId=String(row.id);if(ids.has(songId))throw new Error('Ambiguous catalog');ids.add(songId);
  const region=['CN','JP'].includes(row.region)?row.region:'UNKNOWN';
  const status=row.shelf_status===0||row.shelf_status==='0'?'active':row.shelf_status===1||row.shelf_status==='1'?'removed':'unknown';
  const availability={region,status},alias=aliasesById.get(songId);
  const songName=typeof row.song_name==='string'?row.song_name.slice(0,512):null;
  const songNameJp=typeof row.song_name_jp==='string'?row.song_name_jp.slice(0,512):typeof alias?.song_name_jp==='string'?alias.song_name_jp.slice(0,512):null;
  const songAliases=Array.isArray(alias?.aliases)?alias.aliases.filter(value=>typeof value==='string').slice(0,100).map(value=>value.slice(0,256)):[];
  songs.push({songId,song_name:songName,song_name_jp:songNameJp,aliases:songAliases,catalogRevision:revision,availability});
  const type=['single','double'].includes(row.chart_type)?row.chart_type:'unknown';
  for(let difficulty=1;difficulty<=5;difficulty++){
   const raw=row['level_'+difficulty];if(raw===null||raw===undefined||raw===''||raw==='-')continue;
   const level=Number(raw);if(!Number.isFinite(level)||level<=0)continue;
   charts.push({songId,chartId:`${songId}:${difficulty}:${type}`,difficulty,level,type,variant:null,catalogRevision:revision,availability,tjaCourse:difficultyToTjaCourse(difficulty)});
  }
 }
 songs.sort((a,b)=>Number(a.songId)-Number(b.songId));charts.sort((a,b)=>Number(a.songId)-Number(b.songId)||a.difficulty-b.difficulty);return {songs,charts};
}

/** Catalog-only DTO: attach existing charts without extending canonical Song. */
export function catalogSongsWithCharts({songs,charts}){
 const bySong=new Map(songs.map(song=>[song.songId,[]]));
 for(const chart of charts){
  const bucket=bySong.get(chart.songId);
  if(!bucket)throw new Error('Chart without catalog song');
  bucket.push(chart);
 }
 return songs.map(song=>({...song,charts:bySong.get(song.songId)}));
}
