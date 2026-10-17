from pathlib import Path
import json,hashlib
r=Path(__file__).resolve().parent
m=json.loads((r/'manifest.json').read_text(encoding='utf-8'))
for x in m['files']:
 b=(r/x['path']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'],x['path']
print('PASS',len(m['files']),'exact SHA256 payloads')
