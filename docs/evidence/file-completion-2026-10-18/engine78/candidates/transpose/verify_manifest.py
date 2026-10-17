from pathlib import Path
import json,hashlib
p=Path(__file__).resolve().parent
m=json.loads((p/'manifest-sha256.json').read_text(encoding='utf-8'))
for r in m['files']:
 b=(p/r['path']).read_bytes();assert len(b)==r['bytes'];assert hashlib.sha256(b).hexdigest()==r['sha256'],r['path']
print('PASS',len(m['files']),'compact transpose files')
