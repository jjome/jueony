"""Synthetic nested/style-reference fixture creation and inspection; never used by the app."""
import sys, zipfile, copy, json
import xml.etree.ElementTree as ET
mode, input_path = sys.argv[1:3]
ns={'hp':'http://www.hancom.co.kr/hwpml/2011/paragraph'}
with zipfile.ZipFile(input_path) as archive:
    entries={item.filename:(item,archive.read(item.filename)) for item in archive.infolist()}
if mode=='prepare':
    output, removed, kept=sys.argv[3],sys.argv[4],sys.argv[5]
    item,data=entries['Contents/section0.xml']; root=ET.fromstring(data)
    table=root.find('.//hp:tbl',ns)
    cell=table.find('.//hp:tc/hp:subList',ns)
    nested=copy.deepcopy(table)
    p=ET.SubElement(cell,'{'+ns['hp']+'}p',{'id':'9001','paraPrIDRef':'0','styleIDRef':kept,'pageBreak':'0','columnBreak':'0','merged':'0'})
    run=ET.SubElement(p,'{'+ns['hp']+'}run',{'charPrIDRef':'0'});run.append(nested)
    for paragraph in root.findall('.//hp:p',ns):
        text=''.join(t.text or '' for t in paragraph.findall('hp:run/hp:t',ns))
        if '삭제됨' in text:paragraph.set('styleIDRef',removed)
        elif '유지됨' in text:paragraph.set('styleIDRef',kept)
    entries['Contents/section0.xml']=(item,ET.tostring(root,encoding='utf-8',xml_declaration=True))
    with zipfile.ZipFile(output,'w') as archive:
        for item,data in entries.values():archive.writestr(item,data)
else:
    result=[]
    for path,(_,data) in entries.items():
        if not path.startswith('Contents/section') or not path.endswith('.xml'):continue
        root=ET.fromstring(data)
        for p in root.findall('.//hp:p',ns):
            text=''.join(t.text or '' for t in p.findall('hp:run/hp:t',ns))
            if '삭제됨' in text or '유지됨' in text:result.append({'text':text,'styleId':int(p.get('styleIDRef','0'))})
    print(json.dumps(result,ensure_ascii=True))
