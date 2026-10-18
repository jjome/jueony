from pathlib import Path
import hashlib,json
r=Path(__file__).resolve().parent
rows=json.loads((r/'SHA256-MANIFEST.json').read_bytes())
for v in rows:
 b=(r/v['path']).read_bytes();assert len(b)==v['bytes'] and hashlib.sha256(b).hexdigest()==v['sha256'],v['path']
assert {p.relative_to(r).as_posix() for p in r.rglob('*') if p.is_file()}=={v['path'] for v in rows}|{'SHA256-MANIFEST.json'}
print('PASS',len(rows),'files',sum(v['bytes'] for v in rows),'bytes')
