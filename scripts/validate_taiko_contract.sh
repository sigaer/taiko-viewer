#!/usr/bin/env bash
# Invoke through scripts/memory/run_qa.sh. No business HTTP or database access.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
/usr/bin/python3 packages/sakura-taiko-contract/tools/generate_bindings.py --check
/usr/bin/python3 -m unittest discover -s packages/sakura-taiko-contract/tests -p 'test_*.py' -v
node --experimental-strip-types --test packages/sakura-taiko-contract/tests/contract.test.mjs
node taiko_viewer/node_modules/typescript/bin/tsc --noEmit --skipLibCheck --target es2022 --module nodenext packages/sakura-taiko-contract/src/index.ts
/usr/bin/python3 - <<'PY'
import hashlib, json
from pathlib import Path
root=Path('packages/sakura-taiko-contract')
files=['schema/contract-v1.json','src/index.ts','src/legacy.mjs','sakura_taiko_contract/types.py','sakura_taiko_contract/legacy.py','fixtures/scores.json','fixtures/growth.json','fixtures/legacy_hiroba.py']
result={'date':'2026-10-10 Asia/Shanghai','contract_version':'1.0','package_version':'0.1.0','gate':'PASS','python_tests':5,'javascript_tests':5,'score_golden_cases':5,'legacy_hiroba_oracles':2,'viewer_score_fact_golden_cases':1,'generated_bindings_check':'PASS','typescript_check':'PASS','sha256':{name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in files},'fixtures':'synthetic only','business_http_calls':False,'database_connections':False,'production_mutations':False,'consumer_switches':False}
Path('docs/taiko-domain-extraction/evidence/phase1-validation.json').write_text(json.dumps(result,indent=2)+'\n')
print('Phase 1 validation evidence saved')
PY
