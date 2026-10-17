from pathlib import Path
import hashlib,json
b=Path(__file__).resolve().parent
m=json.loads((b/'manifest.json').read_text(encoding='utf-8'))
for e in m['files']:
 p=b/e['path'];assert p.stat().st_size==e['bytes'];assert hashlib.sha256(p.read_bytes()).hexdigest()==e['sha256'],e['path']
print('PASS',len(m['files']),'files')
