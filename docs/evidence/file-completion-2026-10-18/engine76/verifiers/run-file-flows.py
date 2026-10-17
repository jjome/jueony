from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess,os,json
r=Path.cwd();node=r'C:/Users/jjome/AppData/Local/Volta/tools/image/node/22.22.2/node.exe';env=os.environ.copy();env.update(JUEONY_ENGINE_PACKAGE=str(r/'build/rhwp-engine/source-23d2545926a179a5/pkg'),JUEONY_TEST_DIST=str(r/'apps/editor/evidence/dist-file-closure-final76b'))
names=['native-shell','native-recents','document-lifecycle','document-windows']
def run(name):
 e=env.copy();e['JUEONY_TEST_OUTPUT']=str(r/('build/file-closure76-'+name));log=r/('build/file-closure76-'+name+'.log')
 with log.open('w',encoding='utf-8')as f:p=subprocess.run([node,'--experimental-strip-types','scripts/verify-'+name+'.mjs'],cwd=r/'apps/editor',env=e,stdout=f,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
 print(name,p.returncode,flush=True);return{'name':name,'exitCode':p.returncode}
with ThreadPoolExecutor(max_workers=2)as pool:res=list(pool.map(run,names))
(r/'build/file-closure76-file-flows.json').write_text(json.dumps(res,indent=2),encoding='utf-8')
assert all(x['exitCode']==0 for x in res)
