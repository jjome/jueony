from pathlib import Path
import hashlib,json
r=Path(__file__).resolve().parent
m=json.loads((r/'SHA256-MANIFEST.json').read_bytes())
actual={p.relative_to(r).as_posix()for p in r.rglob('*')if p.is_file()and p.name!='SHA256-MANIFEST.json'}
assert actual=={x['path']for x in m['files']}
for x in m['files']:
 b=(r/x['path']).read_bytes();assert len(b)==x['bytes']and hashlib.sha256(b).hexdigest()==x['sha256'],x['path']
print('PASS',len(actual),'immutable evidence files')
