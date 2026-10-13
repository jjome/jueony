import json,sys,re,zipfile,xml.etree.ElementTree as ET
from pathlib import Path
path=Path(sys.argv[1]);ns={'hp':'http://www.hancom.co.kr/hwpml/2011/paragraph','hh':'http://www.hancom.co.kr/hwpml/2011/head'}
with zipfile.ZipFile(path) as z:
    entries={info.filename:z.read(info.filename) for info in z.infolist()}
if len(sys.argv)>2:
    mode=sys.argv[3];section=entries['Contents/section0.xml'].decode('utf8')
    section=re.sub(r'<hp:lineNumberShape\b[^>]*/>', '<hp:lineNumberShape restartType="'+('7' if mode=='unknown' else '2')+'" countBy="5" distance="1417" startNumber="3"/>',section,count=1)
    section=section.replace('showLineNumber="0"','showLineNumber="1"',1);entries['Contents/section0.xml']=section.encode('utf8')
    if mode=='vertical': entries['Contents/section0.xml']=entries['Contents/section0.xml'].replace(b'textDirection="HORIZONTAL"',b'textDirection="VERTICAL"',1)
    if mode=='suppressed':
        header=entries['Contents/header.xml'].decode('utf8');header=re.sub(r'(<hh:paraPr\b[^>]*suppressLineNumbers=")0(")',r'\g<1>1\2',header,count=1);entries['Contents/header.xml']=header.encode('utf8')
    with zipfile.ZipFile(sys.argv[2],'w') as z:
        for name,data in entries.items():z.writestr(name,data,compress_type=zipfile.ZIP_STORED if name=='mimetype' else zipfile.ZIP_DEFLATED)
else:
    rows=[]
    for name in sorted(entries):
        if name.startswith('Contents/section') and name.endswith('.xml'):
            root=ET.fromstring(entries[name]);rows.append({'entry':name,'visibility':root.find('.//hp:visibility',ns).attrib,'shape':root.find('.//hp:lineNumberShape',ns).attrib})
    header=ET.fromstring(entries['Contents/header.xml']);print(json.dumps({'sections':rows,'suppressedStyles':[p.get('id') for p in header.findall('.//hh:paraPr',ns) if p.get('suppressLineNumbers')=='1']},ensure_ascii=False))
