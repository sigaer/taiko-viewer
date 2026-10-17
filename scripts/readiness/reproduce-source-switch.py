"""Installed-wheel, synthetic-only reproduction of the retained historical FAIL.

Exit 1 means the forbidden reappearance play_delta still exists. Never xfail or
count this diagnostic's successful execution as a history-continuity PASS.
"""
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import socket
import sys
import tempfile
from datetime import date, datetime

assert sys.flags.isolated, 'Run the installed role interpreter with -I'
with tempfile.TemporaryDirectory(prefix='source-switch-repro-', dir='/var/tmp') as directory:
    root = Path(directory)
    for key in ('TAIKO_CENTER_ROOT', 'TAIKO_RUNTIME_ROOT', 'TAIKO_OFFLINE_ROOT'):
        os.environ[key] = directory
    # Package initialization eagerly builds duplicate-song groups. Supply only
    # an empty synthetic catalog; the event reproduction needs no real catalog.
    (root / 'songs').mkdir()
    (root / 'songs' / 'song_data.json').write_text('[]')
    os.environ['TAIKO_COMPUTE_ONLY'] = '1'
    def forbidden(*args, **kwargs):
        raise AssertionError('Network forbidden for synthetic history reproduction')
    socket.socket.connect = forbidden
    from taiko_bot.offline.annual_summary.events import build_observation_events
    from taiko_bot.offline.annual_summary.snapshots import load_snapshot_history, select_window
    import taiko_bot.offline.annual_summary.events as implementation
    assert '/site-packages/' in implementation.__file__
    results = []
    for name, snapshots in (
        ('historical_four_snapshot', [('wahlap', 10), ('hiroba', 20), ('wahlap', None), ('wahlap', 30)]),
        ('same_source_delete_reappear', [('wahlap', 10), ('wahlap', None), ('wahlap', 30)]),
        ('direct_switch_no_deletion_control', [('wahlap', 10), ('hiroba', 20), ('wahlap', 30)]),
    ):
        folder = root / name
        folder.mkdir()
        for day, (source, stage) in enumerate(snapshots, 1):
            stamp = f'2026-01-{day:02d} 00:00:00'
            song = {'song_no': 1, 'level': 4, 'stage_cnt': stage, 'high_score': 1000000,
                    'update_datetime': stamp, 'highscore_datetime': stamp,
                    'good_cnt': 100, 'ok_cnt': 0, 'ng_cnt': 0, 'combo_cnt': 100,
                    'clear_cnt': 0, 'full_combo_cnt': 0, 'dondaful_combo_cnt': 0}
            payload = {'profile': {}, 'achievement': {}, 'dojo': {},
                       'songs': [] if stage is None else [song], '_meta': {'full': True, 'source': source}}
            (folder / f'data_202601{day:02d}_000000_000000.json').write_text(json.dumps(payload))
        history = load_snapshot_history(name, userdata_dir=root)
        selection = select_window(history.snapshots, start_date=date(2026, 1, 1),
                                  generated_at=datetime(2026, 1, 31), end_date=date(2026, 1, 31))
        events, stats = build_observation_events(selection, start_date=date(2026, 1, 1), effective_end_date=date(2026, 1, 31))
        plays = [event for event in events if event['type'] == 'play_delta']
        results.append({'case': name, 'expectedPlayDeltaCount': 0, 'actualPlayDeltaCount': len(plays),
                        'playCounts': [event['delta']['playCount'] for event in plays],
                        'warnings': [event['warnings'] for event in plays], 'pass': not plays})
    print(json.dumps({'version': importlib.metadata.version('taiko-bot'), 'isolated': sys.flags.isolated,
                      'implementationSha256': hashlib.file_digest(open(implementation.__file__, 'rb'), 'sha256').hexdigest(),
                      'cases': results, 'status': 'PASS' if all(row['pass'] for row in results) else 'FAIL'}, indent=2))
    sys.exit(0 if all(row['pass'] for row in results) else 1)
