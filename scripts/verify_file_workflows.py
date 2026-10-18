"""Run existing file/recovery workflows on one explicit immutable build."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse,hashlib,json,os,subprocess

ROOT=Path(__file__).resolve().parent.parent
APP=ROOT/'apps/editor'
CASES=[('native-shell',11),('native-recents',9),('document-lifecycle',10),
       ('document-windows',8),('recovery-integrity',10),('download-connection',10),
       ('close-recovery',4),('save-recovery',29),('document-metadata',10),
       ('agent-files',15),('xml-documents-integrated',7),('xml-documents',13),('xml-recovery',13),
       ('package-preservation',14),('native-row-preservation',13),('native-row-engine',19),
       ('reflowed-native-storage',12),('reflowed-native-ui',13),('computed-row-package',22),
       ('document-history95',20),('history-ui95',12),('xml-simple-types95',10),('stored-information95',17),
       ('hwt-template95',9),('document-story-information96',5)]
sha=lambda b:hashlib.sha256(b).hexdigest()

def main():
    p=argparse.ArgumentParser();p.add_argument('--engine',type=Path,required=True)
    p.add_argument('--dist',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
    p.add_argument('--node',required=True);p.add_argument('--workers',type=int,choices=[1,2],default=2)
    p.add_argument('--frame-baseline-engine',type=Path);p.add_argument('--baseline-engine',type=Path);p.add_argument('--native-cell-source',type=Path);p.add_argument('--native-cell-oracle',type=Path)
    p.add_argument('--floating-host-baseline',type=Path);p.add_argument('--floating-host-source',type=Path);p.add_argument('--floating-host-oracle',type=Path)
    p.add_argument('--native-prefix-baseline',type=Path);p.add_argument('--native-prefix-source',type=Path)
    p.add_argument('--python-edit-baseline',type=Path);p.add_argument('--python-edit-source',type=Path);p.add_argument('--python-edit-oracle',type=Path)
    a=p.parse_args();engine=a.engine.resolve();dist=a.dist.resolve();out=a.output.resolve()
    optional=[a.baseline_engine,a.native_cell_source,a.native_cell_oracle,a.frame_baseline_engine]
    assert all(optional) or not any(optional),'native-cell/frame regressions require baseline engine, source, oracle and independent frame baseline together'
    cases=CASES+[('owned-native-cell-layout',13),('owned-python-frame-layout',6)] if all(optional) else CASES
    floating=[a.floating_host_baseline,a.floating_host_source,a.floating_host_oracle]
    assert all(floating) or not any(floating),'floating-host regression requires its baseline engine, source and oracle together'
    if all(floating):cases=cases+[('authored-floating-gap-layout',18)]
    prefix=[a.native_prefix_baseline,a.native_prefix_source]
    assert all(prefix) or not any(prefix),'native-prefix storage/UI require explicit pinned baseline and original Native source together'
    if all(prefix):cases=cases+[('native-prefix-storage',32),('native-prefix-ui',3)]
    python_edit=[a.python_edit_baseline,a.python_edit_source,a.python_edit_oracle]
    assert all(python_edit)or not any(python_edit),'Python edit storage/UI require explicit pinned baseline, source HWPX and independent Native HWP together'
    if all(python_edit):cases=cases+[('python-edit-storage',30),('python-edit-ui',7)]
    meta=json.loads((engine/'jueony-engine-build.json').read_bytes())
    build=json.loads((dist/'build-evidence.json').read_bytes())
    assert sha((engine/'rhwp_bg.wasm').read_bytes())==meta['wasmSha256']==build['engineWasmSha256']
    assert sha((engine/'rhwp.js').read_bytes())==meta['jsSha256']==build['engineBuild']['jsSha256']
    out.mkdir(parents=True,exist_ok=False);(out/'logs').mkdir()
    def run(case):
        name,count=case;script=APP/'scripts'/f'verify-{name}.mjs';fingerprint=sha(script.read_bytes())
        target=out/name;env=dict(os.environ,JUEONY_ENGINE_PACKAGE=str(engine),JUEONY_TEST_DIST=str(dist),JUEONY_TEST_OUTPUT=str(target))
        if name in ['owned-native-cell-layout','owned-python-frame-layout']:env.update(JUEONY_FRAME_BASELINE_ENGINE_PACKAGE=str(a.frame_baseline_engine.resolve()),JUEONY_BASELINE_ENGINE_PACKAGE=str(a.baseline_engine.resolve()),JUEONY_TEST_SOURCE=str(a.native_cell_source.resolve()),JUEONY_TEST_ORACLE=str(a.native_cell_oracle.resolve()))
        if name=='authored-floating-gap-layout':env.update(JUEONY_BASELINE_ENGINE_PACKAGE=str(a.floating_host_baseline.resolve()),JUEONY_TEST_SOURCE=str(a.floating_host_source.resolve()),JUEONY_TEST_ORACLE=str(a.floating_host_oracle.resolve()))
        if name in ['native-prefix-storage','native-prefix-ui']:env.update(JUEONY_BASELINE_ENGINE_PACKAGE=str(a.native_prefix_baseline.resolve()),JUEONY_TEST_SOURCE=str(a.native_prefix_source.resolve()))
        if name in ['python-edit-storage','python-edit-ui']:env.update(JUEONY_BASELINE_ENGINE_PACKAGE=str(a.python_edit_baseline.resolve()),JUEONY_TEST_SOURCE=str(a.python_edit_source.resolve()),JUEONY_TEST_ORACLE=str(a.python_edit_oracle.resolve()))
        with (out/'logs'/f'{name}.log').open('w',encoding='utf-8') as log:
            proc=subprocess.run([a.node,'--experimental-strip-types',str(script)],cwd=APP,env=env,stdout=log,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        row={'name':name,'exitCode':proc.returncode,'expectedCases':count,'verifierSHA256':fingerprint,'scriptUnchanged':sha(script.read_bytes())==fingerprint}
        try:
            path=target/'result.json';raw=path.read_bytes();r=json.loads(raw)
            assert proc.returncode==0 and row['scriptUnchanged']
            assert len(r['results'])==count and r['failures']==[],(name,r.get('failures'))
            engine_only=name in ['package-preservation','native-row-engine',
                                 'reflowed-native-storage','computed-row-package','stored-information95',
                                 'document-story-information96','owned-native-cell-layout','owned-python-frame-layout','authored-floating-gap-layout','native-prefix-storage','python-edit-storage']
            if not engine_only:
                for key in ['pageErrors','consoleErrors','externalRequests']:assert r[key]==[],(name,key)
            for item in r['results']:
                if isinstance(item,dict):assert item['status']=='PASS',(name,item)
            independent=name in ['xml-documents','xml-recovery','document-history95','xml-simple-types95']
            if engine_only or name=='hwt-template95':
                # Direct WASM; package suite additionally inspects independent ZIPs.
                assert r['engine']['wasmSha256']==meta['wasmSha256'] and r['engine']['jsSha256']==meta['jsSha256']
                assert r['verifierSha256']==fingerprint
                for source in r['sourceHashes']:
                    assert sha((APP/source['path']).read_bytes())==source['sha256']
            elif not independent:
                assert r['engine']['wasmSha256']==meta['wasmSha256'] and r['engine']['jsSha256']==meta['jsSha256']
                assert r['build']['engineBuild']['sourceId']==meta['sourceId']
                assert r['build']['customSourceSha256']==build['customSourceSha256']
            else:
                # XML has no HWP engine. Attest its exact source separately.
                for source in r['sourceHashes']:
                    assert sha((APP/source['path']).read_bytes())==source['sha256']
            row.update(status='PASS',passed=count,resultSHA256=sha(raw),engineUsed=not independent)
        except Exception as e:row.update(status='FAIL',error=str(e))
        print(name,row['status'],flush=True);return row
    with ThreadPoolExecutor(max_workers=a.workers)as pool:rows=list(pool.map(run,cases))
    failed=[x for x in rows if x['status']!='PASS']
    result={'engine':meta,'build':build,'suites':rows,'failures':failed,'passedCases':sum(x.get('passed',0)for x in rows),'totalCases':sum(count for _,count in cases),'externalNativeCellCorpusIncluded':all(optional),'externalFloatingHostCorpusIncluded':all(floating),'externalNativePrefixCorpusIncluded':all(prefix),'externalPythonEditCorpusIncluded':all(python_edit),'scope':'Production file/recovery UI exercised through isolated headless Edge profiles and native IPC seams, not actual OS dialog/Hancom screen certification. Standalone XML and history IDB suites attest exact sources separately. HWT uses actual WASM and an explicit browser test bridge; history-ui also tests its actual production iframe facade and host menu. Optional native-cell/frame regressions require four explicit paths including their independent frame baseline; floating-host regressions require their three explicit paths and SHA-pinned source/oracle; native-prefix regressions require their pinned baseline and original Native file together; Python regressions require baseline, source HWPX and Native reference together. Absence adds no PASS or silent skipped case. Floating-host strict comparisons include stored metadata when both official engines expose it. The old native-row safety cases permit detected mismatch refusal; separate reflowed-native-storage/UI and native-prefix-storage/UI REQUIRE successful saves/reopens/follow-up edits. Computed-row-package independently checks ZIP authority. Agent suite includes actual approved-bound save and stale generation refusal.'}
    (out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return int(bool(failed))

if __name__=='__main__':raise SystemExit(main())
