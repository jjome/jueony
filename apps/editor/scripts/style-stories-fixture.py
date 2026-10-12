import sys,zipfile,json,copy
import xml.etree.ElementTree as ET
mode,path=sys.argv[1:3]
ns={'hp':'http://www.hancom.co.kr/hwpml/2011/paragraph','hh':'http://www.hancom.co.kr/hwpml/2011/head'}
with zipfile.ZipFile(path) as z: entries={i.filename:(i,z.read(i.filename)) for i in z.infolist()}
if mode=='prepare':
    output,sid,cid,override=sys.argv[3:7]
    item,data=entries['Contents/section0.xml'];root=ET.fromstring(data)
    table=root.find('.//hp:tbl',ns);sub=table.find('.//hp:tc/hp:subList',ns)
    p=ET.SubElement(sub,'{'+ns['hp']+'}p',{'id':'9100','paraPrIDRef':'0','styleIDRef':sid,'pageBreak':'0','columnBreak':'0','merged':'0'})
    run=ET.SubElement(p,'{'+ns['hp']+'}run',{'charPrIDRef':cid});run.append(copy.deepcopy(table))
    for paragraph in root.findall('.//hp:p',ns):
        paragraph.set('styleIDRef',sid)
        for run in paragraph.findall('hp:run',ns):
            text=''.join(t.text or '' for t in run.findall('hp:t',ns))
            run.set('charPrIDRef',override if '직접 서식' in text else cid)
    entries['Contents/section0.xml']=(item,ET.tostring(root,encoding='utf8',xml_declaration=True))
    with zipfile.ZipFile(output,'w') as z:
        for item,data in entries.values():z.writestr(item,data)
else:
    head=ET.fromstring(entries['Contents/header.xml'][1]);props={p.get('id'):p.get('height') for p in head.findall('.//hh:charPr',ns)}
    rows=[]
    for name,(_,data) in entries.items():
        if not name.startswith('Contents/section') or not name.endswith('.xml'):continue
        root=ET.fromstring(data)
        for p in root.findall('.//hp:p',ns):
            for run in p.findall('hp:run',ns):
                text=''.join(t.text or '' for t in run.findall('hp:t',ns))
                if text:rows.append({'text':text,'style':int(p.get('styleIDRef','0')),'size':int(props[run.get('charPrIDRef')])})
    print(json.dumps(rows,ensure_ascii=True))
