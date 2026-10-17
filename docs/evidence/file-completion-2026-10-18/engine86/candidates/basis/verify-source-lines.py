"""Independent source-record and actual-XML coordinates; writes no document bytes."""
from pathlib import Path
import ast,hashlib,json,struct,zlib,zipfile,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2]
source=root/'build/hancom-final-file-review-20261017/source-mcst-bid-2026.hwp'
actual=root/'build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='c61a13b249183a675d38d5badfa3af610edcf99a403622440fc81b7f52b348f2'
assert hashlib.sha256(actual.read_bytes()).hexdigest()=='20a3960b4315626c3f97d9c5d47746e3cfadd8fe50dde43a4a424aa3a2a76936'
reader=root/'build/file-closure69-public/independent-resource-graph.py'
module=ast.parse(reader.read_text(encoding='utf8'))
functions=[n for n in module.body if isinstance(n,ast.FunctionDef) and n.name in ['streams','records']]
ns={'struct':struct,'zlib':zlib};exec(compile(ast.Module(body=functions,type_ignores=[]),str(reader),'exec'),ns)
ss,compressed=ns['streams'](source);shape=[b for t,l,b in ns['records'](ss['DocInfo']) if t==25]
body=zlib.decompress(ss['Section0'],-15) if compressed else ss['Section0']
rows=[];pi=-1;record=None
for tag,level,payload in ns['records'](body):
 if tag==66 and level==0:
  pi+=1;record=None
  if pi in [42,43,44,45]:
   sid=struct.unpack_from('<H',payload,8)[0];ps=shape[sid]
   record={'paragraph':pi,'charCount':struct.unpack_from('<I',payload,0)[0]&0x7fffffff,'paraShapeId':sid,'shapeRawHex':ps.hex(),'spacingBeforeHU':struct.unpack_from('<i',ps,16)[0],'spacingAfterHU':struct.unpack_from('<i',ps,20)[0],'lineSpacingRaw':struct.unpack_from('<i',ps,24)[0],'lines':[]};rows.append(record)
 elif record is not None and tag==69 and level==1:
  assert len(payload)%36==0
  for offset in range(0,len(payload),36):
   values=struct.unpack_from('<8iI',payload,offset);record['lines'].append(dict(zip(['textpos','vpos','height','textHeight','baseline','spacing','columnStart','segmentWidth','tag'],values)))
with zipfile.ZipFile(actual) as z:
 section=ET.fromstring(z.read('Contents/section0.xml'));pars=list(section);xmlns={'hp':'http://www.hancom.co.kr/hwpml/2011/paragraph'}
 xmlrows=[]
 for pi in [42,43,44,45]:
  p=pars[pi];xmlrows.append({'paragraph':pi,'lines':[dict(n.attrib) for n in p.findall('./hp:linesegarray/hp:lineseg',xmlns)]})
result={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'rows':rows,'actualSha256':hashlib.sha256(actual.read_bytes()).hexdigest(),'actualXml':xmlrows,'independentReaderSha256':hashlib.sha256(reader.read_bytes()).hexdigest(),'scope':'Root-paragraph numeric LINE_SEG and paragraph-shape bytes only; no public body or font bytes.'}
out=Path(__file__).with_name('independent-source-and-actual-lines.json');out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8');print('Independent source/actual numeric cache records verified')
