from pathlib import Path
import json, hashlib, re, shutil

work=Path(__file__).resolve().parent
def read(name): return json.loads((work/name).read_text(encoding='utf-8-sig'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def tests(name,expected):
    text=(work/name).read_text(encoding='utf-8')
    assert re.search(rf'test result: ok\. {expected} passed; 0 failed; 0 ignored;',text),name
    return {'log':name,'sha256':sha(work/name),'actualTests':expected,'failed':0,'ignored':0}
native=tests('native-candidate-v2.log',3)
actual=tests('native-actual11-v2.log',11)
baseline=tests('native-baseline-boundaries.log',1)
current=read('candidate-v2/provenance-boundaries.json')['cases']
prior=read('baseline80/provenance-boundaries.json')['cases']
assert len(prior)==len(current)==17
unchanged=[]
for a,b in zip(prior,current):
    assert a['case']==b['case']
    if a['case']=='exact-owner':
        assert a['markerPresent'] and not b['markerPresent']
        assert a['sourceIRSHA']==b['sourceIRSHA'] and a['auxSHA']==b['auxSHA']
    else:
        assert a==b,(a,b)
        unchanged.append(a['case'])
proof=read('candidate-source-proof.json')
causal=read('profile-only-result.json')
assert causal['normal']['geometryCount']==125 and causal['counterfactual']['geometryCount']==0
assert causal['counterfactual']['semanticCount']==0 and causal['counterfactualProof']['allLogicalStreamPayloadsExact']
summary={
 'status':'NATIVE_CANDIDATE_VERIFIED_NOT_FORMAL_WASM',
 'formalBase':proof['formalSource'],'candidateSource':proof['candidateSource'],
 'patch':proof['patch'],'changedRuntimeFiles':proof['changed'],'runtimeFiles':proof['runtimeFiles'],
 'nativeTests':[native,actual,baseline],
 'strictReopens':{'historicalClean':4,'realEditSnapshotUndoRedo':4,'actual11BothSourcesBothFormatsTwice':88,'total':96},
 'independentReadOnlyCausality':{'normalGeometry':125,'counterfactualGeometry':0,'semantic':0,'onlyDirectoryNameByteChanged':True,'streamPayloadsExact':True,'evidence':'profile-only-result.json'},
 'boundaryCases':17,'unchangedBaselineExclusions':unchanged,
 'historicalPages':15,'publishedGeometryTolerance':0.2,'metadata5Preserved':True,
 'sourceLSOrParagraphMutation':False,'existingMarkerRemovalOrRewrite':False,
 'initialFailure':'failed-v1/native-candidate-v1.log',
 'initialFailureReason':'Overly strict empty-stream premise rejected actual parser-owned six standard contract streams; expected geometry and page count were unchanged.',
 'limitations':['Native candidate only; formal combined WASM and actual production preservation guard still require execution.',
 'Fifteen-page historical source same-engine preservation is distinct from actual Hancom sixteen-page pagination.',
 'Actual MCST HWPX crossing and font-family ownership are other independent candidates; not claimed fixed here.',
 'Legacy/unknown/duplicate origin payloads, HWP3/HML, opaque or duplicate extra streams, and pre-existing HWPX lineage are outside this new origin-creation suppression. Existing behavior/payloads remain unchanged.'],
 'publicSourceFilesWritten':False,'fullPublicSnapshotsWritten':False,
}
(work/'handoff-native-v2.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
stage=work/'compact-staging'
stage.mkdir(exist_ok=False)
for name in ['handoff-native-v2.json','candidate-source-proof.json','explicit-hwp5-origin-return80.patch',
 'profile-only-result.json','probe-profile-only.mjs','prepare-candidate.py','prepare-baseline.py',
 'refine-contract-streams-v2.py','make-source-proof.py','finalize-handoff.py','run-candidate-v2.sh',
 'run-baseline-boundaries.sh','native-candidate-v2.log','native-actual11-v2.log','native-baseline-boundaries.log']:
    shutil.copy2(work/name,stage/name)
for rel in ['candidate-v2','baseline80','failed-v1']:
    shutil.copytree(work/rel,stage/rel)
for name in ['jueony_historical_origin.rs','jueony_actual11.rs']:
    shutil.copy2(work/'source-candidate80/tests'/name,stage/name)
files=[{'path':p.relative_to(stage).as_posix(),'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(stage.rglob('*')) if p.is_file()]
(stage/'manifest.json').write_text(json.dumps({'files':files,'scope':'Code, hashes, numeric/hashed diagnostics only. No public documents, full public snapshots, fonts, libraries, binaries or WASM.'},indent=2),encoding='utf-8')
print(json.dumps({'handoff':str(work/'handoff-native-v2.json'),'patch':proof['patch'],'files':len(files)},indent=2))
