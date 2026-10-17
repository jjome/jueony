from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
for item in manifest['files']:
 p=(root/item['path']).resolve()
 assert p.is_relative_to(root) and p.is_file(),item['path']
 data=p.read_bytes()
 assert len(data)==item['bytes'] and hashlib.sha256(data).hexdigest()==item['sha256'],item['path']
print('PASS',len(manifest['files']),'files; exact SHA and size')
