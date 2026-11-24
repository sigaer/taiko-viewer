"""Migrate inputs with explicit semantics; never generate numerical oracles."""
import ast
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124')
p=BASE/'core/tests/test_recommendation.py';t=p.read_text()
t=t.replace("cn_available_chart_keys={tuple(row) for row in case['cn']},on_shelf_song_ids=set(case['shelf'])", "cn_available_chart_keys={tuple(row) for row in case['cn']} if case['cn'] else None,on_shelf_song_ids=set(case['shelf']) if case['shelf'] else None")
t=t.replace("        for case in data['cases']:","        # Legacy [] encoded no restriction. None is the reviewed replacement;\n        # the fixture's numerical/sort/identity oracles remain unchanged.\n        for case in data['cases']:",1)
p.write_text(t)
p=BASE/'core/tests/test_center_services.py';t=p.read_text().replace('cn_available_keys=set(),on_shelf_ids=set()','cn_available_keys=None,on_shelf_ids=None')
old="""        for case in d['availabilityCases']:
            self.assertEqual(normalized(sorted(availability.cn_available_chart_keys(case['merged'],case['raw']))),case['cnExpected'])
            self.assertEqual(sorted(availability.on_shelf_song_ids(case['merged'])),case['shelfExpected'])
"""
new="""        # Raw/shelf fixture encodes the retired authority contract. Preserve its
        # inputs as negative controls: none can authorize CN without a projection.
        for case in d['availabilityCases']:
            self.assertEqual(availability.cn_available_chart_keys(case['merged'],case['raw']),set())
            self.assertEqual(availability.on_shelf_song_ids(case['merged']),set())
        projected=[dict(id=42,shelf_status=1,level_4=0,catalog={'cnRelease':'LISTED','cnCurrentPlayable':[4]})]
        self.assertEqual(availability.cn_available_chart_keys(projected,[]),{(42,4)})
        self.assertEqual(availability.on_shelf_song_ids(projected),{42})
"""
assert old in t;t=t.replace(old,new);p.write_text(t)
p=BASE/'bot/tests/correctness/run.py';t=p.read_text()
t=t.replace('load_cn_available_chart_keys=lambda *args:', 'load_recommendation_chart_keys=lambda *args:')
t=t.replace("        if not INSTALLED: profiles.append('taiko_bot/runtime/player/client/recommendation_support/score_calculator.py')", "        profiles.append('taiko_bot/runtime/player/client/recommendation_support/score_calculator.py')")
p.write_text(t)
p=BASE/'bot/tests/correctness/catalog.py';t=p.read_text();tree=ast.parse(t)
node=next(n for n in tree.body[4:] if isinstance(n,ast.ClassDef)) if False else next(n for n in tree.body if isinstance(n,ast.ClassDef))
replacements={
'test_raw_and_merged_positive_intersection':'''    def test_official_projection_overrides_metadata_without_raw_fallback(self):
        rows=[dict(id=1,shelf_status=1,level_4=0,catalog={'cnRelease':'LISTED','cnCurrentPlayable':[4]}),
              dict(id=2,shelf_status=0,level_4=10,catalog={'cnRelease':'NOT_IN_CURRENT_CATALOG','cnCurrentPlayable':[]}),
              dict(id=3,shelf_status=0,level_4=9)]
        self.assertEqual(availability.cn_available_chart_keys(rows,[]),{(1,4)})
        self.assertEqual(availability.cn_available_chart_keys(rows,None),{(1,4)})
        self.assertEqual(availability.on_shelf_song_ids(rows),{1})
''',
'test_loader_fails_closed_for_missing_corrupt_or_invalid_raw':'''    def test_loader_fails_closed_without_snapshot_and_ignores_raw_metadata(self):
        import os
        from unittest.mock import patch
        from taiko_bot.catalog.availability import load_cn_available_chart_keys
        from taiko_bot.catalog.builder import build
        from taiko_bot.catalog.storage import install,activate
        from taiko_bot.catalog.reader import _load
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ,{'TAIKO_CATALOG_ROOT':str(Path(directory)/'catalog')}):
            root=Path(directory); merged=root/'songs/song_data.json';merged.parent.mkdir()
            merged.write_text('[{"id":21,"shelf_status":0,"level_4":10}]')
            with self.assertRaisesRegex(ValueError,'authority unavailable'): load_cn_available_chart_keys(merged)
            authority={'manifest':{'complete':True,'source':'https://wl-taiko.wahlap.net/api/user/all/songs','fetchedAt':'2026-11-24T00:00:00Z'},'sourceRevision':'fixture',
                'byId':{21:dict(id=21,**{f'level_{d}':9 if d==4 else 0 for d in range(1,6)})}}
            snapshot=build(authority,[dict(id=21,shelf_status=0,level_4=9,level_5=10)])
            install(root/'catalog',snapshot);activate(root/'catalog',snapshot['catalogRevision'])
            for content in ['{broken','{}','[]']:
                (merged.parent/'song_data_raw.json').write_text(content)
                self.assertEqual(load_cn_available_chart_keys(merged),{(21,4)})
            _load.cache_clear()
'''}
lines=t.splitlines(keepends=True)
for n in reversed(node.body):
 if isinstance(n,ast.FunctionDef) and n.name in replacements: lines[n.lineno-1:n.end_lineno]=[replacements[n.name]]
p.write_text(''.join(lines))
print('Migrated legacy empty-mask inputs and obsolete authority assertions; numerical fixtures unchanged')
