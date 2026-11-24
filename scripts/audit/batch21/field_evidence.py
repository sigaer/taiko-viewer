"""Report only field names; do not emit player values or paths."""
import hashlib,json,re
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124')
diffs=json.loads((BASE/'evidence/integrity-private/historical-current-field-diffs.json').read_text())
safe=[]
for item in diffs:
 names=[x for x in item['path'] if isinstance(x,str) and re.fullmatch('[A-Za-z_]{1,64}',x)]
 safe.append({'fields':names,'kind':item['kind']})
path=BASE/'viewer/docs/wahlap-authority-b21-20261124/integrity/publication-field-difference-summary.json'
path.write_text(json.dumps({'differencesBetweenGenerations':safe,'interpretation':'These compare two distinct committed generations, not proven before/after corruption bytes.'},indent=2)+'\n')
# Recover the first audit response only if the original recorded checksum proves
# byte-for-byte identity; never touch runtime evidence or Publication objects.
folder=BASE/'evidence/wahlap-private';new=json.loads((folder/'played.json').read_bytes())
body=(folder/'played.json').read_bytes().replace(new['requestId'].encode(),b'eb1b9a99-8d07-4199-8001-26b5e968f029')
original_hash='7257dc2470aef5506780e3c565f01b1105f85ace1395ce25968584604c63cb38'
recovered=hashlib.sha256(body).hexdigest()==original_hash
if recovered:
 with (folder/'initial-played-response.sha256-proven.json').open('xb') as stream:stream.write(body)
print(json.dumps({'fieldSummary':safe,'initialAuditResponseRecoveredWithOriginalSha256':recovered}))
