from __future__ import annotations

import ast
from copy import deepcopy
from datetime import datetime
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from sakura_taiko_contract import from_legacy_score, to_legacy_score


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.fixtures = json.loads((ROOT/'fixtures/scores.json').read_text())

    def test_cross_language_golden_and_lossless_roundtrip(self):
        for fixture in self.fixtures:
            with self.subTest(case=fixture['name']):
                canonical = from_legacy_score(fixture['legacy'], **fixture['pythonOptions'])
                self.assertEqual(canonical, fixture['canonical'])
                self.assertEqual(to_legacy_score(canonical), fixture['legacy'])
                to_legacy_score(canonical)['song_no'] = 99
                self.assertEqual(canonical, fixture['canonical'])

    def test_old_hiroba_output_matches_contract_evidence(self):
        # Execute only the audited pure mapping, not package initializers or IO.
        class Clock:
            @staticmethod
            def now(): return datetime(2026, 10, 10, 12, 0, 0)
        for oracle in json.loads((ROOT/'fixtures/oracle-provenance.json').read_text()):
            path = ROOT/'fixtures'/oracle['fixture']
            tree = ast.parse(path.read_text())
            function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'score_detail_to_userdata_record')
            function.returns = None
            for arg in function.args.args: arg.annotation = None
            namespace = {'datetime': Clock, 'BADGE_NAME_TO_RANK': {'rainbow':8}}
            exec(compile(ast.Module(body=[function], type_ignores=[]), str(path), 'exec'), namespace)
            detail = SimpleNamespace(song_no='2', level=5, badge='rainbow', score=1000000,
                good=100, ok=0, bad=0, roll=30, max_combo=100, stage_cnt=3,
                clear_cnt=3, full_combo_cnt=2, dondaful_combo_cnt=1, crown='dondaful')
            legacy = namespace['score_detail_to_userdata_record'](detail)
            fixture = next(f for f in self.fixtures if f['name']=='hiroba-df')
            self.assertEqual(legacy, fixture['legacy'])
            self.assertEqual(to_legacy_score(from_legacy_score(legacy, source='hiroba', captured_at=fixture['canonical']['capturedAt'])), legacy)

    def test_no_inferred_clock_star_level_or_crown(self):
        value = from_legacy_score({'song_no':1,'level':4}, source='unknown', captured_at=None)
        self.assertIsNone(value['capturedAt'])
        self.assertIsNone(value['chart']['level'])
        self.assertIsNone(value['clear'])
        self.assertIsNone(value['good'])

    def test_read_contract_refuses_canonical_edits(self):
        value = deepcopy(self.fixtures[0]['canonical'])
        value['score'] = 99
        with self.assertRaises(ValueError): to_legacy_score(value)

    def test_invalid_counts_and_credentials_are_rejected(self):
        for invalid in (-1, 1.2, True, 'NaN', '0x10', '١', [], {}, 9007199254740992):
            with self.subTest(value=invalid), self.assertRaises(ValueError):
                from_legacy_score({'song_no':1,'level':4,'good_cnt':invalid}, source='wahlap', captured_at=None)
        with self.assertRaises(ValueError):
            from_legacy_score({'song_no':1,'level':4,'extension':{'cookie':'synthetic'}}, source='wahlap', captured_at=None)
        with self.assertRaises(ValueError):
            from_legacy_score({'song_no':1,'level':4,'update_datetime':True}, source='wahlap', captured_at=None)


if __name__ == '__main__': unittest.main()
