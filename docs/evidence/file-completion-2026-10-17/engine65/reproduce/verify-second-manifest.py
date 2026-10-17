from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parent.parent;sha=lambda b:hashlib.sha256(b).hexdigest();old=root/'filehash-manifest.json';delta=root/'second-filehash-manifest.json';j=json.loads(delta.read_text(encoding='utf-8'));assert sha(old.read_bytes())==j['previousManifestSha256'];before=json.loads(old.read_text(encoding='utf-8'));assert before['fileCount']==j['previousFileCount'];items=before['files']+j['additionalFiles'];assert len({x['path']for x in items})==len(items)
for f in items:
 p=root/f['path'];assert p.is_file()and p.stat().st_size==f['bytes']and sha(p.read_bytes())==f['sha256'],f['path']
actual={p.relative_to(root).as_posix()for p in root.rglob('*')if p.is_file()};expected={f['path']for f in items}|{'filehash-manifest.json','second-filehash-manifest.json'};assert actual==expected,(actual-expected,expected-actual)
print('Verified unchanged original'+str(before['fileCount'])+' + additive'+str(len(j['additionalFiles']))+' payload files; no missing/extra files.')
