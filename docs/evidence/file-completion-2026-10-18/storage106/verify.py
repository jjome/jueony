from pathlib import Path
import gzip,hashlib,json,re
ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads((ROOT/p).read_bytes())
manifest=read('SHA256-MANIFEST.json')
actual={p.relative_to(ROOT).as_posix()for p in ROOT.rglob('*')if p.is_file()and p.name!='SHA256-MANIFEST.json'}
assert actual==set(manifest)
for name,record in manifest.items():
 p=(ROOT/name).resolve();assert p.is_relative_to(ROOT)
 raw=p.read_bytes();assert len(raw)==record['bytes']and sha(raw)==record['sha256'],name
engine=read('engine-build.json');front=read('frontend-build.json')
assert engine['sourceId']=='fc150ef856868d03'and len(engine['patches'])==113
assert front['engineWasmSha256']==engine['wasmSha256']
workflow=read('workflows/result.json')
assert workflow['passedCases']==workflow['totalCases']==387 and len(workflow['suites'])==30 and not workflow['failures']
for suite in workflow['suites']:
 raw=(ROOT/'workflows'/suite['name']/'result.json').read_bytes();r=json.loads(raw)
 assert sha(raw)==suite['resultSHA256']and suite['status']=='PASS'and suite['scriptUnchanged']
 assert len(r['results'])==suite['expectedCases']and not r['failures']
 assert all(not isinstance(x,dict)or x['status']=='PASS'for x in r['results'])
 if 'engine'in r:assert r['engine']['wasmSha256']==engine['wasmSha256']
before=read('before/initial-aggregate.json')
assert before['passedCases']==374 and [r['name']for r in before['failures']]==['owned-native-cell-layout']
assert workflow['reviewedRerun']['originalAggregateSha256']==sha((ROOT/'before/initial-aggregate.json').read_bytes())
prefix=read('workflows/native-prefix-storage/result.json')
assert prefix['passed']==32 and len(prefix['results'])==32 and not prefix['failures']
assert sum(len(r['exports'])for r in prefix['results'])==160
for r in prefix['results']:
 assert r['originalHistory']==r['followupHistory']=='PASS'
 for e in r['exports']:assert e['guard']=='checked'and e['losses']==e['geometry']==e['semantic']==0
ui=read('workflows/native-prefix-ui/result.json')
assert len(ui['results'])==3 and all(not ui[k]for k in ['failures','pageErrors','consoleErrors','externalRequests'])
py=read('remaining/native-python-official113.json')
assert py['pass']==2 and py['fail']==4 and sum(len(r['cycles'])for r in py['cases'])==6
assert all(r['history']=='PASS'for r in py['cases'])
assert len(read('portable-resource-generation.json')['files'])==225
resource=read('portable-resource-runtime.json')
assert resource['actualCompiledResource']==resource['expectedSourceResource']=='f2c925aa35f905d5145432a175ab13730d0626b1686a2f996dee5ce01a1f9ad4'
assert len(read('columns/result.json')['results'])==24 and not read('columns/result.json')['failures']
win=read('windows/result.json');assert win['passed']==10 and win['failed']==win['ignored']==0
assert read('bundle/result.json')['passed']==7
unit=gzip.decompress((ROOT/'checks/unit.log.gz').read_bytes()).decode('utf8')
assert re.search(r'# pass 1008\b',unit)and re.search(r'# fail 0\b',unit)and re.search(r'# skipped 0\b',unit)
native=gzip.decompress((ROOT/'native/selected18.log.gz').read_bytes()).decode('utf8')
assert re.findall(r'test result: ok\. (\d+) passed; 0 failed; 0 ignored',native)==['11','3','3','1']
assert not gzip.decompress((ROOT/'checks/typescript.log.gz').read_bytes())
assert json.loads(gzip.decompress((ROOT/'checks/boundaries.log.gz').read_bytes()))['ok']
assert b'Ran 12 tests'in gzip.decompress((ROOT/'checks/checklists12.log.gz').read_bytes())
print(f'PASS {len(manifest)} sealed records; official113 workflows387, Native-prefix32/160 exports, unit1008, Rust18, Windows10; Python4 failures remain explicit')
