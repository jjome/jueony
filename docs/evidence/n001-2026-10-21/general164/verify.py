from pathlib import Path
import json,hashlib,gzip
r=Path(__file__).resolve().parent
rows=json.loads((r/'SHA256-MANIFEST.json').read_bytes())
for e in rows:
 b=(r/e['path']).read_bytes();assert hashlib.sha256(b).hexdigest()==e['sha256'],e['path']
 if 'rawSha256'in e:assert hashlib.sha256(gzip.decompress(b)).hexdigest()==e['rawSha256'],e['path']
print('PASS',len(rows),'frozen artifacts')
