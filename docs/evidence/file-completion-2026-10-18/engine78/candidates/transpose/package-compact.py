from pathlib import Path
import hashlib,json,shutil

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'build/transpose-closure77'
OUT=BASE/'compact-transpose77'
OUT.mkdir(exist_ok=True)
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def copy(path,name=None):
    target=OUT/(name or path.name);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(path,target)
def dump(name,value):
    target=OUT/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

for name in ['transpose-row-measurement-owner-delta-formal77.patch','candidate-source-proof.json','handoff.json',
             'native-tests-final.rs','run-native.sh','native-baseline.log','native-baseline-valid.log',
             'native-baseline-fixtures-ready.log','native-candidate-first.log','native-candidate-history-and-trace.log',
             'package-compact.py']:
    copy(BASE/name)
for suffix in ['hwp','hwpx']:
    copy(ROOT/f'build/document-save-transpose77/properties.{suffix}',f'fixtures/properties.{suffix}')
    copy(ROOT/f'build/document-save-transpose77/transpose.{suffix}',f'fixtures/historical-transpose-export.{suffix}')
    copy(BASE/f'candidate-fresh-merged-{suffix}.json',f'candidate-readback/fresh-merged-{suffix}.json')
    copy(BASE/f'candidate-snapshot-redo-{suffix}.json',f'candidate-readback/snapshot-redo-{suffix}.json')
copy(BASE/'table-y-readonly-trace.json','separate-unresolved/table-y-readonly-trace.json')

records=[]
for mode in ['baseline','candidate']:
    for path in sorted(BASE.glob(mode+'-*.json')):
        if path.name=='candidate-source-proof.json':continue
        value=json.loads(path.read_text(encoding='utf-8'))
        if 'differences' not in value:continue
        records.append({'name':path.name,'originalSha256':sha(path),'originalBytes':path.stat().st_size,
                        'differences':value['differences']})
dump('all-native-layout-results.json',records)
dump('preparation-tool-output-excerpts.json',{
    'scope':'Original terminal excerpt retained separately from disk logs; not a reconstructed complete process log.',
    'initialMissingFixture':"error: couldn't read `src/document_core/commands/../../../saved/blank2010.hwp`: No such file or directory (os error 2)",
    'initialSandbox':'First WSL invocation returned Wsl/E_ACCESSDENIED. Existing WSL tooling ran after sandbox approval.',
    'harnessFixes':'Missing saved/mydocs source includes copied byte-for-byte from formal77. Initial assumed control index0 corrected to the actual table control slot. Rust JSON raw string delimiter/sha2v0.11 formatting and unsupported Document serialization corrected before valid baseline.',
    'failureLogsRetained':['native-baseline.log','native-baseline-valid.log'],
    'productionAssertionsOrToleranceChanged':False})
dump('reproduce.json',{
    'formalSource':'build/rhwp-engine/source-de849bf3aacef6f1',
    'sourceBaseByteProof':'candidate-source-proof.json',
    'steps':['Copy the complete prepared formal77 source, including saved/blank2010.hwp and mydocs include_str inputs, to a new ignored private directory. Do not overwrite formal77.',
             'Copy fixtures/properties.hwp and properties.hwpx under build/document-save-transpose77; these are self-authored inputs used by the compiled harness.',
             'Register native-tests-final.rs as explicit Cargo [[test]] jueony_transpose_layout. Supply JUEONY_REPO and JUEONY_TABLE_OPS_SHA from the actual private source bytes.',
             'Run unchanged source with JUEONY_TRANSPOSE_MODE=baseline. The four merged/batch positive failures are expected original defects; 5/9 pass.',
             'Apply only the included delta with git apply --check --whitespace=error-all first, then run JUEONY_TRANSPOSE_MODE=candidate with the changed source SHA.',
             'Final harness contains10 transpose/protection/provenance checks plus1 explicit known-unresolved separate tableY diagnostic. Do not count that diagnostic as a tableY repair.',
             'Root must run formal WASM table-conversion and save-gate checks after integration. Native evidence is not actual Hancom/GUI equality.'],
    'fixtureLabels':'historical-transpose-export files are original formal77 serializer outputs, not exports claimed to come from the new candidate. Candidate readbacks are actual Native output snapshots; subsequent root formal integration provides final binaries.',
    'excluded':['vendor source','public documents','font programs','whole source tree','WASM','EXE']})
(OUT/'verify_manifest.py').write_text("from pathlib import Path\nimport json,hashlib\np=Path(__file__).resolve().parent\nm=json.loads((p/'manifest-sha256.json').read_text(encoding='utf-8'))\nfor r in m['files']:\n b=(p/r['path']).read_bytes();assert len(b)==r['bytes'];assert hashlib.sha256(b).hexdigest()==r['sha256'],r['path']\nprint('PASS',len(m['files']),'compact transpose files')\n",encoding='utf-8')
files=[{'path':p.relative_to(OUT).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)}
       for p in sorted(OUT.rglob('*'))if p.is_file()and p.name!='manifest-sha256.json']
dump('manifest-sha256.json',{'schemaVersion':1,'files':files})
print('PACKAGED',len(files),'files',sum(x['bytes']for x in files),'bytes',OUT)
