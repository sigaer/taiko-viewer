"""Synthetic image root, installed modules only; no private input or frozen source."""
import json
import os
import shutil
import sys
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1]).resolve()
assert root.parent == Path(os.environ['QA_RUN_TMPDIR']).resolve() and root.name.startswith('viewer-installed-images-')
fixture=json.loads(Path(sys.argv[2]).read_text())
for directory in ['songs','userdata','assets/templates','assets/fonts','assets/icons/diff','assets/name_plate','assets/dress/common']:
    (root/directory).mkdir(parents=True,exist_ok=True)
shutil.copyfile('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',root/'assets/fonts/DDFont.ttf')
for name,size in [('b30_template',(1920,3000)),('b30_single',(1200,700)),('progress_bg',(1200,1600))]:
    Image.new('RGBA',size,(230,235,240,255)).save(root/f'assets/templates/{name}.png')
for level in range(1,6):Image.new('RGBA',(64,64),(180,40*level,90,255)).save(root/f'assets/icons/diff/{level}.png')
for name in ['line/line_290.png','body/body_290_000.png','skin/skin_290_000.png','face/face_290_000.png']:
    p=root/'assets/dress/common'/name;p.parent.mkdir(parents=True,exist_ok=True)
    Image.new('RGBA',(160,160),(120,150,190,255)).save(p)
Image.new('RGBA',(600,90),(100,130,160,255)).save(root/'assets/name_plate/name_plate_0.png')
charts={};catalog=[];rolls=[];records=[]
for i in range(35):
    sid=10000+i;title=f'Synthetic {i:02}';combo=int(fixture['chart']['combo'])
    charts[str(sid)]={**fixture['chart'],'id':sid,'level':4,'title':title,'song_name':title,'song_name_jp':title}
    catalog.append(dict(id=sid,song_name=title,song_name_jp=title,level_4=9,level_1='-',level_2='-',level_3='-',level_5='-',shelf_status=0,max_combo=[0,0,0,combo,0],type='南梦宫原创音乐',bpm='140'))
    rolls.append({**fixture['roll'],'id':sid,'level':4,'title':title,'song_name':title})
    records.append(dict(song_no=sid,level=4,good_cnt=combo-10,ok_cnt=9,ng_cnt=1,high_score=900000+i*100,stage_cnt=1,clear_cnt=1,full_combo_cnt=0,dondaful_combo_cnt=0))
for name,value in dict(rating_structured_with_ids=dict(songs=charts,const_table=fixture['const_table']),song_data=catalog,song_data_raw=catalog,song_alias=[],song_score=[],taiko_goku_onis=rolls,taiko_goku_all_levels_stream=[]).items():
    (root/f'songs/{name}.json').write_text(json.dumps(value))
payload=dict(profile=dict(userid='111',mydon_name='Synthetic',name='Synthetic',gameCostume=dict(color_limb=0,color_body=0,color_face=0)),songs=records,achievement={},dojo={})
from taiko_store import PublicationStore
store=PublicationStore(root/'userdata','111')
with store.exclusive():store.publish({'current':store.stage(json.dumps(payload).encode())},filesystem_times={'fileMtimes':{'current':1737000000.0},'fileCtimes':{'current':1737000000.0}})
