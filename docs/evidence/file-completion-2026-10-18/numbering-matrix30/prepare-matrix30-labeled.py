from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as E,copy,hashlib,json,re
b=Path('build/file-closure69-public/hancom-direct');src=b/'numbering-format-checkable-matrix30.hwpx';out=b/'numbering-format-checkable-matrix30-labeled.hwpx';manifest=json.loads((b/'numbering-format-checkable-matrix30-manifest.json').read_text(encoding='utf8'))
with ZipFile(src)as z:
 raw=z.read('Contents/header.xml');new=raw
 for case in manifest['cases']:
  pattern=rb'(<hh:numbering\b[^>]*\bid="'+str(case['id']).encode()+rb'"[^>]*>)(.*?)(</hh:numbering>)';m=re.search(pattern,new,re.S);assert m
  body=m[2];tag=re.search(rb'(<hh:paraHead\b[^>]*\blevel="8"[^>]*>)(.*?)(</hh:paraHead>)',body,re.S);assert tag
  token='JUEONY-NUMFMT-MATRIX-'+case['label'].upper();body=body[:tag.start(2)]+('^8 '+token).encode()+body[tag.end(2):];new=new[:m.start(2)]+body+new[m.end(2):];case['nativeIdentityToken']=token;case['level8Format']='^8 '+token
 with ZipFile(out,'w')as w:
  for i in z.infolist():w.writestr(copy.copy(i),new if i.filename=='Contents/header.xml'else z.read(i.filename))
manifest.update({'input':str(src),'inputSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'output':str(out),'outputSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'identityContract':'Each level8 format carries a unique self-authored token so native record deduplication/ID reindexing cannot lose the case mapping. Tokens are numbering-format data, not private metadata.'});(b/'numbering-format-checkable-matrix30-labeled-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8');print({'file':str(out),'bytes':out.stat().st_size,'sha256':manifest['outputSha256'],'uniqueCaseTokens':len(set(c['nativeIdentityToken']for c in manifest['cases']))})
