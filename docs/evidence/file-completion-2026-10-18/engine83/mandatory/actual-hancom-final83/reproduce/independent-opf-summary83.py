import hashlib,json,zipfile,xml.etree.ElementTree as E
from pathlib import Path
base=Path('build/file-closure83-native-handoff');paths=[Path('build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx'),base/'mcst-final83-hancom.hwpx'];rows=[]
sha=lambda b:hashlib.sha256(b).hexdigest()
for path in paths:
 with zipfile.ZipFile(path)as z:t=E.fromstring(z.read('Contents/content.hpf'))
 metadata=[e for e in t.iter()if e.tag=='{http://www.idpf.org/2007/opf/}metadata'];assert len(metadata)==1
 meta=metadata[0];titles=[e for e in meta if e.tag=='{http://www.idpf.org/2007/opf/}title'];assert len(titles)==1
 values={'title':titles[0].text or ''}
 for target,name in [('subject','subject'),('author','creator'),('keywords','keyword'),('description','description')]:
  entries=[e for e in meta if e.tag=='{http://www.idpf.org/2007/opf/}meta' and e.attrib.get('name')==name];assert len(entries)==1
  values[target]=entries[0].text or ''
 rows.append({'file':str(path),'sha256':sha(path.read_bytes()),'fields':{k:{'characters':len(v),'sha256':sha(v.encode())}for k,v in values.items()}})
assert rows[0]['fields']==rows[1]['fields']
result={'schema':'independent-OPF-five-summary-fields-v1','files':rows,'equalFields':5,'sourceWrites':0,'scope':'Standard-library ZIP/XML parser only; exact original title and named creator/subject/keyword/description nodes, no engine parser and no string normalization. Public values are SHA256 and character length only.'}
with(base/'independent-opf-summary83.json').open('x',encoding='utf8')as f:json.dump(result,f,ensure_ascii=False,indent=2)
print(json.dumps({'equalFields':5,'authorCharacters':rows[0]['fields']['author']['characters']}))
