from pathlib import Path
import hashlib,json
r=Path(__file__).resolve().parent
for name,row in json.loads((r/'SHA256-MANIFEST.json').read_bytes()).items():
 p=(r/name).resolve();assert p.is_relative_to(r.resolve())
 b=p.read_bytes();assert len(b)==row['bytes']and hashlib.sha256(b).hexdigest()==row['sha256'],name
print('Evidence manifest verified')
