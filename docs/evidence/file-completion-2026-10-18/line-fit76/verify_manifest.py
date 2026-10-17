from pathlib import Path
import hashlib,json
p=Path(__file__).resolve().parent
m=json.loads((p/'manifest-sha256.json').read_text(encoding='utf-8'))
for f in m['files']:
 b=(p/f['path']).read_bytes()
 assert len(b)==f['bytes'], f['path']
 assert hashlib.sha256(b).hexdigest()==f['sha256'], f['path']
print('PASS',len(m['files']),'compact evidence files')
