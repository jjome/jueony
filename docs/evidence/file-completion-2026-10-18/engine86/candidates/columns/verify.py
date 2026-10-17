from pathlib import Path
import hashlib,json
p=Path(__file__).resolve().parent
m=json.loads((p/'manifest.json').read_text(encoding='utf8'))
for x in m['files']:
 b=(p/x['path']).read_bytes()
 assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'],x['path']
print('PASS',len(m['files']),'exact payload SHA256')
