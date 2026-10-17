"""Generate Python/TypeScript types from the frozen JSON Schema; check in outputs."""
from pathlib import Path
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]

def render_type(value, language):
    if '$ref' in value:
        return value['$ref'].rsplit('/',1)[-1]
    if 'enum' in value:
        items=[json.dumps(x,ensure_ascii=False) if language=='ts' else repr(x) for x in value['enum']]
        return ' | '.join(items) if language=='ts' else 'Literal['+', '.join(items)+']'
    kind=value.get('type')
    if isinstance(kind,list):
        return ' | '.join(render_type(dict(value,type=k),language) for k in kind)
    if kind=='object':
        return 'Record<string, unknown>' if language=='ts' else 'Dict[str, Any]'
    if kind=='array':
        inner=render_type(value['items'],language)
        return f'Array<{inner}>' if language=='ts' else f'List[{inner}]'
    return {'ts':{'string':'string','integer':'number','number':'number','boolean':'boolean','null':'null'},'py':{'string':'str','integer':'int','number':'float','boolean':'bool','null':'None'}}[language].get(kind,'unknown' if language=='ts' else 'Any')

def generate():
    schema=json.loads((ROOT/'schema/contract-v1.json').read_text())
    version=schema['$id'].rsplit(':',1)[-1]
    ts=['// Generated from schema/contract-v1.json. Run tools/generate_bindings.py.','export const CONTRACT_VERSION = '+json.dumps(version)+' as const;']
    py=['# Generated from schema/contract-v1.json. Run tools/generate_bindings.py.','from __future__ import annotations','from typing import Any, Dict, List, Literal, NotRequired, TypedDict','CONTRACT_VERSION = '+json.dumps(version)]
    for name,definition in schema['$defs'].items():
        if definition.get('type')!='object' or 'properties' not in definition:
            ts.append(f'export type {name} = {render_type(definition,"ts")};')
            py.append(f'{name} = {render_type(definition,"py")}')
            continue
        ts.append(f'export type {name} = {{')
        py.append(f'class {name}(TypedDict):')
        required=set(definition.get('required',[]))
        for key,value in definition['properties'].items():
            ts.append(f'  {key}{"" if key in required else "?"}: {render_type(value,"ts")};')
            typ=render_type(value,'py')
            py.append(f'    {key}: {typ if key in required else "NotRequired["+typ+"]"}')
        ts.append('};')
    ts.append('export { fromLegacyScore, toLegacyScore } from "./legacy.mjs";')
    ts.append('export { legacyScoreReader, legacyScoreValue, legacyCrown, legacyJudgmentTotal, legacyScoreInstant, hasLegacyScoreEvidence } from "./read-values.mjs";')
    return {'src/index.ts':'\n'.join(ts)+'\n','sakura_taiko_contract/types.py':'\n'.join(py)+'\n'}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    for name,contents in generate().items():
        path=ROOT/name
        if args.check:
            if not path.exists() or path.read_text()!=contents: raise SystemExit('stale generated binding: '+name)
        else: path.write_text(contents)
    print('contract bindings: '+('checked' if args.check else 'generated'))
