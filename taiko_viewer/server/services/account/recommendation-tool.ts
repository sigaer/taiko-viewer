import { createError } from 'h3';
import { withPersonalScoreRead } from './personal';
import { resolveRecommendDim, runPythonImage, toJpeg } from './charts';
import { getRuntimePaths } from '../../internal/account/shared';
import { getSongCatalog } from '../content';
import { getAccountDb } from '../../utils/account-db';
import { readGoalSnapshot } from '../goals/snapshot';
import { recommendationInputRevision, signRecommendation } from '../goals/recommendation';
import { goalBaseline, goalChartAvailable, goalOptions } from '../../../utils/playerGoal';
import type { RecommendationToolPayload } from '../../../types/recommendation-tool';

export const getRecommendationTool = (userId:number, options:{n?:number;dim?:string;image?:boolean}) => withPersonalScoreRead(userId, async binding => {
  const limit = Math.trunc(Math.min(50, Math.max(1, Number(options.n) || 20)));
  const resolved = resolveRecommendDim(options.dim || '');
  if (!resolved) throw createError({statusCode:400,statusMessage:'unsupported-dimension'});
  const [snapshot,catalog] = await Promise.all([readGoalSnapshot(binding.taiko_id,true),getSongCatalog()]);
  const inputs = await recommendationInputRevision(catalog);
  const {repoRoot} = getRuntimePaths();
  // Projection and export receive the very same rows, in their original order.
  const code = [
    'import sys,json,base64', 'from contextlib import redirect_stdout', 'from io import StringIO',
    'from taiko_bot.offline.viewer import compute_recommendations_for_user,generate_recommend_image',
    'from taiko_bot.offline.recommendation_intelligence import project_ordinary_recommendations',
    'p=json.loads(sys.argv[2])', 'with redirect_stdout(StringIO()):',
    '    rows=compute_recommendations_for_user(int(sys.argv[1]),best_key=p["basis"],limit=p["limit"],json_path=p["path"])',
    '    result=project_ordinary_recommendations(rows,basis=p["basis"])',
    '    if p["image"] and rows:',
    '        image=generate_recommend_image(rows,title="以下是可供参考的推荐歌曲",subtitle=p["subtitle"],user_id=int(sys.argv[1]),font_path="assets/fonts/DDFont.ttf")',
    '        result["image"]=base64.b64encode(image.getvalue() if hasattr(image,"getvalue") else image).decode("ascii")',
    'print(json.dumps(result,ensure_ascii=False))'
  ].join('\n');
  let result;
  try {
    result = JSON.parse((await runPythonImage(code,[binding.taiko_id,JSON.stringify({basis:resolved.dimKey,limit,path:`${repoRoot}/songs/rating_structured_with_ids.json`,image:!!options.image,subtitle:`维度：${resolved.dimLabel}  数量：${limit}`})])).toString());
    if (!Array.isArray(result.items)) throw new Error('Invalid projection');
  } catch { throw createError({statusCode:502,statusMessage:'recommendation-unavailable'}); }
  if (inputs !== await recommendationInputRevision(await getSongCatalog())) throw createError({statusCode:409,statusMessage:'recommendation-changed'});
  const [locks] = await getAccountDb().execute<any[]>('SELECT song_no,level FROM web_song_locks WHERE taiko_id=? AND is_locked=1',[binding.taiko_id]);
  const generatedAt = new Date().toISOString();
  const items = result.items.map((item:RecommendationToolPayload['items'][number], index:number) => {
    const song = catalog.find(s => Number(s.id) === item.songId);
    const baseline = goalBaseline(snapshot.current.songs?.find(r=>Number(r.song_no)===item.songId&&Number(r.level)===item.level),snapshot.revision,snapshot.capturedAt,snapshot.provenance?'complete':'unknown');
    const canCreateGoal = !!snapshot.provenance && baseline.recordPresent && !locks.some(r=>Number(r.song_no)===item.songId&&Number(r.level)===item.level) && goalOptions(baseline,binding.source,goalChartAvailable(song,item.level)).length>0;
    const star = Number(song?.[`level_${item.level}` as keyof typeof song]);
    return {...item,starLevel:Number.isFinite(star)&&star>0?star:null,canCreateGoal,recommendationToken:signRecommendation({userId,profileId:String(binding.id),account:binding.taiko_id,source:binding.source,songId:item.songId,difficultyType:item.level,basis:resolved.dimKey,rank:index+1,revision:snapshot.revision,inputs,generatedAt,expires:Date.now()+10*60_000})};
  });
  return {model:result.model,basis:resolved.dimKey,profileId:String(binding.id),scoreRevision:snapshot.revision,generatedAt,items,image:result.image?'data:image/jpeg;base64,'+(await toJpeg(Buffer.from(result.image,'base64'))).toString('base64'):null} as RecommendationToolPayload;
});
