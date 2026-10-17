from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as E,copy,hashlib,json,re
b=Path('build/file-closure69-public/hancom-direct');src=b/'numbering-matrix-own-base.hwpx';out=b/'numbering-format-checkable-matrix30.hwpx'
names=['DIGIT','CIRCLED_DIGIT','ROMAN_CAPITAL','ROMAN_SMALL','LATIN_CAPITAL','LATIN_SMALL','CIRCLED_LATIN_CAPITAL','CIRCLED_LATIN_SMALL','HANGUL_SYLLABLE','CIRCLED_HANGUL_SYLLABLE','HANGUL_JAMO','CIRCLED_HANGUL_JAMO','HANGUL_PHONETIC','IDEOGRAPH','CIRCLED_IDEOGRAPH']
with ZipFile(src)as z:
 raw=z.read('Contents/header.xml');root=E.fromstring(raw);nums=next(n for n in root.iter()if n.tag.endswith('numberings'));original=[E.tostring(x,encoding='unicode')for x in nums];ids=[int(x.get('id'))for x in nums];first=max(ids,default=0)+1;rows=[];fragments=[]
 for code,name in enumerate(names):
  for checked in [0,1]:
   id=first+len(rows);children=[]
   for level in range(1,11):
    fmt=name if level==8 else'DIGIT';c=checked if level==8 else 0;text='^8'if level==8 else'^N'if level<8 else''
    children.append(f'<hh:paraHead start="1" level="{level}" align="LEFT" useInstWidth="0" autoIndent="0" widthAdjust="0" textOffsetType="PERCENT" textOffset="0" numFormat="{fmt}" charPrIDRef="0" checkable="{c}">{text}</hh:paraHead>')
   fragment=f'<hh:numbering id="{id}" start="1">'+''.join(children)+'</hh:numbering>';fragments.append(fragment);rows.append({'id':id,'code':code,'numFormat':name,'level8Checkable':checked,'level8Format':'^8','levels9And10':{'numFormat':'DIGIT','checkable':0,'text':''},'label':f'fmt{code:02d}-checkable{checked}'})
 m=re.search(rb'<hh:numberings\b[^>]*>',raw);assert m;opening=m.group();count=re.search(rb'itemCnt="(\d+)"',opening);assert count;newopen=opening[:count.start(1)]+str(len(ids)+30).encode()+opening[count.end(1):];new=raw[:m.start()]+newopen+raw[m.end():];assert new.count(b'</hh:numberings>')==1;new=new.replace(b'</hh:numberings>',''.join(fragments).encode()+b'</hh:numberings>')
 with ZipFile(out,'w')as w:
  for i in z.infolist():w.writestr(copy.copy(i),new if i.filename=='Contents/header.xml'else z.read(i.filename))
 parsed=E.fromstring(new);newnums=next(n for n in parsed.iter()if n.tag.endswith('numberings'));assert[E.tostring(x,encoding='unicode')for x in list(newnums)[:len(original)]]==original;assert len(newnums)==len(ids)+30
 proof={'status':'SELF_AUTHORED_EMPTY_DOCUMENT_MATRIX30','input':str(src),'inputSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'output':str(out),'outputSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'sourceContent':'Self-authored empty document, no public/user text or font programs','baseOriginalDefinitionIds':ids,'baseOriginalDefinitionsAllValuesUnchanged':True,'numberingCount':len(ids)+30,'addedDefinitions':30,'memberPayloadOnlyHeaderChanged':True,'cases':rows}
 (b/'numbering-format-checkable-matrix30-manifest.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf8');print({'file':str(out),'bytes':out.stat().st_size,'sha256':proof['outputSha256'],'originalIds':ids,'cases':30})

