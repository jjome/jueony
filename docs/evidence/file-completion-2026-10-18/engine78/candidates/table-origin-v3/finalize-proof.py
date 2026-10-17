from pathlib import Path
import hashlib,json,difflib
r=Path(__file__).resolve().parents[2];out=r/'build/table-origin-closure77';base=out/'source-baseline77';candidate=out/'source-candidate77'
sha=lambda b:hashlib.sha256(b).hexdigest()
files=[]
for p in sorted((base/'src').rglob('*')):
 if p.is_file():
  n=p.relative_to(base).as_posix();q=candidate/n;files.append({'path':n,'baselineSHA256':sha(p.read_bytes()),'candidateSHA256':sha(q.read_bytes())})
changed=[f for f in files if f['baselineSHA256']!=f['candidateSHA256']]
assert [f['path']for f in changed]==['src/renderer/typeset/table/block/entry.rs'],changed
n=changed[0]['path'];patch=''.join(difflib.unified_diff((base/n).read_text(encoding='utf-8').splitlines(True),(candidate/n).read_text(encoding='utf-8').splitlines(True),fromfile='a/'+n,tofile='b/'+n))
(out/'completed-breakable-frame77.patch').write_bytes(patch.encode())
proof={'base':'formal77 source-de849bf3aacef6f1 plus independently frozen caption two-file delta','runtimeFileCount':len(files),'unchangedRuntimeFiles':len(files)-len(changed),'newChanges':changed,'patchSHA256':sha(patch.encode()),'runtimeSourceManifestSHA256':sha(json.dumps(files,sort_keys=True,separators=(',',':')).encode()),'scope':'Whole emitted adjacent plain grid CellBreak/RowBreak frame; no PartialTable, nested control, rowspan, clipping protection, locked, ambiguous address, zero row height or explicit vertical-offset extension. No serialized or model fields changed. Actual Hancom absolute geometry remains separate oracle.'}
(out/'candidate-proof.json').write_text(json.dumps(proof,indent=2),encoding='utf-8')
(out/'runtime-manifest.json').write_text(json.dumps(files,indent=2),encoding='utf-8')
print(json.dumps(proof))
