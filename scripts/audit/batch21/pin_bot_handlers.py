"""Wrap actual NoneBot handler scopes; never modify the framework."""
import ast,json
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124');root=BASE/'bot';changes=[]
for file in (root/'taiko_bot/runtime').rglob('*.py'):
 text=file.read_text();tree=ast.parse(text);functions=[]
 for node in ast.walk(tree):
  if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)) and any(isinstance(d,ast.Call) and isinstance(d.func,ast.Attribute) and d.func.attr=='handle' for d in node.decorator_list):
   if not any(isinstance(d,ast.Name) and d.id=='with_catalog' for d in node.decorator_list):functions.append(node)
 if not functions:continue
 lines=text.splitlines(keepends=True)
 for node in sorted(functions,key=lambda n:n.lineno,reverse=True):lines.insert(node.lineno-1,' '*node.col_offset+'@with_catalog\n')
 text=''.join(lines);imp='from taiko_bot.catalog.reader import with_catalog\n'
 if 'from __future__ import annotations\n' in text:text=text.replace('from __future__ import annotations\n','from __future__ import annotations\n'+imp,1)
 else:
  tree=ast.parse(text);first=tree.body[0]
  if isinstance(first,ast.Expr) and isinstance(first.value,ast.Constant) and isinstance(first.value.value,str):
   lines=text.splitlines(keepends=True);lines.insert(first.end_lineno,imp);text=''.join(lines)
  else:text=imp+text
 compile(text,str(file),'exec');file.write_text(text)
 changes.append({'path':str(file.relative_to(root)),'handlers':[f.name for f in functions]})
(BASE/'viewer/docs/wahlap-authority-b21-20261124/handler-scopes.json').write_text(json.dumps(changes,indent=2)+'\n')
print(json.dumps({'files':len(changes),'handlers':sum(len(r['handlers']) for r in changes)}))
