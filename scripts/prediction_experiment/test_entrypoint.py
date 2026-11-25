"""The actual research entry never substitutes synthetic labels for external evidence."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from run import PROTOCOL, experiment, waiting_report
from test_models import row

class ExperimentEntryTests(unittest.TestCase):
    def test_real_experiment_waits_without_any_model_metrics(self):
        report=waiting_report()
        self.assertEqual(report['status'],'WAITING_FOR_EXTERNAL_ARTIFACT')
        self.assertEqual(report['results'],[])
        self.assertEqual(report['primary'],[])
        self.assertFalse(report['decision']['hybridRecommended'])
        self.assertEqual(report['protocol']['lambdaSelection']['grid'],[0.,.25,.5,.75,1.])

    def test_default_cli_does_not_require_or_read_personal_core(self):
        with tempfile.TemporaryDirectory(prefix='b43-waiting-') as directory:
            path=Path(directory)/'status.json'
            process=subprocess.run([sys.executable,str(Path(__file__).with_name('run.py')),'--output',str(path)],capture_output=True,text=True,timeout=15)
            self.assertEqual(process.returncode,0)
            self.assertIn('WAITING_FOR_EXTERNAL_ARTIFACT',process.stdout)
            self.assertEqual(json.loads(path.read_text())['results'],[])

    def test_synthetic_matrix_is_explicitly_separate_from_actual_comparison(self):
        rows=[row(f'entry-user-{user}',chart=f'chart-{chart}',family=f'family-{chart%3}') for user in range(12) for chart in range(6)]
        def stub(train,test,model,*args):
            return [dict(r,point=r['m0'],q25=r['m0']-1000,q50=r['m0'],q75=r['m0']+1000,
                         covered=False,distinctPlayerCount=0,effectiveSampleSize=0,fallback='personal',hierarchy='none',residualShrinkage=0) for r in test]
        with patch('run.predict',side_effect=stub):
            report=experiment(rows,{'population':'synthetic-only'},workers=1)
        self.assertEqual(report['status'],'SYNTHETIC_SMOKE_ONLY')
        self.assertEqual(report['actualExperimentStatus'],'WAITING_FOR_EXTERNAL_ARTIFACT')
        self.assertEqual(len(report['results']),225)
        self.assertEqual(len(report['splitAudits']),9)
        self.assertFalse(report['decision']['hybridRecommended'])
