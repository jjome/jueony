from pathlib import Path
import hashlib,json
r=Path(__file__).resolve().parent;m=json.loads((r/'manifest.json').read_text(encoding='utf8'))
for x in m['files']:
 b=(r/x['path']).read_bytes();assert len(b)==x['bytes'];assert hashlib.sha256(b).hexdigest()==x['sha256'],x['path']
print(f"Verified {len(m['files'])} payloads")
