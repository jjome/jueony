"""Run existing file/recovery workflows on one explicit immutable build."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse,hashlib,json,os,subprocess

ROOT=Path(__file__).resolve().parent.parent
APP=ROOT/'apps/editor'
CASES=[('native-shell',11),('native-recents',9),('document-lifecycle',10),
       ('document-windows',8),('recovery-integrity',10),('download-connection',10),
       ('close-recovery',4),('save-recovery',29),('document-metadata',10),
       ('agent-files',12),('xml-documents-integrated',7),('xml-documents',13)]
sha=lambda b:hashlib.sha256(b).hexdigest()

def main():
    p=argparse.ArgumentParser();p.add_argument('--engine',type=Path,required=True)
    p.add_argument('--dist',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
    p.add_argument('--node',required=True);p.add_argument('--workers',type=int,choices=[1,2],default=2)
    a=p.parse_args();engine=a.engine.resolve();dist=a.dist.resolve();out=a.output.resolve()
    meta=json.loads((engine/'jueony-engine-build.json').read_bytes())
    build=json.loads((dist/'build-evidence.json').read_bytes())
    assert sha((engine/'rhwp_bg.wasm').read_bytes())==meta['wasmSha256']==build['engineWasmSha256']
    assert sha((engine/'rhwp.js').read_bytes())==meta['jsSha256']==build['engineBuild']['jsSha256']
    out.mkdir(parents=True,exist_ok=False);(out/'logs').mkdir()
    def run(case):
        name,count=case;script=APP/'scripts'/f'verify-{name}.mjs';fingerprint=sha(script.read_bytes())
        target=out/name;env=dict(os.environ,JUEONY_ENGINE_PACKAGE=str(engine),JUEONY_TEST_DIST=str(dist),JUEONY_TEST_OUTPUT=str(target))
        with (out/'logs'/f'{name}.log').open('w',encoding='utf-8') as log:
            proc=subprocess.run([a.node,'--experimental-strip-types',str(script)],cwd=APP,env=env,stdout=log,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        row={'name':name,'exitCode':proc.returncode,'expectedCases':count,'verifierSHA256':fingerprint,'scriptUnchanged':sha(script.read_bytes())==fingerprint}
        try:
            path=target/'result.json';raw=path.read_bytes();r=json.loads(raw)
            assert proc.returncode==0 and row['scriptUnchanged']
            assert len(r['results'])==count and r['failures']==[],(name,r.get('failures'))
            for key in ['pageErrors','consoleErrors','externalRequests']:assert r[key]==[],(name,key)
            for item in r['results']:
                if isinstance(item,dict):assert item['status']=='PASS',(name,item)
            if name!='xml-documents':
                assert r['engine']['wasmSha256']==meta['wasmSha256'] and r['engine']['jsSha256']==meta['jsSha256']
                assert r['build']['engineBuild']['sourceId']==meta['sourceId']
                assert r['build']['customSourceSha256']==build['customSourceSha256']
            else:
                # XML has no HWP engine. Attest its exact source separately.
                for source in r['sourceHashes']:
                    assert sha((APP/source['path']).read_bytes())==source['sha256']
            row.update(status='PASS',passed=count,resultSHA256=sha(raw),engineUsed=name!='xml-documents')
        except Exception as e:row.update(status='FAIL',error=str(e))
        print(name,row['status'],flush=True);return row
    with ThreadPoolExecutor(max_workers=a.workers)as pool:rows=list(pool.map(run,CASES))
    failed=[x for x in rows if x['status']!='PASS']
    result={'engine':meta,'build':build,'suites':rows,'failures':failed,'passedCases':sum(x.get('passed',0)for x in rows),'totalCases':133,'scope':'Existing production file/recovery UI exercised through isolated real Edge profiles and native IPC seams, not actual OS dialog/Hancom screen certification. Standalone XML13 attested separately without HWP engine.'}
    (out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return int(bool(failed))

if __name__=='__main__':raise SystemExit(main())
