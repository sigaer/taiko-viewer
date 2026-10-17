#!/usr/bin/env python3
"""New deterministic synthetic image dataset; not a reconstruction of lost B30 assets."""
import argparse,hashlib,json,os,shutil
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--destination',type=Path,required=True);a=p.parse_args()
vault=Path('/home/sigaer/taiko/qa-vault').resolve(strict=True)
assert 'development-qa.slice/taiko-qa-' in Path('/proc/self/cgroup').read_text()
assert a.destination.resolve().is_relative_to(vault/'sources') and not a.destination.exists()
evidence=Path(os.environ['QA_EVIDENCE_DIR']).resolve(strict=True);assert evidence.is_relative_to(vault/'runs')
a.destination.mkdir(parents=True,mode=0o700)
font=Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
(a.destination/'fonts').mkdir();shutil.copyfile(font,a.destination/'fonts/DDFont.ttf')
images=[('templates/'+name+'.png',size,(230,235,240,255)) for name,size in [('b30_template',(1920,3000)),('b30_single',(1200,700)),('progress_bg',(1200,1600))]]
images += [('icons/diff/'+str(i)+'.png',(64,64),(180,40*i,90,255)) for i in range(1,6)]
images += [('dress/common/'+name,(160,160),(120,150,190,255)) for name in ['line/line_290.png','body/body_290_000.png','skin/skin_290_000.png','face/face_290_000.png']]
images += [('name_plate/name_plate_0.png',(600,90),(100,130,160,255))]
for name,size,color in images:
 path=a.destination/name;path.parent.mkdir(parents=True,exist_ok=True)
 with Image.new('RGBA',size,color) as image:image.save(path,format='PNG')
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
files=[{'name':str(p.relative_to(a.destination)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(a.destination.rglob('*')) if p.is_file()]
report={'status':'GENERATED_NOT_RENDER_TESTED','datasetRevision':'o1-synthetic-assets-v1-20261016','root':str(a.destination),'files':files,'fontSource':str(font),'fontSourceSha256':sha(font),'generatorSha256':sha(Path(__file__)),'historicalB30ResourceParityClaim':False,'productionAssetsRead':False,'scope':'new synthetic templates and dress; system font; original lost resource hashes unavailable'}
(evidence/'synthetic-assets.json').write_text(json.dumps(report,indent=2)+'\n');(a.destination/'dataset-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'datasetRevision':report['datasetRevision'],'root':str(a.destination),'files':len(files)}))
