from pathlib import Path
import hashlib,json
r=Path(__file__).resolve().parent;sha=lambda b:hashlib.sha256(b).hexdigest();read=lambda p:json.loads((r/p).read_bytes())
manifest=read('SHA256-MANIFEST.json');paths=set()
for x in manifest['files']:
 p=(r/x['path']).resolve();assert p.is_relative_to(r.resolve()) and x['path']not in paths;paths.add(x['path']);b=p.read_bytes();assert len(b)==x['bytes']and sha(b)==x['sha256'],x['path']
assert paths=={p.relative_to(r).as_posix()for p in r.rglob('*')if p.is_file()and p!=r/'SHA256-MANIFEST.json'}
engine=read('engine-build.json');w=read('workflows/result.json');assert w['engine']==engine and w['passedCases']==w['totalCases']==461 and not w['failures']
assert engine['sourceId']=='b443fe8f896f3e7b'and len(engine['patches'])==118
for s in w['suites']:
 raw=(r/'workflows'/s['name']/'result.json').read_bytes();v=json.loads(raw)
 assert s['status']=='PASS'and s['scriptUnchanged']and sha(raw)==s['resultSHA256']and not v['failures']and len(v['results'])==s['expectedCases']
for name,n in [('legacy14',14),('typed-time14',14),('created12',12)]:
 v=read(name+'/result.json');assert v['engine']==engine and len(v['results'])==n and not v['failures']and all(x['status']=='PASS'for x in v['results'])
c=read('created12/result.json');assert not c['pageErrors']and not c['consoleErrors']and not c['externalRequests']
n=read('native8/official-proof.json');assert not n['sourceMutation']and n['sourceId']==engine['sourceId']and n['native']['result']=={'regressions':7,'compiledSourceWitnessTests':1,'totalPassed':8,'failed':0,'ignored':0}
assert read('windows/result.json')['passed']==11 and read('bundle/result.json')['passed']==7 and len(read('columns/result.json')['results'])==24
s=read('combined-summary.json');assert s['totalCases']==501 and s['failed']==0 and s['frontendSourceSha256']==read('frontend-build.json')['customSourceSha256']
p=read('prepared-source-proof.json');assert p['resourceFiles']==236 and not p['unexpectedChanges']and p['unchangedOtherRust']==1076
print('PASS: sealed files exact, official118 461+14+14+12=501; Native7+witness1/Windows11/columns24/bundle7.')
