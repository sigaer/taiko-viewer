"""Synthetic-only host adapter for the UNMODIFIED pinned Bot core.

No runtime root, userdata path or account loader is imported. All chart/score
inputs below are generated in memory. Caller must supply an exported core tree.
"""
from __future__ import annotations
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import random
import statistics
import sys
from datetime import date

SOURCE_COMMIT = '38a47d882a48883cda91ca27f778adfd8ddb2ef9'
CORE_TREE = '49efcd37beb3b9f1a31c76b13c96490ab52e153c'
CLOCK = '2026-11-25T00:00:00Z'
CATALOG = 'synthetic-catalog/b43-v1'


def load_core():
    raw = os.environ.get('B43_CORE_SOURCE')
    if not raw:
        raise ValueError('B43_CORE_SOURCE must point to the explicit frozen core export; no runtime defaults')
    root = Path(raw).resolve(strict=True)
    expected = json.loads(Path(__file__).with_name('m0-source.json').read_text())
    digest = hashlib.sha256()
    for path in sorted(root.rglob('*.py')):
        digest.update(path.relative_to(root).as_posix().encode() + b'\0' + path.read_bytes() + b'\0')
    if digest.hexdigest() != expected['sourceSha256']:
        raise ValueError('M0 source fingerprint mismatch')
    spec = importlib.util.spec_from_file_location('sakura_taiko_core', root / '__init__.py', submodule_search_locations=[str(root)])
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    from sakura_taiko_core.recommendation import estimator, support
    from sakura_taiko_core.score.calculation import _compute_results_from_userdata_records
    from sakura_taiko_core.rating.v1 import aggregate_topN_value, build_const_table
    return estimator, support, _compute_results_from_userdata_records, aggregate_topN_value, build_const_table, expected


def generate(seed=4301):
    estimator, support, calculate, aggregate, const_builder, source = load_core()
    rng = random.Random(seed)
    charts, raw_features = [], {}
    # Target charts 1..12; visible history charts 101..118 never share target families.
    for sid in list(range(1, 13)) + list(range(101, 119)):
        index = sid if sid < 100 else sid - 100
        title = f'Synthetic chart {sid}'
        charts.append({'id': sid, 'level': 4, 'title': title, 'title_cn': title, 'max_combo': 500,
                       'goku_score': 1000000, 'initial_points': 2000, 'ok_points': 1000,
                       'roll_total_seconds': 0, 'balloon_hits': 0,
                       'rating_scores': {'goku': 1000000, 'ziya': 950000, 'fenya': 900000, 'jinya': 800000}})
        raw_features[str(sid)] = {'id': sid, 'level': 4, 'song_name_cn': title, 'score': 7.0 + (index % 6) * .45,
            'combo': 500, '复合处理': 38 + index % 7 * 4, '平均密度': 35 + index % 5 * 6,
            '瞬间密度': 40 + index % 6 * 5, '叩き分け': 38 + index % 4 * 7,
            'BPM变化': 8, 'HS变化': 5}
    const_map = {str(v / 10): v / 10 for v in range(10, 151)}
    const_table = const_builder(const_map)
    cfg = {'songs': raw_features, 'const_table': {'const_to_score': const_map}}
    features = {(int(k), 4): support.rating_feature_from_raw(v) for k, v in raw_features.items()}
    chart_map = {(c['id'], 4): c for c in charts}
    titles = {c['id']: support.chart_title_key(c) for c in charts}
    rows, example = [], None
    for user in range(60):
        history_count = 0 if user % 15 == 0 else 4 if user % 5 == 0 else 18
        ability = .82 + .16 * rng.random()
        style = [rng.uniform(-.012, .012) for _ in range(3)]
        history = []
        for sid in range(101, 101 + history_count):
            rate = max(.76, min(.997, ability + style[sid % 3] + rng.gauss(0, .012)))
            good = round(500 * rate)
            ok = min(500 - good, max(0, round((500 - good) * .8)))
            history.append({'song_no': sid, 'level': 4, 'good_cnt': good, 'ok_cnt': ok,
                'ng_cnt': 500 - good - ok, 'combo_cnt': good + ok, 'pound_cnt': 0,
                'high_score': good * 2000 + ok * 1000, 'clear_cnt': 1,
                'update_datetime': '2026-11-24 00:00:00'})
        best = {(r['song_no'], 4): r for r in history}
        ratings = calculate(history, cfg, const_table, default_ids={})
        stable, pb = estimator._build_estimator_user_profiles(ratings, best, charts, features)
        samples = estimator._build_history_samples(best, titles, features, {}, const_table,
            default_ids={}, chart_by_key=chart_map, today=date(2026, 11, 25))
        profile = estimator.ScoreEstimatorProfile(stable, stable, pb, best, titles, features, {}, const_table,
                                                   samples, chart_map, {})
        rating = aggregate(ratings, 'AI_rating', 20)
        six = [aggregate(ratings, key, 20) for key in ['大歌力', '体力', '高速处理', '精度力', '节奏处理', '复合处理']]
        structure = [statistics.mean([r[key] / 500 for r in history]) if history else 0
                     for key in ['good_cnt', 'ok_cnt', 'ng_cnt']]
        for sid in range(1, 13):
            # Outcomes are simulated physical scores, not copied or exposed by the adapter.
            rate = max(.75, min(.999, ability + style[sid % 3] - (sid % 6) * .002 + rng.gauss(0, .013)))
            good = round(500 * rate)
            ok = min(500 - good, max(0, round((500 - good) * .8)))
            outcome = good * 2000 + ok * 1000
            estimate = estimator._estimate_with_profile(profile, sid, 4, today=date(2026, 11, 25))
            row = {'user': f'synthetic-{user:03}', 'chart': f'synthetic-chart-{sid}',
                'family': f'synthetic-family-{sid % 3}', 'snapshot': 1, 'asOf': CLOCK,
                'visibleAt': '2026-11-24T00:00:00Z', 'profileCharts': [f'synthetic-chart-{r["song_no"]}' for r in history],
                'rating': rating, 'six': six, 'structure': structure, 'historyCount': history_count,
                'y': outcome, 'm0': estimate.stable.score if estimate.stable else None,
                'catalogRevision': CATALOG, 'chartRevision': 'synthetic-chart/1'}
            rows.append(row)
            if user % 10 == 0:
                rows.append({**row, 'snapshot': 0, 'y': outcome - 1000})
            if example is None and estimate.stable:
                example = {'chart': row['chart'], 'rating': rating,
                    'stable': estimate.stable.score, 'pb': estimate.pb.score if estimate.pb else None,
                    'reliability': estimate.reliability, 'dataSufficiency': estimate.data_sufficiency}
    manifest = {**source, 'seed': seed, 'clock': CLOCK, 'target': 'best-score-snapshot/1',
        'catalogRevision': CATALOG, 'chartRevision': 'synthetic-chart/1', 'ratingDefinition': 'bot-core-v1-top20/synthetic-const-table-v1',
        'population': 'synthetic-only', 'users': 60, 'targetCharts': 12, 'historyCharts': 18,
        'inputRows': len(rows), 'm0Point': 'stable.score', 'm0Fitting': 'none; deterministic per-user target-excluded inference',
        'example': example, 'limitations': ['Synthetic outcomes cannot establish real-world independent cohort information.',
        'Current best snapshot target; no attempt labels.', 'Synthetic const table is not the production catalog.']}
    return rows, manifest
