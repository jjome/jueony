from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
manifest=json.loads((root/'SHA256-MANIFEST.json').read_bytes())
paths=set()
for item in manifest['files']:
 path=item['path'];assert path not in paths;paths.add(path)
 target=(root/path).resolve();assert target.is_relative_to(root.resolve())
 data=target.read_bytes();assert len(data)==item['bytes'] and sha(data)==item['sha256'],path
assert paths=={p.relative_to(root).as_posix()for p in root.rglob('*')if p.is_file()and p!=root/'SHA256-MANIFEST.json'}
read=lambda p:json.loads((root/p).read_bytes())
w=read('workflows/result.json');engine=read('engine-build.json')
assert w['engine']==engine and w['passedCases']==w['totalCases']==461 and not w['failures']
assert engine['sourceId']=='b20b9eb0ed097b92' and len(engine['patches'])==117
for suite in w['suites']:
 assert suite['status']=='PASS'and suite['scriptUnchanged']
 raw=(root/'workflows'/suite['name']/'result.json').read_bytes();r=json.loads(raw)
 assert sha(raw)==suite['resultSHA256'] and not r['failures'] and len(r['results'])==suite['expectedCases']
 for item in r['results']:
  if isinstance(item,dict):assert item['status']=='PASS'
l=read('legacy14/result.json');assert l['engine']==engine and len(l['results'])==14 and not l['failures'] and all(r['status']=='PASS'for r in l['results'])
assert read('windows/result.json')['passed']==11 and read('windows/result.json')['failed']==0
c=read('columns/result.json');assert len(c['results'])==24 and not c['failures']
assert read('bundle/result.json')['passed']==7 and read('bundle/result.json')['failed']==0
s=read('combined-summary.json');assert s['totalCases']==475 and s['failed']==0
assert s['frontendSourceSha256']==read('frontend-build.json')['customSourceSha256']
p=read('prepared-source-proof.json');assert p['unexpectedChanges']==[] and p['resourceFiles']==236
n=read('native25/proof/native-official117-result.json');assert n['engine']==engine and n['pass']==25 and n['fail']==n['ignored']==0
assert n['runtimeResourceHex']==p['resourceSha256'] and n['resourceSourceCount']==236
assert len(n['sourceByteWitnesses'])==6 and all(x['compiledIncludedBytesSha256']==x['runtimeDiskSha256']for x in n['sourceByteWitnesses'])
print('PASS: sealed files exact; official117 workflows461 + legacy14 =475; Windows11/columns24/bundle7.')
