from pathlib import Path
import json,hashlib,shutil
here=Path(__file__).resolve().parent;repo=here.parents[1];initial=here/'permanent-staging/formal68';out=here/'permanent-staging/formal68-compact';assert not out.exists();out.mkdir(parents=True)
for src in initial.rglob('*'):
 if src.is_file() and src.name not in['SHA256-MANIFEST.json','independent-full-geometry-oracle68.json','old-cached-input-comparison-formal68.json']:
  target=out/src.relative_to(initial);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,target)
raw=json.loads((here/'independent-oracle68.json').read_text(encoding='utf8'))
oracle={'engine':raw['engine'],'observations':[{k:r[k]for k in['name','original','hancom','afterLayout']}for r in raw['observations']],'scope':'Every public field of each independent Hancom-saved source layout, frozen on official68. Exact metadata five values are independently retained in actual11-formal68.json/raw-summary-oracle41.json; full preservation graphs remain in ignored source diagnostics.'}
(out/'independent-geometry-oracle68.json').write_text(json.dumps(oracle,ensure_ascii=False,indent=2),encoding='utf8')
oldpath=here/'original-comparison/result.json';old=json.loads(oldpath.read_text(encoding='utf8'));records=[]
for r in old['observations']:
 records.append({k:r[k]for k in['mode','original','hancom','geometryDifferences','meaningDifferences','jueonyResave']if k in r})
 for key in['original','hancom']:
  src=repo/'build/hancom-file-preservation-20261017'/r[key]['name'];target=out/'history/fixtures'/src.name;target.parent.mkdir(parents=True,exist_ok=True);assert hashlib.sha256(src.read_bytes()).hexdigest()==r[key]['sha256'];shutil.copy2(src,target)
summary={'engine':old['engine'],'results':old['results'],'failures':old['failures'],'observations':records,'originalFullDiagnosticPath':oldpath.relative_to(repo).as_posix(),'originalFullDiagnosticSha256':hashlib.sha256(oldpath.read_bytes()).hexdigest(),'scope':old['scope']}
(out/'history/old-cached-input-comparison-formal68.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
readme=(out/'README.md').read_text(encoding='utf8').replace('The complete published geometry oracle is preserved separately','The complete published geometry oracle is preserved separately in independent-geometry-oracle68.json').replace('Font files, WASM, SDK binaries, public corpora and user documents are excluded.','Full duplicated preservation graphs stay in ignored diagnostics; all failed geometry/meaning fields, the original immutable artifacts and the SHA of the full diagnostic remain preserved. Font files, WASM, SDK binaries, public corpora and user documents are excluded.')
(out/'README.md').write_text(readme,encoding='utf8');shutil.copy2(Path(__file__),out/'reproduce/package-compact.py')
files=[{'path':p.relative_to(out).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in sorted(out.rglob('*'))if p.is_file()]
manifest={'files':files,'fileCount':len(files),'payloadBytes':sum(x['bytes']for x in files),'scope':'Formal68 actual11=8PASS/3FAIL; full geometry fields and all metadata differences retained, no native candidate result.'};target=out/'SHA256-MANIFEST.json';target.write_text(json.dumps(manifest,indent=2),encoding='utf8')
for row in files:assert hashlib.sha256((out/row['path']).read_bytes()).hexdigest()==row['sha256']
print(json.dumps({'path':str(out),'files':len(files),'bytes':manifest['payloadBytes'],'manifestSha256':hashlib.sha256(target.read_bytes()).hexdigest()}))
