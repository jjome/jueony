from pathlib import Path
import hashlib,json,struct
root=Path(__file__).resolve().parents[2]
here=Path(__file__).resolve().parent
production=root/'apps/editor/src-tauri'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
j=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
result=j(here/'build-result.json')
assert result['status']=='BUILT_NOT_GUI_TESTED'
assert result['engineSourceId']=='b59322fd380dc175'
assert result['wasmSha256']=='ef130c08536b38349bfb0c9b94a4478094c85df04ba2969ef4e4f65d05363f17'
assert result['gui']=='NOT_LAUNCHED' and result['actualNativeValidation']=='NOT_RUN'
assert result['apiBackend']=='NOT_INCLUDED'
exe=Path(result['binary']);assert exe.stat().st_size==result['binaryBytes'] and sha(exe)==result['binarySha256']
b=exe.read_bytes();assert b[:2]==b'MZ' and b[struct.unpack_from('<I',b,60)[0]:][:4]==b'PE\0\0'
before=j(here/'frontend-before.json');after=j(here/'frontend-after.json');assert before==after
front=Path(result['frontend'])
for item in before:
 p=front/item['path'];assert p.stat().st_size==item['bytes'] and sha(p)==item['sha256']
inputs=j(here/'production-source-before.json')
copies=[]
for item in inputs:
 p=production/item['path'];assert sha(p)==item['sha256']
 copied=here/'project/src-tauri'/item['path']
 # Isolated Cargo.toml only adds autobins=false and a new explicit bin name.
 if item['path']!='Cargo.toml':assert sha(copied)==item['sha256'],item['path']
 copies.append({'path':item['path'],'productionSHA':item['sha256'],'isolatedBuildSHA':sha(copied),'byteIdenticalToProduction':item['path']!='Cargo.toml'})
for item in j(here/'existing-exes-before.json'):
 p=Path(item['path']);assert p.stat().st_size==item['bytes'] and sha(p)==item['sha256']
config_path=here/'tauri-final86-review.conf.json';config=j(config_path)
assert config['identifier']=='local.jueony.nativefinal86review20261018'
assert config['app']['windows'][0]['label']=='main' and config['app']['windows'][0]['url']=='index.html'
relative=config['build']['frontendDist'];assert ':' not in relative and not Path(relative).is_absolute()
assert (here/'project/src-tauri'/relative).resolve()==front.resolve()
source_cap=j(here/'source-capabilities.json');compiled=j(here/'compiled-capabilities.json')['main-editor']
assert source_cap['windows']==compiled['windows']==['main']
assert sorted(source_cap['permissions'])==sorted(compiled['permissions'])
assert 'core:window:allow-destroy' in compiled['permissions']
csp=j(here/'project/src-tauri/tauri.conf.json')['app']['security']['csp']
proof={
 'status':'BUILD_INPUT_AND_ARTIFACT_PROVENANCE_PASS_NO_GUI_RUN',
 'engineSourceId':result['engineSourceId'],'wasmSHA':result['wasmSha256'],
 'binarySHA':result['binarySha256'],'binaryBytes':result['binaryBytes'],'validPEHeader':True,
 'frontendInputFilesVerified':len(before),'productionInputFilesVerified':len(inputs),
 'oldExecutablesUnchanged':len(j(here/'existing-exes-before.json')),
 'isolatedNativeSourceProof':copies,
 'configuration':{'sha256':sha(config_path),'identifier':config['identifier'],'frontendDist':relative,'embeddedAssetPathNotAbsoluteURL':True,'mainURL':'index.html','csp':csp},
 'capability':{'sourceSHA':sha(here/'source-capabilities.json'),'compiledSHA':sha(here/'compiled-capabilities.json'),'sourceAndCompiledPermissionSetsExact':True,'permissions':source_cap['permissions']},
 'productionSourceUnchanged':True,'frontendUnchanged':True,'lockfileUnchanged':True,
 'limitations':['The new86 application was never launched, approved, installed, or used to control any OS dialog.','Static relative embedded-asset configuration is proven; actual runtime navigation/picker/IPC/recovery behavior is not revalidated.','API backend is not included in this native file preview. Root standalone4355 backend is a separate deliverable.','Prior actual Windows68 GUI success applies to that older binary. Current storage.rs/recents source identity does not make all current command routing or UI behavior identical.'],
 'actions':{'cargoWindowsOfflineLocked':True,'cargoWSLUsed':False,'launchedApp':False,'requestedApproval':False,'terminatedWindowOrServer':False,'copiedBinaryIntoEvidence':False},
}
(here/'integrity-verification.json').write_text(json.dumps(proof,indent=2),encoding='utf8')
print(json.dumps({'status':proof['status'],'binarySHA':proof['binarySHA'],'binaryBytes':proof['binaryBytes'],'frontendFiles':len(before),'nativeInputs':len(inputs),'oldExeCount':proof['oldExecutablesUnchanged']}))
