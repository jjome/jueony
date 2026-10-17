from pathlib import Path
import json,hashlib
r=Path(__file__).resolve().parent
m=json.loads((r/'ROOT-SHA256-MANIFEST.json').read_bytes())
for row in m['files']:
 p=(r/row['path']).resolve();assert p.is_relative_to(r)
 b=p.read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],row['path']
print('PASS',len(m['files']),'root exact-SHA payloads; this is evidence integrity, not a new GUI run')
