from pathlib import Path
import ast,hashlib,json,struct,zlib,zipfile,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2];b=root/'build/column3-closure83';reader=root/'build/file-closure69-public/independent-resource-graph.py';m=ast.parse(reader.read_text(encoding='utf8'));ns={'struct':struct,'zlib':zlib};exec(compile(ast.Module(body=[n for n in m.body if isinstance(n,ast.FunctionDef) and n.name in ['streams','records']],type_ignores=[]),str(reader),'exec'),ns)
source_path=b/'column3-source-copy.hwp';ss,compressed=ns['streams'](source_path);body=zlib.decompress(ss['Section0'],-15) if compressed else ss['Section0'];rows=[];pi=-1;current=None
for tag,level,payload in ns['records'](body):
 if tag==66 and level==0:
  pi+=1;current={'paragraph':pi,'headerRawHex':payload.hex(),'lines':[],'controls':[]};rows.append(current)
 elif current is not None and tag==69 and level==1:
  for off in range(0,len(payload),36):current['lines'].append(dict(zip(['textpos','vpos','height','textHeight','baseline','spacing','columnStart','segmentWidth','tag'],struct.unpack_from('<8iI',payload,off))))
 elif current is not None and tag==71 and level==1:
  current['controls'].append({'controlIdHex':payload[:4].hex(),'byteLength':len(payload),'prefixHex':payload[:48].hex()})
with zipfile.ZipFile(b/'column3-exported-1.hwpx') as z:
 section=ET.fromstring(z.read('Contents/section0.xml'));pars=list(section);hp='http://www.hancom.co.kr/hwpml/2011/paragraph';xml=[]
 for pi,paragraph in enumerate(pars):
  xml.append({'paragraph':pi,'attributes':paragraph.attrib,'lines':[e.attrib for e in paragraph.findall(f'./{{{hp}}}linesegarray/{{{hp}}}lineseg')],'tables':[{'size':next((e.attrib for e in t if e.tag.endswith('}sz')),None),'pos':next((e.attrib for e in t if e.tag.endswith('}pos')),None),'outMargin':next((e.attrib for e in t if e.tag.endswith('}outMargin')),None),'attributes':t.attrib} for t in paragraph.iter(f'{{{hp}}}tbl')]})
 markers=[{'path':n,'payload':z.read(n).decode('utf8')} for n in z.namelist() if n.startswith('META-INF/rhwp-')]
report={'sourceSHA':hashlib.sha256(source_path.read_bytes()).hexdigest(),'sourceRootRecords':rows,'exportedSHA':hashlib.sha256((b/'column3-exported-1.hwpx').read_bytes()).hexdigest(),'exportedRootXML':xml,'markers':markers,'independentReaderSHA':hashlib.sha256(reader.read_bytes()).hexdigest(),'scope':'Independent structural bytes and numeric line frames only; self-authored fixture.'};(b/'independent-frames.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps({'source':rows,'exportedLineCounts':[len(r['lines']) for r in xml],'markers':markers},indent=2))
