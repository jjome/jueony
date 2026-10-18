"""Read-only installed HWT structure survey. Emits no vendor XML, values or document text."""
import importlib.util,sys,json,hashlib,struct,zlib
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as E
repo=Path(__file__).resolve().parents[2]
helper=repo/'build/rhwp-engine/source-7c10dba04ed65742/scripts/secd_tail_survey.py'
spec=importlib.util.spec_from_file_location('read_cfb_own',helper);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
folder=Path('C:/Program Files (x86)/Hnc/Office 2024/HOffice130/Shared/HwpTemplate/XML/ko-KR')
out=Path(sys.argv[1]).resolve();assert not out.exists()
sha=lambda b:hashlib.sha256(b).hexdigest()
results=[]
for file in sorted(folder.glob('*.hwt')):
 blob=file.read_bytes();cfb=mod.Cfb(blob);directory=cfb._read_chain(cfb.first_dir,None);paths={};visiting=set()
 def walk(index,parent):
  if index in [mod.FREESECT,mod.ENDOFCHAIN]:return
  assert index not in visiting and index<len(cfb.dir_entries)
  visiting.add(index);raw=directory[index*128:(index+1)*128];left,right,child=struct.unpack_from('<III',raw,0x44)
  walk(left,parent);entry=cfb.dir_entries[index];name=parent+'/'+entry['name'];paths[name]=index
  if entry['type']==1:walk(child,name)
  walk(right,parent)
 walk(struct.unpack_from('<I',directory,0x4c)[0],'')
 row={'path':str(file),'bytes':len(blob),'sha256':sha(blob),'streams':[]}
 for name in ['/XMLTemplate/Schema','/XMLTemplate/Instance','/XMLTemplate/_SchemaName']:
  entry=cfb.dir_entries[paths[name]];raw=cfb._read_mini_chain(entry['start'],entry['size']) if entry['size']<cfb.mini_cutoff else cfb._read_chain(entry['start'],entry['size'])
  stream={'path':name,'bytes':len(raw),'sha256':sha(raw)}
  if name.endswith('_SchemaName'):decoded=raw;stream['compression']='none'
  else:decoded=zlib.decompress(raw,-15);stream['compression']='raw-deflate'
  length=struct.unpack_from('<I',decoded)[0];assert length==len(decoded)-4 and length%2==0
  text=decoded[4:].decode('utf-16-le');stream['declaredUtf16Bytes']=length
  if not name.endswith('_SchemaName'):
   assert '<!DOCTYPE' not in text and '<!ENTITY' not in text
   tree=E.fromstring(text);stream.update({'rootTag':tree.tag,'rootAttributeNames':sorted(tree.attrib),'elements':sum(1 for _ in tree.iter()),'tagCounts':dict(Counter(n.tag for n in tree.iter())),'attributeNames':sorted({a for n in tree.iter()for a in n.attrib})})
  row['streams'].append(stream)
 assert file.read_bytes()==blob
 results.append(row)
value={'scope':'Installed files read-only structure metadata only; no document/vendor XML text or font payload copied. This is not a supported HWT reader or editor.','files':results,'conclusion':'Schema streams contain length-prefixed UTF16LE XSD compressed as raw deflate. Instance streams contain XMLELEMENT mapping trees with SchemaXPath/field bindings; they are not ordinary XML instance documents. HWT editing requires explicit mapping/body synchronization, not the standalone XML workspace.','helperSha256':sha(helper.read_bytes()),'scriptSha256':sha(Path(__file__).read_bytes())}
out.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'files':len(results),'schemaRoots':dict(Counter(r['streams'][0]['rootTag']for r in results)),'instanceRoots':dict(Counter(r['streams'][1]['rootTag']for r in results)),'bytes':out.stat().st_size}))
