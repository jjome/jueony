import hashlib,json,zipfile,xml.etree.ElementTree as ET
from pathlib import Path
base=Path('build/file-closure83-native-handoff')
paths=[Path('build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx'),base/'mcst-final83-hancom.hwpx']
def sha(b):return hashlib.sha256(b).hexdigest()
def name(s):return s.split('}')[-1]
def canonical(e):return {'tag':e.tag,'attributes':dict(sorted(e.attrib.items())),'text':e.text if e.text and e.text.strip() else '', 'children':[canonical(x) for x in e]}
def safe(v):
 if isinstance(v,str):
  try:return {'numericLexical':v,'number':float(v)} if v.strip()==v and v else {'characters':len(v),'sha256':sha(v.encode())}
  except ValueError:return {'characters':len(v),'sha256':sha(v.encode())}
 return v
def differences(a,b,p='$',out=None):
 if out is None:out=[]
 if isinstance(a,dict) and isinstance(b,dict):
  for k in sorted(set(a)|set(b)):differences(a.get(k),b.get(k),p+'/'+k,out)
 elif isinstance(a,list) and isinstance(b,list):
  if len(a)!=len(b):out.append({'path':p+'/length','before':len(a),'after':len(b)})
  for i in range(max(len(a),len(b))):differences(a[i] if i<len(a) else None,b[i] if i<len(b) else None,p+'/'+str(i),out)
 elif a!=b:out.append({'path':p,'before':safe(a),'after':safe(b)})
 return out
values=[]
for path in paths:
 raw=path.read_bytes();notes=[]
 with zipfile.ZipFile(path) as z:
  entries=[n for n in z.namelist() if n.startswith('Contents/section') and n.endswith('.xml')]
  for entry in sorted(entries):
   xml=z.read(entry)
   assert b'<!DOCTYPE' not in xml and b'<!ENTITY' not in xml
   tree=ET.fromstring(xml)
   for e in tree.iter():
    if name(e.tag) in ('footNotePr','endNotePr'):notes.append({'entry':entry,'kind':name(e.tag),'value':canonical(e)})
 values.append({'file':str(path),'sha256':sha(raw),'bytes':len(raw),'notes':notes})
assert len(values[0]['notes'])==2 and len(values[1]['notes'])==2
out={'schema':'independent-standard-library-xml-note-property-evidence-v1','files':[{'file':v['file'],'sha256':v['sha256'],'bytes':v['bytes'],'notes':[{'entry':n['entry'],'kind':n['kind'],'allPropertiesSha256':sha(json.dumps(n['value'],ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()),'nodes':1+len(n['value']['children']),'attributes':len(n['value']['attributes'])+sum(len(x['attributes']) for x in n['value']['children'])}for n in v['notes']]}for v in values], 'differences':differences(values[0]['notes'],values[1]['notes']),'sourceWrites':0,'scope':'Every XML note property attribute and ordered child element is compared exactly, namespaces included; no defaults inserted, no attribute dropped, no numeric tolerance. Public document XML/body is not emitted.'}
for i,p in enumerate(paths):assert sha(p.read_bytes())==values[i]['sha256']
with (base/'independent-note-xml83.json').open('x',encoding='utf8')as f:json.dump(out,f,ensure_ascii=False,indent=2)
print(json.dumps({'notes':[len(v['notes'])for v in values],'differences':len(out['differences'])}))
