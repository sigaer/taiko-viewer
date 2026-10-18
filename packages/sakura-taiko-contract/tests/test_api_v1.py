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
    def test_complete_catalog_cross_language(self):
        fixture=json.loads((ROOT/'fixtures/api-v1.json').read_text())
        projected=module.project_catalog(fixture['catalogInput'],'synthetic-catalog-v1',fixture['aliasInput'])
        expected=[dict(song,charts=[c for c in fixture['catalogExpected']['charts'] if c['songId']==song['songId']]) for song in fixture['catalogExpected']['songs']]
        self.assertEqual(module.catalog_songs_with_charts(projected),expected)
        self.assertEqual([c for s in expected for c in s['charts']],projected['charts'])
        empty=module.project_catalog([{'id':4,'level_1':None,'level_2':'-','level_3':0,'level_4':'','level_5':None}],'r')
        self.assertEqual(module.catalog_songs_with_charts(empty)[0]['charts'],[])
        multi=module.project_catalog([dict(id=5,**{'level_'+str(i):i for i in range(1,6)})],'r')
        self.assertEqual([c['difficulty'] for c in module.catalog_songs_with_charts(multi)[0]['charts']],list(range(1,6)))

    def test_difficulty_course_and_duplicate_fail_closed(self):
        fixture=json.loads((ROOT/'fixtures/api-v1.json').read_text())
        self.assertEqual([module.difficulty_to_tja_course(x) for x in range(1,6)],list(range(5)))
        for value in (True,0,6,1.5,'4'):
            with self.assertRaises(ValueError):module.difficulty_to_tja_course(value)
        with self.assertRaises(ValueError):module.project_catalog([{'id':1},{'id':1}],'r')
        with self.assertRaises(ValueError):module.project_catalog(fixture['catalogInput'],'r',[{'id':1,'aliases':[]},{'id':1,'aliases':[]}])
        with self.assertRaises(ValueError):module.project_catalog(fixture['catalogInput'],'r',[{'id':'9007199254740992','aliases':[]}])
if __name__=='__main__':unittest.main()
