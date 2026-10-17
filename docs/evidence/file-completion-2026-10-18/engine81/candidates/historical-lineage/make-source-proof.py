from pathlib import Path
import hashlib, difflib, json

work=Path(__file__).resolve().parent
repo=work.parents[1]
base=repo/'build/rhwp-engine/source-20fddc2d172763e6'
candidate=work/'source-candidate80'
rel=Path('src/document_core/converters/hwpx_to_hwp.rs')
def sha(b): return hashlib.sha256(b).hexdigest()
old=(base/rel).read_text(encoding='utf-8')
new=(candidate/rel).read_text(encoding='utf-8')
patch='diff --git a/{0} b/{0}\n'.format(rel.as_posix())+''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/'+rel.as_posix(),tofile='b/'+rel.as_posix()))
path=work/'explicit-hwp5-origin-return80.patch'
path.write_text(patch,encoding='utf-8',newline='\n')
rows=[]
for p in sorted((base/'src').rglob('*.rs')):
    q=candidate/p.relative_to(base)
    rows.append({'path':p.relative_to(base).as_posix(),'before':sha(p.read_bytes()),'after':sha(q.read_bytes())})
changed=[r for r in rows if r['before']!=r['after']]
assert len(changed)==1 and changed[0]['path']==rel.as_posix(),changed
result={'formalSource':str(base),'candidateSource':str(candidate),'runtimeFiles':len(rows),'changed':changed,'patch':{'path':str(path),'sha256':sha(path.read_bytes())},'files':rows,'scope':'One converter marker-creation decision only. No source line/IR/layout/serializer/assertion changes. Existing provenance streams are never deleted.'}
(work/'candidate-source-proof.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='files'},indent=2))
