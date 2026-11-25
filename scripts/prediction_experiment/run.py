#!/usr/bin/env python3
"""Bounded preregistered synthetic experiment. Only aggregate output is persisted."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

from models import BUDGETS, CALIBRATION_USERS, MATCHINGS, MODELS, predict
from validation import audit_split, deduplicate, make_split, metrics, paired_gain

SPLITS = ('cross-user', 'chart-family', 'combined')
PROTOCOL = {
    'version': 'b43-preregistered-synthetic/1',
    'primary': {'matching': 'rating', 'budget': 'top24'},
    'models': list(MODELS), 'matching': list(MATCHINGS), 'budgets': list(BUDGETS),
    'matchingDefinitions': {'rating': 'Rating only', 'six': 'Rating + six dimensions', 'structure': 'Rating + six dimensions + score structure'},
    'splits': list(SPLITS), 'folds': 3, 'calibrationMaximumUsers': CALIBRATION_USERS,
    'calibration': 'train-user-oof-residual-quantiles/1',
    'hierarchyPriorEquivalentUsers': 12,
    'kernelBandwidth': 'max(standardized distance to 24th selected neighbor,1)',
    'adaptiveBudget': 'first prefix >=10 reaching ESS24, cap60 distinct users',
    'bootstrapPrimary': 200, 'bootstrapExploratory': 50,
    'rankingThreshold': 950000, 'rankingK': 3,
    'temporal': 'unavailable:no-real-historical-snapshots',
    'target': 'best-score-snapshot/1',
    'm5': 'not-run:optional-chart-feature-model-out-of-scope',
    'decisionRule': 'synthetic-only always retain M0; real adoption needs stable cross-user and combined M4 gain',
}


def _summary(predictions):
    count = len(predictions)
    return {
        'evaluableRecords': count,
        'targetCohortCoverage': sum(row['covered'] for row in predictions) / count if count else None,
        'meanDistinctPlayers': sum(row['distinctPlayerCount'] for row in predictions) / count if count else None,
        'meanEffectiveSampleSize': sum(row['effectiveSampleSize'] for row in predictions) / count if count else None,
        'personalFallbackRecords': sum(row['fallback'] is not None for row in predictions),
        'familyHierarchyRecords': sum(row['hierarchy'] == 'family' for row in predictions),
        'meanResidualShrinkage': sum(row['residualShrinkage'] for row in predictions) / count if count else None,
    }


def _training_revision(rows):
    # Digest the entire synthetic training input, never expose individual IDs or
    # per-user hashes. Ordering independent of caller iteration order.
    canonical = sorted(rows, key=lambda row: (str(row['user']), row['chart'], row['snapshot']))
    return 'sha256:' + hashlib.sha256(json.dumps(canonical, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def experiment(rows, manifest, *, progress=None):
    """No row, prediction, user identity or per-user metric leaves this function."""
    unique = deduplicate(rows)
    protocol_hash = hashlib.sha256(json.dumps(PROTOCOL, sort_keys=True).encode()).hexdigest()
    report = {'schemaVersion': 'prediction-experiment-report/1', 'population': 'synthetic-only',
              'protocol': PROTOCOL, 'protocolHash': protocol_hash, 'manifest': manifest,
              'input': {'rows': len(rows), 'deduplicatedRows': len(unique), 'duplicateSnapshotsRemoved': len(rows) - len(unique),
                        'personalAvailableRows': sum(row.get('m0') is not None for row in unique),
                        'personalInsufficientRows': sum(row.get('m0') is None for row in unique),
                        'zeroHistoryRows': sum(row['historyCount'] == 0 for row in unique)},
              'splitAudits': [], 'results': [], 'primary': [],
              'decision': {'selectedModel': 'M0', 'hybridRecommended': False,
                           'reason': 'Synthetic fixtures test plumbing and leakage controls; they cannot establish real-player predictive gain.'},
              'limitations': ['No real account data or next-attempt labels.',
                              'Quantiles are train-user-OOF calibration of best-score snapshot error, not Bot stable/PB quantiles.',
                              'FC/DF/Clear next-play probabilities are not estimated.',
                              'Chart-family and combined folds apply complete user embargo; unseen-family cohort is unavailable.',
                              'No result is an authorization to deploy, replace production recommendations or import players.']}
    for split in SPLITS:
        accumulated = {(matching, budget, model): [] for matching in MATCHINGS for budget in BUDGETS for model in MODELS}
        for fold in range(3):
            train, test = make_split(unique, split, fold, folds=3)
            audit = audit_split(train, test)
            report['splitAudits'].append({'split': split, 'fold': fold, 'trainingRevision': _training_revision(train),
                                         'calibrationProvenance': 'entire-user exclusion; source m0 has no fitted cross-user parameters',
                                         'testPersonalAvailableRows': sum(row.get('m0') is not None for row in test),
                                         'testPersonalInsufficientRows': sum(row.get('m0') is None for row in test), **audit})
            baseline = predict(train, test, 'M0')
            expected = {(row['user'], row['chart'], row['snapshot']) for row in baseline}
            for matching in MATCHINGS:
                for budget in BUDGETS:
                    for model in MODELS:
                        output = baseline if model == 'M0' else predict(train, test, model, matching, budget)
                        if {(row['user'], row['chart'], row['snapshot']) for row in output} != expected:
                            raise AssertionError('model evaluable testcase set changed')
                        accumulated[(matching, budget, model)].extend(output)
            if progress:
                progress(f'{split} fold {fold + 1}/3 complete')
        for matching in MATCHINGS:
            for budget in BUDGETS:
                primary = matching == 'rating' and budget == 'top24'
                bootstrap = 200 if primary else 50
                for model in MODELS:
                    predictions = accumulated[(matching, budget, model)]
                    entry = {'split': split, 'matching': matching, 'budget': budget, 'model': model,
                             'role': 'primary' if primary else 'exploratory',
                             'cohort': _summary(predictions),
                             'metrics': metrics(predictions, k=3, bootstrap=bootstrap, seed=4301)}
                    report['results'].append(entry)
                if primary:
                    baseline, hybrid = accumulated[(matching, budget, 'M0')], accumulated[(matching, budget, 'M4')]
                    report['primary'].append({'split': split, 'pairedM4Gain': paired_gain(baseline, hybrid, bootstrap=200, seed=4301)})
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--core-source', type=Path, required=True, help='Lead-exported pinned Bot core source; no runtime data')
    parser.add_argument('--seed', type=int, default=4301)
    arguments = parser.parse_args()
    if not arguments.core_source.is_dir():
        parser.error('--core-source must be the explicit frozen source directory')
    os.environ['B43_CORE_SOURCE'] = str(arguments.core_source.resolve())
    from personal_fixture import generate
    rows, manifest = generate(seed=arguments.seed)
    report = experiment(rows, manifest, progress=lambda message: print(message, flush=True))
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(f'Aggregate synthetic report written: {arguments.output}', flush=True)


if __name__ == '__main__':
    main()
