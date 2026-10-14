"""Create explicit advanced stored header originals from synthetic documents only."""
import copy,sys,zipfile,xml.etree.ElementTree as ET
source,target,mode=sys.argv[1:4]
with zipfile.ZipFile(source) as z:files={name:z.read(name) for name in z.namelist()}
root=ET.fromstring(files['Contents/section0.xml']);local=lambda e:e.tag.split('}')[-1]
header=next(e for e in root.iter() if local(e)=='header' and e.attrib.get('applyPageType')=='BOTH')
sub=next(e for e in header if local(e)=='subList')
if mode=='duplicate':
 parent=next(e for e in root.iter() if header in list(e));parent.append(copy.deepcopy(header))
elif mode=='table':
 table=next(e for e in root.iter() if local(e)=='tbl');run=next(e for e in sub.iter() if local(e)=='run');run.append(copy.deepcopy(table))
elif mode=='references':sub.set('hasNumRef','1')
elif mode=='center':sub.set('vertAlign','CENTER')
else:raise ValueError('Unsupported header fixture mode')
files['Contents/section0.xml']=ET.tostring(root,encoding='utf-8',xml_declaration=True)
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for name,data in files.items():z.writestr(name,data)
