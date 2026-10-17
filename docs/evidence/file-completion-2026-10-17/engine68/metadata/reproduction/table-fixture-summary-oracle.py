"""Independent raw CFB PropertySet / OPF oracle over self-authored table fixtures."""
from pathlib import Path
import struct,json,hashlib,zipfile,xml.etree.ElementTree as ET,sys
root=Path(sys.argv[1]);output=Path(sys.argv[2]);files=[];errors=[]
keys=['title','subject','author','keywords','description']
def u32(b,o):return struct.unpack_from('<I',b,o)[0]
def cfb(path):
 b=path.read_bytes();assert b[:8]==bytes.fromhex('d0cf11e0a1b11ae1');size=1<<struct.unpack_from('<H',b,30)[0];mini=1<<struct.unpack_from('<H',b,32)[0]
 assert u32(b,72)==0,'External DIFAT is outside these small owned fixtures'
 def sector(i):assert 0<=i<(len(b)//size)-1;return b[(i+1)*size:(i+2)*size]
 fat=b''.join(sector(u32(b,76+4*i))for i in range(u32(b,44)))
 def chain(first,table):
  result=[]
  while first<0xfffffff0:
   assert first not in result and len(result)<10000;result.append(first);first=u32(table,first*4)
  return result
 def full(first):return b''.join(sector(i)for i in chain(first,fat))
 directory=full(u32(b,48));entries=[]
 for i in range(0,len(directory),128):
  n=struct.unpack_from('<H',directory,i+64)[0]
  if n>=2:entries.append((directory[i:i+n-2].decode('utf-16-le'),directory[i+66],u32(directory,i+116),struct.unpack_from('<Q',directory,i+120)[0]))
 roots=[e for e in entries if e[1]==5];summaries=[e for e in entries if e[0]=='\x05HwpSummaryInformation'];assert len(roots)==1 and len(summaries)==1,'Missing/ambiguous summary owner'
 r=roots[0];summary=summaries[0];rawroot=full(r[2]);minifat=full(u32(b,60))
 data=(b''.join(rawroot[i*mini:(i+1)*mini]for i in chain(summary[2],minifat))if summary[3]<u32(b,56)else full(summary[2]))[:summary[3]]
 assert data[:2]==b'\xfe\xff' and u32(data,24)==1
 base=u32(data,44);count=u32(data,base+4);props={}
 for i in range(count):
  pid=u32(data,base+8+i*8);at=base+u32(data,base+12+i*8);assert pid not in props;props[pid]=at
 codepage=None
 if 1 in props:assert u32(data,props[1])==2;codepage=struct.unpack_from('<H',data,props[1]+4)[0]
 result={k:''for k in keys}
 for pid,key in zip(range(2,7),keys):
  if pid not in props:continue
  at=props[pid];kind=u32(data,at);count=u32(data,at+4)
  if kind==31:
   raw=data[at+8:at+8+count*2];assert len(raw)==count*2
   if count:assert raw[-2:]==b'\0\0';raw=raw[:-2]
   value=raw.decode('utf-16-le')
  elif kind==30:
   raw=data[at+8:at+8+count];assert len(raw)==count
   if count:assert raw[-1:]==b'\0';raw=raw[:-1]
   codec='ascii'if raw.isascii()else{65001:'utf8',949:'cp949',1252:'cp1252'}[codepage]
   value=raw.decode(codec)
  else:raise ValueError(f'Unsupported VT{kind} for PID{pid}')
  assert '\0'not in value;result[key]=value
 return result
def opf(path):
 with zipfile.ZipFile(path)as z:package=ET.fromstring(z.read('Contents/content.hpf'))
 ns='{http://www.idpf.org/2007/opf/}';meta=package.findall(ns+'metadata');assert len(meta)==1;meta=meta[0]
 result={k:''for k in keys};seen=set()
 for node in list(meta):
  key='title'if node.tag==ns+'title'else{'subject':'subject','creator':'author','keyword':'keywords','description':'description'}.get(node.get('name'))if node.tag==ns+'meta'else None
  if key:
   assert key not in seen and len(list(node))==0;seen.add(key);result[key]=node.text or ''
 return result
manifest=json.loads((root/'manifest.json').read_text(encoding='utf8'))
names=[row['name']for row in manifest['files']]
assert len(names)==17 and len(set(names))==17 and set(names)=={p.name for p in root.iterdir()if p.suffix.lower()in['.hwp','.hwpx']},('Expected the exact 17 owned fixture documents',names)
expected_hashes={row['name']:row['sha256']for row in manifest['files']}
for name in names:
 path=root/name;sha=hashlib.sha256(path.read_bytes()).hexdigest();assert sha==expected_hashes[name],name+' source manifest SHA mismatch'
 try:files.append({'name':name,'sha256':sha,'values':cfb(path)if path.suffix=='.hwp'else opf(path)})
 except Exception as error:errors.append({'name':name,'sha256':sha,'error':str(error)or type(error).__name__})
lookup={r['name']:r for r in files};comparisons=[]
for fmt in['hwp','hwpx']:
 a=lookup.get('outer-'+fmt+'.'+fmt);b=lookup.get('outer-'+fmt+'-hancom.'+fmt)
 if a and b:comparisons.append({'before':a['name'],'after':b['name'],'differences':[{'field':k,'before':a['values'][k],'after':b['values'][k]}for k in keys if a['values'][k]!=b['values'][k]]})
result={'files':files,'errors':errors,'comparisons':comparisons,'parserSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'scope':'Independent Python raw CFB PropertySet or ElementTree OPF reader; no Native metadata getter, normalization, default title or suppressed owner errors.'}
output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps({'files':len(files),'errors':errors,'comparisons':comparisons},ensure_ascii=False))
if errors:sys.exit(1)
