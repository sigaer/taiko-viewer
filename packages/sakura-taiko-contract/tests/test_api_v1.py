"""Pure candidate Catalog adapter against the same JS fixture, under fixed -I Python."""
import importlib.util,json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('candidate_catalog',ROOT/'sakura_taiko_contract/catalog.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class ApiV1Golden(unittest.TestCase):
    def test_catalog_cross_language_golden(self):
        fixture=json.loads((ROOT/'fixtures/api-v1.json').read_text())
        self.assertEqual(module.project_catalog(fixture['catalogInput'],'synthetic-catalog-v1',fixture['aliasInput']),fixture['catalogExpected'])
    def test_difficulty_course_and_duplicate_fail_closed(self):
        self.assertEqual([module.difficulty_to_tja_course(x) for x in range(1,6)],list(range(5)))
        for value in (True,0,6,1.5,'4'):
            with self.assertRaises(ValueError):module.difficulty_to_tja_course(value)
        with self.assertRaises(ValueError):module.project_catalog([{'id':1},{'id':1}],'r')
if __name__=='__main__':unittest.main()
