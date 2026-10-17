from pathlib import Path
import argparse,json,hashlib,zipfile
ap=argparse.ArgumentParser(description='Verify or refresh this self-authored evidence bundle manifest; excludes manifest itself.')
ap.add_argument('--write',action='store_true');a=ap.parse_args();root=Path(__file__).resolve().parent.parent;manifest=root/'filehash-manifest.json';sha=lambda b:hashlib.sha256(b).hexdigest();files=[]
for p in sorted(root.rglob('*')):
 if not p.is_file()or p==manifest:continue
 assert p.suffix.lower()not in['.exe','.dll','.pdb','.wasm','.ttf','.otf','.woff','.woff2'],p
 if p.suffix.lower()=='.hwpx':
  with zipfile.ZipFile(p)as z:assert not any(Path(n).suffix.lower()in['.ttf','.otf','.woff','.woff2']for n in z.namelist()),p
 files.append({'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())})
value={'algorithm':'SHA256','excludedSelf':'filehash-manifest.json','policy':'Self-authored evidence only; no public derivatives, full semantic/layout snapshots, font files, compiled executable or WASM package.','files':files,'fileCount':len(files),'totalBytes':sum(f['bytes']for f in files)}
if a.write:manifest.write_text(json.dumps(value,indent=2),encoding='utf-8')
else:assert json.loads(manifest.read_text(encoding='utf-8'))==value,'manifest mismatch or unexpected/missing file'
print(('Wrote'if a.write else'Verified')+' manifest: '+str(len(files))+' files, '+str(value['totalBytes'])+' bytes')
