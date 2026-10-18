from pathlib import Path
import hashlib,json
r=Path(__file__).resolve().parent
m=json.loads((r/'ROOT-SHA256-MANIFEST.json').read_text(encoding='utf-8'))
for name,row in m.items():
 p=(r/name).resolve();assert p.is_relative_to(r.resolve())
 b=p.read_bytes();assert len(b)==row['bytes']and hashlib.sha256(b).hexdigest()==row['sha256'],name
print('Verified',len(m),'payloads')
