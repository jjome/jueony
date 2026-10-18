from pathlib import Path
import gzip,hashlib,json,re
ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda n:json.loads((ROOT/n).read_bytes())
m=read('SHA256-MANIFEST.json')
for n,r in m.items():
 p=(ROOT/n).resolve();assert p.is_relative_to(ROOT.resolve()),n
 b=p.read_bytes();assert len(b)==r['bytes'] and sha(b)==r['sha256'],n
engine=read('engine-build.json');w=read('workflows/result.json')
assert engine['sourceId']=='2feb978b45e2964e' and len(engine['patches'])==107
assert read('frontend-build.json')['engineWasmSha256']==engine['wasmSha256']
assert w['passedCases']==w['totalCases']==324 and len(w['suites'])==26 and w['failures']==[]
for s in w['suites']:
 raw=(ROOT/'workflows'/s['name']/'result.json').read_bytes();r=json.loads(raw)
 assert sha(raw)==s['resultSHA256'] and len(r['results'])==s['expectedCases'] and r['failures']==[]
 assert s['status']=='PASS' and s['scriptUnchanged']
 if 'engine' in r:assert r['engine']['wasmSha256']==engine['wasmSha256']
c=read('columns/result.json');assert len(c['results'])==24 and c['failures']==[]
assert c['candidate']['wasmSha256']==engine['wasmSha256']
d=read('columns/independent-28.json');assert len(d['results'])==d['passed']==d['total']==28 and all(x['status']=='PASS' for x in d['results'])
w=read('windows/result.json');assert w['passed']==10 and w['failed']==w['ignored']==0 and w['status']=='PASS'
assert w['engine']['wasmSha256']==engine['wasmSha256']
b=read('bundle/result.json');assert b['passed']==7 and b['failed']==0 and b['build']['engineWasmSha256']==engine['wasmSha256']
u=gzip.decompress((ROOT/'checks/unit96.log.gz').read_bytes()).decode('utf8')
assert re.search(r'# pass 1008\b',u) and re.search(r'# fail 0\b',u) and re.search(r'# skipped 0\b',u)
assert gzip.decompress((ROOT/'checks/typescript96.log.gz').read_bytes())==b''
assert json.loads(gzip.decompress((ROOT/'checks/boundaries96.log.gz').read_bytes()))['ok']
samples=read('samples/index.json');assert len(samples)==24
for r in samples:assert sha((ROOT/'samples'/r['name']).read_bytes())==r['sha256']
print(f'PASS: {len(m)} byte records; official107 workflows324, unit1008, columns24, independent dates28, Windows10, bundle7, saved samples24')
