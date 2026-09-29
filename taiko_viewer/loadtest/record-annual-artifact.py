#!/usr/bin/env python3
import hashlib,json,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve();assert str(root).startswith('/var/tmp/annual-test-')
viewer=root/'source/taiko-forum/taiko_viewer'
manifest={str(p.relative_to(viewer/'.output')):hashlib.file_digest(p.open('rb'),'sha256').hexdigest() for p in (viewer/'.output').rglob('*') if p.is_file()}
inputs=json.loads((root/'evidence/input-manifest.json').read_text())
build=json.loads((viewer/'.output/public/_nuxt/builds/latest.json').read_text())
(root/'evidence/artifact-manifest.json').write_text(json.dumps({'commit':inputs['commit'],'version':inputs['version'],'build':build,'files':manifest},indent=2))
print(json.dumps({'commit':inputs['commit'],'version':inputs['version'],'build':build,'artifactFiles':len(manifest)}))
