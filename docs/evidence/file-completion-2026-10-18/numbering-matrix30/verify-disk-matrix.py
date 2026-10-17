from pathlib import Path
import runpy,contextlib,io,json,struct,sys,xml.etree.ElementTree as E
from zipfile import ZipFile
with contextlib.redirect_stdout(io.StringIO()):lib=runpy.run_path(str(Path(__file__).with_name('independent-cfb.py')))
if len(sys.argv)!=4:raise SystemExit('Use audit-matrix30.py MANIFEST ACTUAL-HWP ACTUAL-DISK-HWPX')
manifest=Path(sys.argv[1]);native=Path(sys.argv[2]);reverse=Path(sys.argv[3]);m=json.loads(manifest.read_text(encoding='utf8'));streams,_=lib['streams'](native);numbers=[b for t,l,b in lib['records'](streams['DocInfo'])if t==23]
def string(b,p):
 count=struct.unpack_from('<H',b,p)[0];p+=2;return b[p:p+count*2].decode('utf-16le'),p+count*2
def decode(b):
 p=0
 for _ in range(7):p+=12;_,p=string(b,p)
 p+=30;heads=[]
 for level in range(8,11):
  a,w,d,c=struct.unpack_from('<IhhI',b,p);headhex=b[p:p+12].hex();p+=12;text,p=string(b,p);heads.append({'level':level,'attr':a,'numberFormatCode':(a>>5)&15,'widthAdjust':w,'textOffset':d,'charRef':c,'head12Hex':headhex,'text':text})
 starts=list(struct.unpack_from('<3I',b,p));p+=12;return {'heads':heads,'starts':starts,'exactEnd':p==len(b),'unknownTailHex':b[p:].hex(),'sha256':lib['sha'](b)}
ns=[decode(b)for b in numbers]
with ZipFile(reverse)as z:root=E.fromstring(z.read('Contents/header.xml'))
xs=[n for n in root.iter()if n.tag.endswith('numbering')];cases=[]
for c in m['cases']:
 token=c.get('nativeIdentityToken')
 if token:
  hits=[(i,n)for i,n in enumerate(ns)if token in n['heads'][0]['text']];xh=[n for n in xs if any(token in(q.text or'')for q in n)]
 else:
  i=c['id']-1;hits=[(i,ns[i])]if i<len(ns)else[];xh=[n for n in xs if n.get('id')==str(c['id'])]
 if len(hits)!=1 or len(xh)!=1:cases.append({'input':c,'error':'case mapping missing or ambiguous','nativeMatches':len(hits),'reverseMatches':len(xh)});continue
 i,n=hits[0];q=next(q for q in xh[0]if q.tag.endswith('paraHead')and q.get('level')=='8');cases.append({'input':c,'nativeRecordIndex':i,'native':n,'reverse':{'id':xh[0].get('id'),'numFormat':q.get('numFormat'),'checkable':q.get('checkable'),'text':q.text},'normalizes':str(c['level8Checkable'])!=q.get('checkable'),'nativeCodeMatches':n['heads'][0]['numberFormatCode']==c['code']})
pairs=[]
for code in range(15):
 a,b=[c for c in cases if c['input']['code']==code]
 if'error'in a or'error'in b:continue
 pairs.append({'code':code,'name':a['input']['numFormat'],'head12EqualBetweenInputCheckables':a['native']['heads'][0]['head12Hex']==b['native']['heads'][0]['head12Hex'],'nativeStartsEqual':a['native']['starts']==b['native']['starts'],'reverseCheckables':[a['reverse']['checkable'],b['reverse']['checkable']]})
complete=len(cases)==30 and all('error'not in c and c['nativeCodeMatches']and c['native']['exactEnd']for c in cases)
out={'status':'ACTUAL_MATRIX30_COMPLETE'if complete else'INCOMPLETE_OR_DIFFERENT_NO_MAPPING_ASSUMED','selfAuthored':True,'manifest':str(manifest),'nativeFile':str(native),'nativeSha256':lib['sha'](native.read_bytes()),'diskReverseFile':str(reverse),'diskReverseSha256':lib['sha'](reverse.read_bytes()),'nativeDefinitions':len(ns),'reverseDefinitions':len(xs),'cases':cases,'pairs':pairs,'normalizationCount':sum(c.get('normalizes',False)for c in cases),'noProductionCanonicalInferenceMade':True}
p=native.parent/(native.stem+'-matrix30-audit.json');print(json.dumps({'status':out['status'],'nativeDefinitions':len(ns),'reverseDefinitions':len(xs),'normalizationCount':out['normalizationCount'],'pairs':pairs}));sys.exit(0 if complete else 1)

