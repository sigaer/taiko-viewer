import json,collections,sys,importlib.util
from pathlib import Path
package=Path(sys.argv[1])/"packages/sakura-taiko-core/core"
spec=importlib.util.spec_from_file_location("sakura_taiko_core",package/"__init__.py",submodule_search_locations=[str(package)])
m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
from sakura_taiko_core.chart.availability import cn_available_chart_keys
rows=[json.loads(Path("/home/sigaer/taiko/songs/"+f).read_text()) for f in ("song_data.json","song_data_raw.json")]
print(json.dumps({"shelf_counts":[dict(collections.Counter(str(r.get("shelf_status","MISSING")) for r in rs)) for rs in rows],"cn_charts":len(cn_available_chart_keys(*rows))}))
