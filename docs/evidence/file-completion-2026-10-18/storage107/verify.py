from pathlib import Path
import gzip,hashlib,json,re
ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads((ROOT/p).read_bytes())
manifest=read('SHA256-MANIFEST.json')
actual={p.relative_to(ROOT).as_posix()for p in ROOT.rglob('*')if p.is_file()and p.name!='SHA256-MANIFEST.json'}
assert actual==set(manifest)
for name,record in manifest.items():
 p=(ROOT/name).resolve();assert p.is_relative_to(ROOT);raw=p.read_bytes()
 assert len(raw)==record['bytes']and sha(raw)==record['sha256'],name
engine=read('engine-build.json');front=read('frontend-build.json');w=read('workflows/result.json')
assert engine['sourceId']=='4f37a374a34409e1'and len(engine['patches'])==114
assert engine['wasmSha256']==front['engineWasmSha256']==w['engine']['wasmSha256']
assert w['passedCases']==w['totalCases']==387 and len(w['suites'])==30 and not w['failures']
for s in w['suites']:
 raw=(ROOT/'workflows'/s['name']/'result.json').read_bytes();r=json.loads(raw)
 assert sha(raw)==s['resultSHA256']and s['status']=='PASS'and s['scriptUnchanged']
 assert len(r['results'])==s['expectedCases']and not r['failures']
 if 'engine'in r:assert r['engine']['wasmSha256']==engine['wasmSha256']
before=read('before/initial-aggregate.json');assert before['passedCases']==377
assert w['reviewedRerun']['originalAggregateSha256']==sha((ROOT/'before/initial-aggregate.json').read_bytes())
assert w['reviewedRerun']['verifierUnchanged']is True
assert len([r for r in read('workflows/recovery-integrity/result.json')['observations']if r['kind']=='actual-browser-process-crash'])==2
combined=read('combined-summary.json');assert combined['totalCases']==424 and combined['failed']==0
for s in combined['additionalSuites']:
 raw=(ROOT/'additional'/s['name']/'result.json').read_bytes();r=json.loads(raw)
 assert sha(raw)==s['resultSha256']and r['verifierSha256']==s['verifierSha256']
 assert len(r['results'])==s['cases']and not r['failures']
 assert all(x['status']=='PASS'for x in r['results'])and r['engine']==engine
py=read('additional/python-edit-storage/result.json');assert py['passed']==30
assert sum(len(r['exports'])for r in py['results'])==150
for r in py['results']:
 assert r['originalHistory']==r['followupHistory']=='PASS'
 for e in r['exports']:assert e['guard']=='checked'and e['losses']==e['geometry']==e['semantic']==0
ui=read('additional/python-edit-ui/result.json');assert len(ui['observations'])==6
assert all(not ui[k]for k in ['pageErrors','consoleErrors','externalRequests'])
for r in ui['observations']:
 assert r['undoRedoExactLogical']and r['reopenedFollowUpSaved']
 for key in ['undoProof','redoProof']:assert r[key]['allLogicalBytesEqual']and r[key]['liveGeometryExact']and r[key]['textExact']
old=read('before/python30-baseline113.json');assert old['passed']==16 and len(old['failures'])==14
gen=read('portable-resource-generation.json');assert len(gen['files'])==230 and len(gen['addedInventoryPaths'])==5
run=read('portable-resource-runtime.json');assert run['actualCompiledResource']==gen['resourceSha256']=='a170bc946f0edfff0ad112d3b51bc25ecdf2803848f565a6d2464df3c3332955'
assert read('prepared-source-proof.json')['canonicalRuntimeMatchesMergedStage']
native=gzip.decompress((ROOT/'native/selected35.log.gz').read_bytes()).decode('utf8')
assert re.findall(r'test result: ok\. (\d+) passed; 0 failed; 0 ignored',native)==['11','12','3','8','1']
unit=gzip.decompress((ROOT/'checks/unit.log.gz').read_bytes()).decode('utf8')
assert re.search(r'# pass 1008\b',unit)and re.search(r'# fail 0\b',unit)and re.search(r'# skipped 0\b',unit)
assert not gzip.decompress((ROOT/'checks/typescript.log.gz').read_bytes())
assert b'Ran 12 tests'in gzip.decompress((ROOT/'checks/checklists12.log.gz').read_bytes())
win=read('windows/result.json');assert win['passed']==10 and win['failed']==win['ignored']==0
assert len(read('columns/result.json')['results'])==24 and read('bundle/result.json')['passed']==7
print(f'PASS {len(manifest)} sealed records; official114 workflows387+Python37, exports150, Rust35, unit1008; legacy-resource compatibility remains open')
