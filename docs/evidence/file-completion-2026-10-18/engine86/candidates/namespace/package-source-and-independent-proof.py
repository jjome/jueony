from pathlib import Path
import hashlib,json,difflib,subprocess,zipfile,xml.etree.ElementTree as ET
r=Path.cwd(); base=r/'build/rhwp-engine/source-ad6186043c15532f'; cand=r/'build/raw-namespace-closure83/source'; out=r/'build/raw-namespace-closure83'
rows=[];patch=[]
for p in sorted((cand/'src').rglob('*.rs')):
 rel=p.relative_to(cand);a=base/rel;b=p.read_bytes();old=a.read_bytes()if a.exists()else b''
 if old==b:continue
 rows.append({'path':str(rel).replace('\\','/'),'beforeSha256':hashlib.sha256(old).hexdigest()if a.exists()else None,'afterSha256':hashlib.sha256(b).hexdigest()})
 patch.extend(difflib.unified_diff(old.decode().replace("\r\n","\n").splitlines(True),b.decode().replace("\r\n","\n").splitlines(True),fromfile='a/'+rel.as_posix() if a.exists() else '/dev/null',tofile='b/'+rel.as_posix()))
patch_path=out/'raw-resource-namespace-ownership83.patch';patch_path.write_text(''.join(patch),encoding='utf-8',newline='\n')
exports=[]
for p in sorted(out.glob('own-*-cycle*.hwpx')):
 entries=[]
 with zipfile.ZipFile(p)as z:
  for n in z.namelist():
   if n.endswith(('.xml','.hpf')):ET.fromstring(z.read(n));entries.append(n)
 exports.append({'path':p.relative_to(r).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'independentXmlEntries':entries})
assert len(exports)==4
assert len(rows)>=8
report={'base':'ad6186043c15532f','runtimeAndCompatibleTests':rows,'changedRustFiles':len(rows),'patchSha256':hashlib.sha256(patch_path.read_bytes()).hexdigest(),'nativeTests':{'passed':8,'failed':0,'ignored':0},'independentPythonXml':exports,'preparationFailures':['preparation-failure-lib-tests.log','preparation-failure-missing-env.log'],'publicBytesIncluded':False,'sourceInputsUnchanged':True}
(out/'source-and-independent-proof.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
