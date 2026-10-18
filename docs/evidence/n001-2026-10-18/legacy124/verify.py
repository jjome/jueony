from pathlib import Path
import hashlib,json
r=Path(__file__).resolve().parent;m=json.loads((r/'SHA256-MANIFEST.json').read_bytes())
expected={v['path'] for v in m['files']};actual={p.relative_to(r).as_posix() for p in r.rglob('*') if p.is_file() and p.name!='SHA256-MANIFEST.json'}
assert actual==expected
for v in m['files']:
 b=(r/v['path']).read_bytes();assert len(b)==v['bytes'] and hashlib.sha256(b).hexdigest()==v['sha256'],v['path']
print('PASS',len(expected),'sealed evidence files')
