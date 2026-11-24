#!/usr/bin/env python3
"""Run existing core recommendation goldens using synthetic fixtures. No business I/O."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import sys
import unittest

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--core-tests', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    from sakura_taiko_core.recommendation import candidates
    from sakura_taiko_core.models.calculation import SongStats
    fixture = args.core_tests / 'fixtures/recommendation-candidates.json'
    if fixture.stat().st_size > 1048576:
        raise ValueError('fixture-size-limit')
    data = json.loads(fixture.read_text())
    defaults = {int(k): v for k, v in data['defaultIds'].items()}
    table = candidates.build_const_table(data['config']['const_table']['const_to_score'])
    cases = []
    for case in data['cases']:
        stats = [SongStats(**row) for row in data['statsByProfile'][case['profile']]]
        rows = candidates.recommend_songs(stats, data['config']['songs'], table, case['dimension'], case['limit'],
            default_ids=defaults, cn_available_chart_keys={tuple(row) for row in case['cn']} if case['cn'] else None,
            on_shelf_song_ids=set(case['shelf']) if case['shelf'] else None)
        if rows != case['expected']:
            raise AssertionError('existing-policy-golden-mismatch')
        cases.append({'profile': case['profile'], 'dimension': case['dimension'], 'limit': case['limit'],
            'rows': [{k: row[k] for k in ('song_id', 'level', 'is_in_strict_range') if k in row} for row in rows]})
    suite = unittest.defaultTestLoader.discover(str(args.core_tests), pattern='test_recommendation.py')
    result = unittest.TextTestRunner(stream=sys.stderr, verbosity=1).run(suite)
    if not result.wasSuccessful():
        raise AssertionError('existing-target-regression')
    sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
    # Hash all computation sources so imported dependencies cannot drift unnoticed.
    core_root = Path(candidates.__file__).resolve().parents[1]
    sources = {str(p.relative_to(core_root)): sha(p) for p in sorted(core_root.rglob('*.py'))}
    report = {'kind': 'synthetic-existing-policy-replay', 'coreVersion': importlib.metadata.version('sakura-taiko-core'),
        'dependencyVersions': {'sakura-taiko-contract': importlib.metadata.version('sakura-taiko-contract')},
        'fixtureSha256': sha(fixture), 'targetFixtureSha256': sha(args.core_tests / 'fixtures/recommendation-targets.json'),
        'sourceManifestSha256': hashlib.sha256(json.dumps(sources, sort_keys=True).encode()).hexdigest(),
        'sourceHashes': sources, 'goldenCases': len(cases), 'regressionTests': result.testsRun, 'cases': cases,
        'stablePrediction': 'not-present-in-ordinary-rows', 'realPlayerLabels': 0,
        'algorithmPromotion': 'not-authorized'}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'goldenCases': len(cases), 'regressionTests': result.testsRun, 'output': str(args.output)}))

if __name__ == '__main__':
    main()
