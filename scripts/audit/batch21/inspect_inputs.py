import gzip,json,tarfile
from collections import Counter
from pathlib import Path
root=Path('/var/tmp/taiko-batch21-20261124')
inventory=json.loads((root/'viewer/docs/catalog-release-batch2-20261124/catalog/consumer-inventory.json').read_text())
print('INVENTORY_TYPE',type(inventory).__name__)
rows=inventory if isinstance(inventory,list) else inventory.get('references',[])
print('INVENTORY',len(rows),json.dumps(Counter((r['repo'],r['path']) for r in rows).most_common(),ensure_ascii=False))
with gzip.open('/var/tmp/taiko-batch2-20261124/evidence/full-tja-scan.jsonl.gz','rt') as stream:
    row=json.loads(next(stream)); print('SCAN_SCHEMA',json.dumps(row,ensure_ascii=False)[:11000])
with tarfile.open('/var/tmp/taiko-batch2-20261124/evidence/tja-source-corpus.tar.gz') as archive:
    print('TAR_SAMPLE',[x.name for x in archive.getmembers()[:4]])
for name in ['song_data.json','rating_structured_with_ids.json','song_score.json','song_id2tjapath.json']:
    value=json.loads((Path('/home/sigaer/taiko/songs')/name).read_text())
    print('RESOURCE',name,type(value).__name__,str(value)[:900])
