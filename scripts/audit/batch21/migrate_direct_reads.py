"""Migrate explicit song catalog reads; keep metadata producer reads untouched."""
import ast,json
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124')
ROOT=BASE/'bot';changes=[]
paths=list((ROOT/'taiko_bot/runtime').rglob('*.py'))+[
 ROOT/'taiko_bot/offline/drawinfo.py',ROOT/'taiko_bot/offline/annual_summary/helpers.py',
 ROOT/'taiko_bot/offline/dani_overview.py',ROOT/'taiko_bot/offline/target_recommend.py',
 ROOT/'taiko_bot/offline/score_prediction_support.py']
for file in paths:
 if file.name=='catalog.py' and file.parent.name=='public':continue
 text=file.read_text();tree=ast.parse(text);parents={child:node for node in ast.walk(tree) for child in ast.iter_child_nodes(node)}
 known={'SONG_DATA_PATH','song_data_path'}
 for node in ast.walk(tree):
  if isinstance(node,(ast.Assign,ast.AnnAssign)) and getattr(node,'value',None) and 'song_data.json' in ast.unparse(node.value):
   for target in node.targets if isinstance(node,ast.Assign) else [node.target]:
    if isinstance(target,ast.Name):known.add(target.id)
 def is_catalog(node):
  source=ast.unparse(node)
  return 'song_data.json' in source or any(isinstance(x,ast.Name) and x.id in known for x in ast.walk(node))
 replacements=[];withs=set();functions=set()
 for node in ast.walk(tree):
  if not isinstance(node,ast.Call) or not isinstance(node.func,ast.Attribute) or not isinstance(node.func.value,ast.Name) or node.func.value.id!='json':continue
  if node.func.attr=='loads' and node.args and is_catalog(node.args[0]):pass
  elif node.func.attr=='load' and node.args and isinstance(node.args[0],ast.Name):
   parent=parents.get(node)
   while parent is not None and not isinstance(parent,(ast.With,ast.FunctionDef,ast.AsyncFunctionDef)):parent=parents.get(parent)
   if not isinstance(parent,ast.With) or not any(is_catalog(item.context_expr) for item in parent.items):continue
   if len(parent.items)!=1 or len(parent.body)!=1:raise ValueError('Review multi-statement catalog with: '+str(file))
   withs.add(parent)
  else:continue
  replacements.append((node.lineno,node.col_offset,node.end_lineno,node.end_col_offset,'project_song_rows()'))
  parent=parents.get(node)
  while parent is not None and not isinstance(parent,(ast.FunctionDef,ast.AsyncFunctionDef)):parent=parents.get(parent)
  if parent:functions.add(parent)
 if not replacements:continue
 lines=text.splitlines(keepends=True);offsets=[0]
 for line in lines:offsets.append(offsets[-1]+len(line))
 # AST offsets count UTF-8 bytes; convert each local column to characters.
 def position(line,col):return offsets[line-1]+len(lines[line-1].encode()[:col].decode())
 for start,col,end,endcol,value in sorted(replacements,reverse=True):
  a=position(start,col);b=position(end,endcol);text=text[:a]+value+text[b:]
 fresh=ast.parse(text);lines=text.splitlines(keepends=True)
 withs=[n for n in ast.walk(fresh) if isinstance(n,ast.With) and len(n.body)==1 and
    any(is_catalog(item.context_expr) for item in n.items) and 'project_song_rows()' in ast.unparse(n.body[0])]
 for node in sorted(withs,key=lambda n:n.lineno,reverse=True):
  body=lines[node.lineno:node.end_lineno]
  lines[node.lineno-1:node.end_lineno]=[line[4:] for line in body]
 # Remove cache decorators using a fresh parse after changed line offsets.
 updated=''.join(lines);fresh=ast.parse(updated);lines=updated.splitlines(keepends=True)
 for node in sorted([n for n in ast.walk(fresh) if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name in {f.name for f in functions}],key=lambda n:n.lineno,reverse=True):
  for decorator in reversed(node.decorator_list):
   if isinstance(decorator,ast.Call) and getattr(decorator.func,'id',None)=='lru_cache':del lines[decorator.lineno-1:decorator.end_lineno]
 updated=''.join(lines)
 imp='from taiko_bot.catalog.reader import project_song_rows\n'
 if imp not in updated:
  if 'from __future__ import annotations\n' in updated:updated=updated.replace('from __future__ import annotations\n','from __future__ import annotations\n'+imp,1)
  else:
   module=ast.parse(updated);first=module.body[0]
   if isinstance(first,ast.Expr) and isinstance(first.value,ast.Constant) and isinstance(first.value.value,str):
    at=first.end_lineno;parts=updated.splitlines(keepends=True);parts.insert(at,imp);updated=''.join(parts)
   else:updated=imp+updated
 compile(updated,str(file),'exec');file.write_text(updated)
 changes.append({'path':str(file.relative_to(ROOT)),'reads':len(replacements),'functions':sorted(f.name for f in functions)})
(BASE/'viewer/docs/wahlap-authority-b21-20261124/direct-read-migrations.json').write_text(json.dumps(changes,indent=2)+'\n')
print(json.dumps({'files':len(changes),'reads':sum(x['reads'] for x in changes),'changes':changes}))
