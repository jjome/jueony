from pathlib import Path
import json,hashlib,gzip,re
ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda n:json.loads((ROOT/n).read_bytes())
m=read('SHA256-MANIFEST.json')
for n,r in m.items():
 p=(ROOT/n).resolve();assert p.is_relative_to(ROOT.resolve()),n
 raw=p.read_bytes();assert len(raw)==r['bytes'] and sha(raw)==r['sha256'],n
w=read('workflows/result.json');b=read('frontend-build.json')
assert w['passedCases']==w['totalCases']==328 and len(w['suites'])==26 and w['failures']==[]
assert w['engine']['sourceId']=='2feb978b45e2964e' and b['engineWasmSha256']==w['engine']['wasmSha256']
for s in w['suites']:
 raw=(ROOT/'workflows'/s['name']/'result.json').read_bytes();r=json.loads(raw)
 assert sha(raw)==s['resultSHA256'] and s['status']=='PASS' and s['scriptUnchanged']
 assert len(r['results'])==s['expectedCases'] and r['failures']==[]
 if 'engine' in r:assert r['engine']['wasmSha256']==w['engine']['wasmSha256']
assert len(read('workflows/document-history95/result.json')['results'])==20
assert len(read('before/cas-race.json')['failures'])==1
assert len(read('after/cas-race.json')['results'])==4 and read('after/cas-race.json')['failures']==[]
bundle=read('bundle/result.json');assert bundle['passed']==7 and bundle['failed']==0 and bundle['build']['customSourceSha256']==b['customSourceSha256']
u=gzip.decompress((ROOT/'checks/unit.log.gz').read_bytes()).decode('utf8')
assert re.search(r'# pass 1008\b',u) and re.search(r'# fail 0\b',u) and re.search(r'# skipped 0\b',u)
assert gzip.decompress((ROOT/'checks/typescript.log.gz').read_bytes())==b''
assert json.loads(gzip.decompress((ROOT/'checks/boundaries.log.gz').read_bytes()))['ok']
print(f'PASS {len(m)} raw records: same-engine workflows328, history20, unit1008, bundle7')
