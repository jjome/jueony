"""Add one explicit rich feature to a synthetic master for preservation/refusal tests."""
import copy,sys,zipfile,xml.etree.ElementTree as ET
source,target,mode=sys.argv[1:4]
with zipfile.ZipFile(source) as archive:files={name:archive.read(name) for name in archive.namelist()}
mp_name=next(name for name in files if 'masterpage' in name.lower() and name.endswith('.xml'))
mp=ET.fromstring(files[mp_name]);section=ET.fromstring(files['Contents/section0.xml'])
local=lambda e:e.tag.split('}')[-1]
if mode=='table':
    table=next(e for e in section.iter() if local(e)=='tbl')
    run=next(e for e in mp.iter() if local(e)=='run');run.append(copy.deepcopy(table))
    files[mp_name]=ET.tostring(mp,encoding='utf-8',xml_declaration=True)
elif mode=='italic':
    ref=next(e for e in mp.iter() if local(e)=='run').attrib['charPrIDRef']
    header=ET.fromstring(files['Contents/header.xml'])
    shape=next(e for e in header.iter() if local(e)=='charPr' and e.attrib.get('id')==ref)
    namespace=shape.tag.split('}')[0]+'}';shape.append(ET.Element(namespace+'italic'))
    files['Contents/header.xml']=ET.tostring(header,encoding='utf-8',xml_declaration=True)
else:raise ValueError('Unsupported fixture mode')
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED) as archive:
    for name,data in files.items():archive.writestr(name,data)
