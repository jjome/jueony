from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import os,subprocess,json
r=Path.cwd();app=r/'apps/editor';out=r/'build/file-completion-formal76-regressions';out.mkdir(parents=True,exist_ok=True)
node=r'C:\Users\jjome\AppData\Local\Volta\tools\image\node\22.22.2\node.exe';env=os.environ.copy();env.update(JUEONY_ENGINE_PACKAGE=os.environ['JUEONY_ENGINE_PACKAGE'],JUEONY_TEST_DIST=os.environ.get('JUEONY_TEST_DIST',str(app/'evidence/dist-state-storage')),JUEONY_REQUIRE_BORDER_REGION='1')
tasks=[(s,c,'native') for s,c in [('table-split','split-native'),('table-merge','merge-native'),('row-heights','native'),('table-multi-header','table-multi-header-native'),('agent-table-header','agent-table-header-native'),('agent-table-pagination','agent-table-pagination-native'),('table-protection','table-protection-native'),('table-conversion','table-conversion-native'),('style','styles-native'),('style-stories','style-stories-native'),('agent-style-next','agent-style-next-native'),('cell-padding','agent-native'),('memo-tail','memo-native'),('following-table','following-native'),('table-outer-margin','outer-native'),('column-width','width-native'),('equal-columns','equal-native'),('paragraph-page-owner','owner-native'),('cell-padding-hwp','host-native'),('table-default-padding','default-native')]]+[(s,c,'browser') for s,c in [('table-split','split-browser'),('table-merge','merge-browser'),('row-heights','browser'),('table-multi-header','table-multi-header-browser'),('agent-table-header','agent-table-header-browser'),('agent-table-pagination','agent-table-pagination-browser'),('table-protection','table-protection-browser'),('table-conversion','table-conversion-browser'),('selected-object-properties','selected-object-browser'),('agent-style-next','agent-style-next-browser'),('cell-padding','agent-browser'),('column-width','width-browser'),('equal-columns','equal-browser')]]

tasks += [('table-structure','structure-native','native'),('table-structure','structure-browser','browser'),('cell-paragraph','cell-paragraph-native','native'),('cell-paragraph','cell-paragraph-browser','browser'),('table-subdivision','subdivision-native','native'),('table-subdivision','subdivision-browser','browser'),('session-textbox','textbox-native','native'),('session-textbox','textbox-browser','browser'),('textbox-alignment','textbox-storage-native','native'),('format-conversion','format-conversion-native','native'),('overlap-table-tail','overlap-native','native')]

def run(t):
 s,c,k=t;e=env.copy();e['JUEONY_TEST_OUTPUT']=str(out/c)
 script=app/'scripts'/('verify-'+s+('-engine' if k=='native' else '')+'.mjs')
 if s in ['column-width','equal-columns'] and k=='browser':e['JUEONY_TEST_HIDDEN_OWNER']='1'
 if s=='cell-padding' and k=='browser':e['JUEONY_TEST_TABLE_DEFAULTS']='1'
 if not script.exists():script=app/'scripts'/('verify-'+s+'.mjs')
 cwd = r if s in ['session-textbox','textbox-alignment'] else app
 with (r/'build'/('file-completion-formal76-regression-'+c+'.log')).open('w',encoding='utf8') as log:p=subprocess.run([node,'--experimental-strip-types',str(script)],cwd=cwd,env=e,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
 print(c,p.returncode,flush=True);return dict(category=c,kind=k,exitCode=p.returncode)
kind=os.environ.get('JUEONY_REGRESSION_KIND','all')
tasks=[t for t in tasks if kind=='all' or t[2]==kind]
with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(run,tasks))
(out/('regressions-'+kind+'.json')).write_text(json.dumps(results,indent=2),encoding='utf8')
if any(x['exitCode'] for x in results):raise SystemExit(1)
