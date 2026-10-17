from pathlib import Path
import json,zipfile,hashlib,shutil,xml.etree.ElementTree as E
p=Path('build/gulimche-admission-candidate81');failed=p/'failed-exclusion-namespace-v4';assert not failed.exists();failed.mkdir()
for name in ['owned-exclusions.json','owned-exclusions']:
 src=p/name
 if src.is_dir():shutil.copytree(src,failed/name)
 else:shutil.copy2(src,failed/name)
for stage in ['baseline83','candidate-v4']:
 shutil.copy2(p/stage/'owned-exclusions.json',failed/(stage+'-collector.json'))
source=Path('build/line-fit-threshold80/own-gulimche-floor4-matrix-no-ls.hwpx');ns='http://www.hancom.co.kr/hwpml/2011/head';local=lambda x:x.rsplit('}',1)[-1];rows=[]
for entry in json.loads((p/'owned-exclusions.json').read_text(encoding='utf-8')):
 mode=entry['name'];edits=[]
 with zipfile.ZipFile(source)as original:
  header=E.fromstring(original.read('Contents/header.xml'))
  def change(e,key,value):
   old=e.get(key)
   if old!=value:edits.append({'element':local(e.tag),'id':e.get('id'),'attribute':key,'before':old,'after':value});e.set(key,value)
  if mode in ['other-font','hft','unknown-face','unknown-type']:
   for e in header.iter():
    if local(e.tag)=='font'and e.get('face')=='굴림체':
     key,value={'other-font':('face','바탕체'),'hft':('type','HFT'),'unknown-face':('face','JUEONY_UNOWNED_FACE'),'unknown-type':('type','UNKNOWN')}[mode];change(e,key,value)
  else:
   for cs in [e for e in header.iter()if local(e.tag)=='charPr']:
    if mode in ['bold','italic']:
     assert not any(local(e.tag)==mode for e in cs);E.SubElement(cs,'{'+ns+'}'+mode);edits.append({'element':'charPr','id':cs.get('id'),'addedChild':mode})
    elif mode in ['kerning','font-space']:change(cs,'useKerning'if mode=='kerning'else'useFontSpace','1')
    elif mode=='fractional-height':
     change(cs,'height','1050')
     for e in cs:
      if local(e.tag)=='relSz':
       for k in e.attrib.copy():change(e,k,'97')
    elif mode in ['zero-ratio','tracking']:
     for e in cs:
      if local(e.tag)==('ratio'if mode=='zero-ratio'else'spacing'):
       for k in e.attrib.copy():change(e,k,'0'if mode=='zero-ratio'else'1')
  assert edits,mode
  target=Path(entry['file'])
  with zipfile.ZipFile(target,'w')as out:
   for info in original.infolist():out.writestr(info,E.tostring(header,encoding='utf-8',xml_declaration=True)if info.filename=='Contents/header.xml'else original.read(info.filename))
  assert hashlib.sha256(target.read_bytes()).hexdigest()!=hashlib.sha256(source.read_bytes()).hexdigest()
  rows.append({**entry,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'edits':edits,'namespaceIndependentMutation':True})
(p/'owned-exclusions.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
f=p/'source-candidate-v4/tests/jueony_gulimche_admission.rs';s=f.read_text(encoding='utf-8');s=s.replace('"rawModelSHA256":model,"liveLayoutSHA256":sha(&serde_json::to_vec(&current).unwrap()),','"paragraphModelSHA256":model,"wholeModelSHA256":sha(&serde_json::to_vec(d.document()).unwrap()),"liveLayout":current,"liveLayoutSHA256":sha(&serde_json::to_vec(&current).unwrap()),');s=s.replace('"layoutSHA256":sha(&serde_json::to_vec(&state(&reopened)).unwrap()),','"layout":state(&reopened),"layoutSHA256":sha(&serde_json::to_vec(&state(&reopened)).unwrap()),');f.write_text(s,encoding='utf-8',newline='\n')
print('Fixed mutant fixtures:',len(rows),'actual edits:',sum(len(r['edits'])for r in rows))
