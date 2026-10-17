from pathlib import Path
import hashlib,json,re
ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def check(root,entry):
 p=(root/entry['path']).resolve()
 assert p.is_relative_to(root.resolve()),entry['path']
 b=p.read_bytes();assert len(b)==entry['bytes'],entry['path'];assert sha(b)==entry['sha256'],entry['path']
manifest=load(ROOT/'SHA256-MANIFEST.json')
for item in manifest['files']:check(ROOT,item)
actual={p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*') if p.is_file() and p.name!='SHA256-MANIFEST.json' and '__pycache__' not in p.parts}
assert actual=={f['path'] for f in manifest['files']}
old=load(ROOT/'parent-existing-payload.json');parent=ROOT.parent
assert sha((parent/'SHA256-MANIFEST.json').read_bytes())==old['parentManifestSha256']
for item in old['files']:check(parent,item)
original_manifest=load(parent/'SHA256-MANIFEST.json')
for item in original_manifest['files']:check(parent,item)
suites=load(ROOT/'original66/regressions-original.json')
assert len(suites)==44 and sum(x['exitCode']==0 for x in suites)==42
assert {x['category'] for x in suites if x['exitCode']!=0}=={'outer-native','width-browser'}
outer=load(ROOT/'original66/outer-native-original-result.json')
assert outer['engine']['sourceId']=='f146979ecedec189'
assert len(outer['failures'])==3 and len(outer['results'])==1
assert all('168.7 != 153.6' in f['error'] for f in outer['failures'])
width=load(ROOT/'original66/width-browser-original-result.json')
assert len(width['failures'])==1 and width['failures'][0]['name'].startswith('hwp: actual outer-margin')
assert any('표 높이 적용 후 저장 재열기의 표·본문 배치가 달라졌습니다' in str(x) for x in width['pageErrors'])
assert width['externalRequests']==[]
for name,n in [('native-live-fixed.log',3),('native-original10-regression.log',10)]:
 text=(ROOT/'native-followup'/name).read_text(encoding='utf-8-sig')
 assert re.search(r'test result: ok\. '+str(n)+r' passed; 0 failed; 0 ignored',text),name
summary=load(ROOT/'failure-and-followup-summary.json')
assert summary['status']=='FORMAL66_REJECTED_REGRESSION_EVIDENCE_NOT_COMPLETION'
assert summary['followupNative']['passed']==13 and summary['followupNative']['failed']==0
candidate=load(ROOT/'native-followup/candidate-validation.json')
assert candidate['formalBaseSourceId']=='f146979ecedec189' and not candidate['privateWasmBuilt']
assert sha((ROOT/'native-followup/owned-live-table-outer-origin-candidate.patch').read_bytes())==candidate['patch']['sha256']
proof=load(ROOT/'source-proof/official66-rust-baseline-original.json')
assert len(proof['rust'])==1132 and len({x['path'] for x in proof['rust']})==1132
lookup={x['path']:x['sha256'] for x in proof['rust']}
assert {x['path'] for x in candidate['changedRust']}=={'src/renderer/layout.rs','src/document_core/commands/document.rs'}
for item in candidate['changedRust']:assert lookup[item['path']]==item['old']
eof=load(ROOT/'source-proof/production-eof-only-change.json')
assert eof['candidatePatchSha256']==candidate['patch']['sha256']
assert sha((ROOT/'source-proof/production-followup-eof-trimmed.patch').read_bytes())==eof['productionPatchSha256']
assert eof['productionRendererMatchesCandidateExceptTrailingNewlines'] is True
assert eof['candidateTrailingNewlineCount']-eof['productionTrailingNewlineCount']==1
assert not any(Path(f['path']).suffix.lower() in ['.wasm','.exe','.ttf','.otf','.woff','.woff2'] for f in manifest['files'])
print(json.dumps({'status':'PASS','additiveFiles':len(manifest['files']),'originalParentFilesUnchanged':len(old['files']),'formal66RegressionGroups':{'passed':42,'failed':2},'originalOuterFailedCases':3,'browserPreservationRejectionRetained':True,'followupNativePassed':13,'formal68Outcome':'SEPARATE_NOT_ASSERTED'},ensure_ascii=False))
