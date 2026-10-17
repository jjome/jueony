from pathlib import Path
from zipfile import ZipFile
import copy,re,json,hashlib,xml.etree.ElementTree as E
b=Path('build/file-closure69-public/hancom-direct');src=b/'numbering-format-checkable-matrix30-labeled.hwpx';dst=b/'numbering-format-checkable-matrix30-used.hwpx';m=json.loads((b/'numbering-format-checkable-matrix30-labeled-manifest.json').read_text(encoding='utf8'))
with ZipFile(src)as z:
 h=z.read('Contents/header.xml');body=z.read('Contents/section0.xml');r=E.fromstring(h);props=next(n for n in r.iter()if n.tag.endswith('paraProperties'));first=max(int(n.get('id'))for n in props)+1
 template=re.search(rb'<hh:paraPr\b(?=[^>]*\bid="0")\s[^>]*>.*?</hh:paraPr>',h,re.S);assert template
 newprops=[];paras=[]
 for index,c in enumerate(m['cases']):
  pid=first+index;p=template.group();p=re.sub(rb'\bid="0"',f'id="{pid}"'.encode(),p,count=1);heading=re.search(rb'<hh:heading\b[^>]*/>',p);assert heading;p=p[:heading.start()]+f'<hh:heading type="NUMBER" idRef="{c["id"]}" level="0"/>'.encode()+p[heading.end():];newprops.append(p)
  label=c['nativeIdentityToken'];paras.append(f'<hp:p id="{index+1}" paraPrIDRef="{pid}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t>{label}</hp:t></hp:run></hp:p>'.encode());c['bodyParagraphId']=index+1;c['paraPrID']=pid;c['headingRefType']='NUMBER';c['headingRefId']=c['id']
 opening=re.search(rb'<hh:paraProperties\b[^>]*>',h);assert opening;tag=opening.group();n=re.search(rb'itemCnt="(\d+)"',tag);assert n;tag=tag[:n.start(1)]+str(len(props)+30).encode()+tag[n.end(1):];newh=h[:opening.start()]+tag+h[opening.end():];newh=newh.replace(b'</hh:paraProperties>',b''.join(newprops)+b'</hh:paraProperties>');newbody=body.replace(b'</hs:sec>',b''.join(paras)+b'</hs:sec>')
 with ZipFile(dst,'w')as w:
  for i in z.infolist():w.writestr(copy.copy(i),newh if i.filename=='Contents/header.xml'else newbody if i.filename=='Contents/section0.xml'else z.read(i.filename))
 with ZipFile(dst)as w:changes=[n for n in z.namelist()if z.read(n)!=w.read(n)]
 assert changes==['Contents/header.xml','Contents/section0.xml']or set(changes)=={'Contents/header.xml','Contents/section0.xml'}
m.update({'input':str(src),'inputSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'output':str(dst),'outputSha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'sourceContent':'Self-authored own matrix labels only; thirty body paragraphs reference every added numbering definition via distinct ParaPr heading NUMBER.','memberPayloadChanges':changes,'all30DefinitionsReferencedByBody':True});(b/'numbering-format-checkable-matrix30-used-manifest.json').write_text(json.dumps(m,indent=2)+'\n',encoding='utf8');print({'file':str(dst),'bytes':dst.stat().st_size,'sha256':m['outputSha256'],'usedDefinitions':30,'newParaPrIds':[first,first+29]})
