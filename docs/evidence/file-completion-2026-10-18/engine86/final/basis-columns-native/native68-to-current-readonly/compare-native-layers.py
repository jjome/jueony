from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[2]
out=root/'build/native68-to-final85-readonly'
old=root/'build/native-file-final68-20261017'
old_source=old/'project/src-tauri'
current=root/'apps/editor/src-tauri'
sha=lambda b:hashlib.sha256(b).hexdigest()
def record(p):
 return {'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}
recorded=json.loads((old/'production-source-before.json').read_text(encoding='utf8'))
runtime=[]
for x in recorded:
 p=current/x['path'];historical=old_source/x['path']
 runtime.append({'relative':x['path'],'recordedProduction68SHA':x['sha256'],'isolatedBuildInput68':record(historical) if historical.exists() else None,'current85':record(p) if p.exists() else None,'productionByteIdentical':p.exists() and sha(p.read_bytes())==x['sha256'],'isolatedBuildInputMatchesRecordedProduction':historical.exists() and sha(historical.read_bytes())==x['sha256']})
new_rust=[record(current/rel) for rel in ['src/file_bindings.rs','src/document_windows.rs']]
build=json.loads((old/'build-result.json').read_text(encoding='utf8'))
frontend=root/'apps/editor/evidence/dist-file-lifecycle-verified68'
old_meta=json.loads((frontend/'build-evidence.json').read_text(encoding='utf8'))
frontend_manifest=json.loads((old/'frontend-before.json').read_text(encoding='utf8'))
frontend_checks=[]
for item in frontend_manifest:
 f=frontend/item['path'];frontend_checks.append({'path':item['path'],'matches':f.exists() and f.stat().st_size==item['bytes'] and sha(f.read_bytes())==item['sha256']})
ts_files=[
 'apps/editor/src/adapters/desktop/native-host.ts',
 'apps/editor/src/adapters/desktop/document-lifecycle.ts',
 'apps/editor/src/adapters/desktop/document-windows.ts',
 'apps/editor/src/adapters/desktop/native-recents.ts',
 'apps/editor/src/adapters/desktop/exit-save-frame.ts',
 'apps/editor/src/adapters/desktop/agent-files.ts',
 'apps/editor/src/adapters/files/file-connection.ts',
 'apps/editor/src/adapters/files/save-runtime.ts',
 'apps/editor/src/adapters/files/download-save.ts',
 'apps/editor/src/adapters/storage/indexeddb-workspace.ts',
 'apps/editor/src/adapters/storage/serialized-writer.ts',
 'apps/editor/src/modules/document-files/application/write-snapshot.ts',
 'apps/editor/src/modules/document-files/application/export-recovery.ts',
 'apps/editor/src/adapters/rhwp/preservation.ts',
 'apps/editor/src/adapters/rhwp/document-save-layout.ts',
 'apps/editor/src/adapters/rhwp/save-table-frames.ts',
]
typescript=[]
for relative in ts_files:
 f=root/relative
 if not f.exists():continue
 g=subprocess.run(['git','show',old_meta['applicationSourceCommit']+':'+relative],cwd=root,capture_output=True)
 typescript.append({'current':record(f),'recorded68CommitBlobExists':g.returncode==0,'recorded68CommitBlobSHA':sha(g.stdout) if g.returncode==0 else None,'currentEqualsRecorded68CommitBlob':g.returncode==0 and f.read_bytes()==g.stdout,'actual68BuildFileIdentity':'UNPROVEN: old frontend records applicationSourceDirty=true and only an aggregate customSourceSha256; commit blob equality does not prove the dirty built TS input.'})
actual=root/'build/native-final68-actual-review'
actual_files=[record(p) for p in sorted(actual.iterdir()) if p.is_file()]
exe=Path(build['binary'])
binary=record(exe);assert binary['sha256']==build['binarySha256']
assert all(x['matches'] for x in frontend_checks)
summary={
 'status':'READ_ONLY_LAYERED_PROVENANCE_NOT_CURRENT_GUI_VALIDATION',
 'actualOS68EvidenceReference':'docs/109-file-preservation-hancom-followup.md:18-19; OS-owned picker HWP open/edit/CtrlS + dirty cancel/recovery exit/restart/SaveAs. This script did not execute these UI actions.',
 'native68Build':{'resultSHA':sha((old/'build-result.json').read_bytes()),'binary':binary,'binaryMatchesBuildManifest':True,'engineSource':build['engineSourceId'],'wasmSHA':build['wasmSha256'],'initialBuildReportWasNotGUIValidation':build['status'],'laterActualUIFiles':actual_files},
 'immutable68Frontend':{'fileCount':len(frontend_checks),'allChecksMatch':True,'manifestSHA':sha((old/'frontend-before.json').read_bytes()),'applicationSourceCommit':old_meta['applicationSourceCommit'],'applicationSourceDirty':old_meta['applicationSourceDirty'],'customSourceSHA':old_meta['customSourceSha256']},
 'rustInputs':runtime,
 'newCurrentRustFiles':new_rust,
 'typescriptInputs':typescript,
 'provenUnchangedScopes':[
  'src/storage.rs entire bytes identical: atomic disk read/write, bound fingerprint conflict checking and safe replacement implementation are the same source as68.',
  'src/native_recents.rs entire bytes identical: recent store serialization/reopen verification implementation is the same source as68.',
 ],
 'changedOrUnprovenScopes':[
  'main.rs command routing changed: global token HashMap in68 became window/context-scoped FileBindings; old get_webview_window(main) picker owner became invoking WebviewWindow. Whole command/permission/service behavior is not byte-identical.',
  'file_bindings.rs and document_windows.rs are additional current source not present in the recorded68 build.',
  'Capabilities/config/Cargo changes are reported per file and must not be inferred unchanged from storage.rs identity.',
  'TS frontend per-file build identity is unproven because68 had dirty source and only aggregate source hash. Old commit equality is reported separately and is not promoted into actual build identity.',
  'Engine85 and planned86 have different WASM and frontend code from68. Prior OS68 run cannot prove latest renderer, preservation guard, recovery, native window routing or actual Windows picker behavior.'
 ],
 'operations':{'launchedApp':False,'clickedDialog':False,'ranCargo':False,'modifiedProduction':False,'modifiedOldBuild':False,'publicDocumentBytesCopied':False},
}
(out/'result.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'identicalRecordedRustConfigFiles':[x['relative'] for x in runtime if x['productionByteIdentical']],'changedRecordedRustConfigFiles':[x['relative'] for x in runtime if not x['productionByteIdentical']],'newRustFiles':len(new_rust),'typescriptAudited':len(typescript),'immutableFrontendChecks':len(frontend_checks),'currentGuiValidated':False},ensure_ascii=False))
