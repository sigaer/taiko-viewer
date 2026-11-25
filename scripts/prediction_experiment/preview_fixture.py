"""Publish one synthetic M0 example and aggregated cohort fixture, never member rows."""
import json
from pathlib import Path
from personal_fixture import generate


def publish(destination, source_commit):
    rows, manifest = generate()
    example = manifest['example']
    # The demonstration population is distinct from the synthetic profile.
    # Equal-sized groups publish coarse distribution bins, not member scores.
    candidates = sorted([r for r in rows if r['chart'] == example['chart'] and r['snapshot'] == 1 and r['user'] != 'synthetic-001'],
                        key=lambda r: abs(r['rating'] - example['rating']))[:24]
    scores = sorted(r['y'] for r in candidates)
    bins = []
    for start in range(0, 24, 6):
        midpoint = round(sum(scores[start:start + 6]) / 6 / 10000) * 10000
        if bins and bins[-1]['score'] == midpoint:
            bins[-1]['weight'] += 6
        else:
            bins.append({'score': midpoint, 'weight': 6})
    def quantile(q):
        mass = 0
        for bucket in bins:
            mass += bucket['weight']
            if mass >= 24*q: return bucket['score']
    artifact = {'schemaVersion': 'cohort-prior-v1', 'artifactId': 'synthetic-cohort/b43-v1',
        'sourceRepository': 'https://github.com/sigaer/taiko-viewer', 'sourceCommit': source_commit,
        'dataSnapshotRevision': 'synthetic-cohort/1', 'catalogRevision': manifest['catalogRevision'],
        'region': 'SYNTHETIC', 'ruleset': 'synthetic-score/1', 'canonicalChartId': example['chart'],
        'chartRevision': manifest['chartRevision'], 'ratingDefinition': manifest['ratingDefinition'],
        'ratingGrid': [{'rating': example['rating'], 'distinctPlayerCount': 24, 'effectiveSampleSize': 24,
            'scoreDistribution': bins, 'scoreQ25': quantile(.25), 'scoreQ50': quantile(.5), 'scoreQ75': quantile(.75),
            'observed': {'fc': None, 'df': None, 'clear': None}, 'uncertainty': {'method': 'synthetic-grouped-histogram', 'standardError': None},
            'selectionCoverage': {'eligiblePlayers': 59, 'observedPlayers': 59,
                'limitations': ['Synthetic only; coarse grouped bins; no attempt outcomes.']}}],
        'modelVersion': 'cohort-prior/1', 'calibrationVersion': 'synthetic-empirical-cdf/1', 'generatedAt': manifest['clock'],
        'population': {'kind': 'synthetic', 'exclusion': 'disjoint-evaluation-population', 'scopeRevision': 'synthetic-disjoint/1'}}
    output = {key: manifest[key] for key in ['sourceCommit', 'sourceSha256', 'coreTree', 'coreVersion', 'clock', 'ratingDefinition']}
    output.update(example)
    output['artifact'] = artifact
    destination.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')

if __name__ == '__main__':
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--source-commit', required=True)
    arguments=parser.parse_args()
    publish(arguments.output, arguments.source_commit)
