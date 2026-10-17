from pathlib import Path
import hashlib,json
r=Path(__file__).resolve().parent
m=json.loads((r/'manifest.json').read_text(encoding='utf-8'))
for e in m['files']:
 p=r/e['path'];b=p.read_bytes()
 assert len(b)==e['bytes'] and hashlib.sha256(b).hexdigest()==e['sha256'],e['path']
print('PASS',len(m['files']),'exact SHA256 payloads')
