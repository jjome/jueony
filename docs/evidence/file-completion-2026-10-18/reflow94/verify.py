from pathlib import Path
import gzip,hashlib,json,re

ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads((ROOT/p).read_bytes())
manifest=read('SHA256-MANIFEST.json')
for name,row in manifest.items():
    p=(ROOT/name).resolve();assert p.is_relative_to(ROOT.resolve()),name
    b=p.read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'],name
engine=read('engine-build.json');workflow=read('workflows/result.json')
assert engine['sourceId']=='7c10dba04ed65742' and len(engine['patches'])==102
assert workflow['passedCases']==workflow['totalCases']==242 and workflow['failures']==[]
assert workflow['engine']['wasmSha256']==engine['wasmSha256']
assert read('frontend-build.json')['engineWasmSha256']==engine['wasmSha256']
assert len(workflow['suites'])==19
for s in workflow['suites']:
    p=ROOT/'workflows'/s['name']/'result.json'
    assert sha(p.read_bytes())==s['resultSHA256'] and s['status']=='PASS' and s['scriptUnchanged']
    r=json.loads(p.read_bytes());assert len(r['results'])==s['expectedCases'] and r['failures']==[]
    if 'engine' in r:assert r['engine']['wasmSha256']==engine['wasmSha256']
for name,count in [('columns/result.json',24)]:
    r=read(name);assert len(r['results'])==count and r['failures']==[]
w=read('windows/result.json');assert w['status']=='PASS' and w['passed']==10 and w['failed']==w['ignored']==0
assert w['engine']['wasmSha256']==engine['wasmSha256']
b=read('bundle/result.json');assert b['passed']==7 and b['failed']==0 and b['build']['engineWasmSha256']==engine['wasmSha256']
unit=gzip.decompress((ROOT/'checks/unit94.log.gz').read_bytes()).decode('utf-8')
assert re.search(r'# pass 970\b',unit) and re.search(r'# fail 0\b',unit) and re.search(r'# skipped 0\b',unit)
assert gzip.decompress((ROOT/'checks/typescript94.log.gz').read_bytes())==b''
assert json.loads(gzip.decompress((ROOT/'checks/boundaries94.log.gz').read_bytes()))['ok']
samples=read('samples/index.json');assert len(samples)==24
for f in samples:assert sha((ROOT/'samples'/f['name']).read_bytes())==f['sha256']
print(f'PASS: {len(manifest)} byte records, same-build 242, unit970, columns24, Windows10, bundle7 and saved samples24')
