from pathlib import Path
import json,hashlib
r=Path(__file__).resolve().parent.parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
a=json.loads((r/'filehash-manifest.json').read_text(encoding='utf-8'))
b=json.loads((r/'second-filehash-manifest.json').read_text(encoding='utf-8'))
c=json.loads((r/'third-filehash-manifest.json').read_text(encoding='utf-8'))
assert sha(r/'filehash-manifest.json')==b['previousManifestSha256']==c['originalManifestSha256']
assert sha(r/'second-filehash-manifest.json')==c['secondManifestSha256']
items=a['files']+b['additionalFiles']+c['additionalFiles']
assert len({v['path'] for v in items})==len(items)
for v in items:
 p=r/v['path'];assert p.is_file() and p.stat().st_size==v['bytes'] and sha(p)==v['sha256'],v['path']
actual={p.relative_to(r).as_posix() for p in r.rglob('*') if p.is_file()}
assert actual=={v['path'] for v in items}|{'filehash-manifest.json','second-filehash-manifest.json','third-filehash-manifest.json'}
print('PASS',len(items),'payload files; original manifests unchanged; no missing or extra files')
