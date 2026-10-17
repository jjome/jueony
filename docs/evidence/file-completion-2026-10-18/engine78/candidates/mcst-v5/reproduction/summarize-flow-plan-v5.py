import pathlib,json,hashlib,difflib,collections
o=pathlib.Path('build/file-closure75-public-readonly');base=pathlib.Path('build/rhwp-engine/source-23d2545926a179a5');candidate=o/'metrics-plan-candidate76-v5'
sha=lambda b:hashlib.sha256(b).hexdigest()
changed=[];patch=[];same=0
for p in sorted((base/'src').rglob('*')):
 if not p.is_file():continue
 rel=p.relative_to(base);q=candidate/rel;a=p.read_bytes();b=q.read_bytes()
 if a==b:same+=1;continue
 changed.append({'path':rel.as_posix(),'baseSHA':sha(a),'candidateSHA':sha(b)})
 patch.extend(difflib.unified_diff(a.decode('utf-8').splitlines(True),b.decode('utf-8').splitlines(True),fromfile='a/'+rel.as_posix(),tofile='b/'+rel.as_posix()))
assert [p['path']for p in changed]==['src/renderer/typeset/paragraph.rs','src/renderer/typeset/section/vpos.rs','src/renderer/typeset.rs'] or set(p['path']for p in changed)=={'src/renderer/typeset/paragraph.rs','src/renderer/typeset/section/vpos.rs','src/renderer/typeset.rs'}
data=''.join(patch).replace('\r\n','\n').encode('utf-8');(o/'metrics-plan76-v5-final.patch').write_bytes(data)
proof={'base':str(base),'candidate':str(candidate),'srcFiles':same+len(changed),'unchangedFiles':same,'changed':changed,'patchSHA':sha(data),'parserSerializerMetricsUnchanged':all(not p['path'].startswith(('src/parser/','src/serializer/'))and'/metrics.rs'not in p['path']for p in changed)}
(o/'metrics-plan76-v5-final-source-proof.json').write_text(json.dumps(proof,indent=2),encoding='utf-8')
def diff(a,b,p='$',out=None):
 if out is None:out=[]
 if isinstance(a,bool)or isinstance(b,bool):
  if a!=b:out.append(p)
 elif isinstance(a,(int,float))and isinstance(b,(int,float)):
  if abs(a-b)>0.2:out.append(p)
 elif isinstance(a,dict)and isinstance(b,dict):
  for k in sorted(set(a)|set(b)):diff(a.get(k),b.get(k),p+'/'+k,out)
 elif isinstance(a,list)and isinstance(b,list):
  if len(a)!=len(b):out.append(p+'.length')
  for i in range(max(len(a),len(b))):diff(a[i]if i<len(a)else None,b[i]if i<len(b)else None,p+'/'+str(i),out)
 elif a!=b:out.append(p)
 return out
read=lambda name:json.loads((o/name).read_text(encoding='utf-8'))
actual=read('metrics-plan76-v5-actual-layout.json');converted=read('metrics-plan76-v5-converted-layout.json');delta=diff(converted,actual)
positions=[]
for page in actual:
 for r in page['text']['runs']:
  if r.get('paraIdx')in[55,56,57]and'cellIndex'not in r:positions.append({'displayPage':page['page']+1,'paragraph':r['paraIdx'],'charStart':r.get('charStart'),'y':r['y']})
boundary=[]
for mode in['inpage-rebuilt-owner','actual-dirty-predecessor']:
 d=read('formal76-boundary-'+mode+'.json');boundary.append({'mode':mode,'pages':d['pages'],'source':d['sourceSnapshot'],'rebuilt':d['rebuiltPositions'],'immediateDirtyFlag':d['dirtyOwner'],'modelSHA':d['modelSHA']})
summary={'scope':'MCST actual HWPX fit/paint consumption agreement, not all N002 completion','candidateType':'private Native only; no WASM or production promotion','sourceProof':proof,'actualInput':{'file':'build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx','sha256':sha(pathlib.Path('build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx').read_bytes()),'externalPageOracle':16},'actualPages':len(actual),'historicalConvertedPages':len(converted),'actualP55to57':positions,'publishedGeometryBetweenHistoricalConvertedAndActual':{'differences':len(delta),'notResolved':True,'pathCategories':dict(collections.Counter(p.rsplit('/',1)[-1]for p in delta))},'sameFormat':read('metrics-plan76-v5-hwpx-positive.json'),'actualEditHistory':read('metrics-plan76-v5-history.json'),'sourceOwnerExclusions':read('metrics-plan76-v5-exclusion-result.json'),'inPageAndApiEdit':read('metrics-plan76-v5-boundary-result.json'),'inPageContexts':boundary,'tests':{'nativeTests':16,'actualHancomPairs':11,'originalOwnerExclusions':9,'newInPageAndApiEditContrasts':2,'positiveAndHistory':2,'functionalScenarios':24,'fullGeometryReopens':92,'diagnosticFiles':3},'unchangedLimitations':['MCST HWP cross-format already rejects full published geometry on formal75; serializer v3/v4 rejected and not included','Remaining historical converted-vs-Hancom layout and metadata differences remain visible; neither global N002 nor exact complete document rendering is claimed','No global glyph-width correction, source cache deletion, raw page-break rewrite, geometry tolerance relaxation, or semantic normalization'],'history':['metrics76-private.patch is superseded because source/IR mismatch did not alone prove failed restoration','formal76-boundary-baseline-initial-flag-assumption-failed.log preserves incorrect harness expectation that API dirty flag survives synchronous reflow','candidate75-v1-strict-cycles.json','candidate75-v3-strict-cycles.json','candidate75-v4-strict-cycles.json']}
(o/'metrics-plan76-v5-handoff.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'changed':changed,'patchSHA':sha(data),'actualPages':len(actual),'remainingConvertedActual':len(delta)},ensure_ascii=False))
