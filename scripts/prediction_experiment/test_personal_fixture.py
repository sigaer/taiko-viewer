"""Only explicitly exported core source and in-memory synthetic inputs are used."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from personal_fixture import generate, load_core

class PinnedPersonalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows, cls.manifest = generate()

    def test_m0_replays_exactly_with_fixed_clock_and_source(self):
        repeated, manifest = generate()
        digest=lambda rows:hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()
        self.assertEqual(digest(self.rows),digest(repeated))
        self.assertEqual(self.manifest,manifest)
        self.assertEqual(manifest['sourceCommit'],'38a47d882a48883cda91ca27f778adfd8ddb2ef9')
        self.assertEqual(manifest['example']['stable'],896000)
        self.assertEqual(manifest['clock'],'2026-11-25T00:00:00Z')

    def test_profile_visibility_target_exclusion_and_synthetic_identity(self):
        for row in self.rows:
            self.assertTrue(row['user'].startswith('synthetic-'))
            self.assertNotIn(row['chart'],row['profileCharts'])
            self.assertLess(row['visibleAt'],row['asOf'])
            self.assertEqual(row['historyCount'],len(row['profileCharts']))
            if row['historyCount']==0:self.assertIsNone(row['m0'])
        self.assertEqual(len(self.rows),792)

    def test_no_runtime_default_or_changed_core_can_be_used(self):
        with patch.dict(os.environ,{},clear=True):
            with self.assertRaisesRegex(ValueError,'explicit frozen'):load_core()
        with tempfile.TemporaryDirectory(prefix='b43-core-reject-') as directory:
            Path(directory,'__init__.py').write_text('raise RuntimeError("must not execute")')
            with patch.dict(os.environ,{'B43_CORE_SOURCE':directory}):
                with self.assertRaisesRegex(ValueError,'fingerprint mismatch'):load_core()

    def test_candidate_fixture_is_generated_from_pinned_personal_and_aggregate_only(self):
        from preview_fixture import publish
        path=Path(__file__).resolve().parents[2]/'taiko_viewer/server/services/prediction-evidence/synthetic-preview.json'
        expected=json.loads(path.read_text())
        with tempfile.TemporaryDirectory(prefix='b43-preview-replay-') as directory:
            output=Path(directory)/'fixture.json'
            publish(output,expected['artifact']['sourceCommit'])
            self.assertEqual(json.loads(output.read_text()),expected)
        self.assertNotIn('synthetic-001',json.dumps(expected))
        self.assertEqual(expected['artifact']['ratingGrid'][0]['distinctPlayerCount'],24)
