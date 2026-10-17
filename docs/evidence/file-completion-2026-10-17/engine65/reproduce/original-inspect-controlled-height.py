from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as E,json,hashlib
root=Path(__file__).resolve().parent;hp='{http://www.hancom.co.kr/hwpml/2011/paragraph}'
def inspect(path):
 t=E.fromstring(ZipFile(path).read('Contents/section0.xml')).find('.//'+hp+'tbl');sz=t.find(hp+'sz');defaults=t.find(hp+'inMargin');rc=int(t.get('rowCnt'));content=[0]*rc;padding_only=[0]*rc;heights=[]
 for cell in t.findall('.//'+hp+'tc'):
  addr=cell.find(hp+'cellAddr');span=cell.find(hp+'cellSpan');assert int(span.get('rowSpan'))==int(span.get('colSpan'))==1
  row=int(addr.get('rowAddr'));minimum=int(cell.find(hp+'cellSz').get('height'));heights.append(minimum)
  margin=cell.find(hp+'cellMargin')if cell.get('hasMargin')=='1' else defaults;floor=max(0,int(margin.get('top')))+max(0,int(margin.get('bottom')))
  paras=cell.find(hp+'subList').findall(hp+'p');assert len(paras)==1;lines=paras[0].find(hp+'linesegarray').findall(hp+'lineseg');assert len(lines)==1 and int(lines[0].get('vertpos'))==0
  text=int(lines[0].get('vertsize'));content[row]=max(content[row],floor+text,minimum);padding_only[row]=max(padding_only[row],floor,minimum)
 spacing=int(t.get('cellSpacing'))*(rc-1);protected=sz.get('protect')=='1';actual=int(sz.get('height'));expected=sum(padding_only if protected else content)+spacing
 return {'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'commonHeight':actual,'protect':protected,'realCellHeights':heights,'rowContentMinima':content,'rowPaddingMinima':padding_only,'expectedFrameFromSeparatedContract':expected}
results=[]
for name in ['auto-zero','large','small-protected','large-protected','explicit-rows-9000']:
 before=inspect(root/(name+'.hwpx'));after=inspect(root/(name+'-hancom.hwpx'));assert before['realCellHeights']==after['realCellHeights'];assert before['rowContentMinima']==after['rowContentMinima'];assert before['rowPaddingMinima']==after['rowPaddingMinima'];assert before['expectedFrameFromSeparatedContract']==after['commonHeight'];results.append({'name':name,'before':before,'actualHancomSaved':after})
(root/'independent-integer-row-oracle-final.json').write_bytes(json.dumps({'scope':'Five controlled single-line3x2 authored inputs independently saved by actual Hancom UI. Exact integer HWPX row/cell/margin inspection; not a general renderer or production normalization.','results':results,'passed':len(results),'failed':0},indent=2).encode())
print('Independent exact integer oracle:5/5matches actual Hancom; all30cell-height declarations preserved')
