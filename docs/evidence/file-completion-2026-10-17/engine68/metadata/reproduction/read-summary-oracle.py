"""Independent small-owned-file oracle, not application parsing or write code."""
from pathlib import Path
import struct,json,hashlib,zipfile,xml.etree.ElementTree as ET,sys
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).parent/'own-artifacts'
expected=json.loads((root/'expected-summary.json').read_text(encoding='utf8'))
def u32(b,o):return struct.unpack_from('<I',b,o)[0]
def cfb_summary(path):
 b=path.read_bytes();assert b[:8]==bytes.fromhex('d0cf11e0a1b11ae1')
 size=1<<struct.unpack_from('<H',b,30)[0];mini=1<<struct.unpack_from('<H',b,32)[0]
 assert u32(b,72)==0,'Own small fixture does not use external DIFAT'
 def sector(i):assert 0<=i<(len(b)//size)-1;return b[(i+1)*size:(i+2)*size]
 fat=b''.join(sector(u32(b,76+4*i))for i in range(u32(b,44)))
 def chain(first,table):
  found=[]
  while first<0xfffffff0:
   assert first not in found and len(found)<10000
   found.append(first);first=u32(table,first*4)
  return found
 def full(first):return b''.join(sector(i)for i in chain(first,fat))
 directory=full(u32(b,48));entries=[]
 for i in range(0,len(directory),128):
  n=struct.unpack_from('<H',directory,i+64)[0]
  if n>=2:entries.append((directory[i:i+n-2].decode('utf-16-le'),directory[i+66],u32(directory,i+116),struct.unpack_from('<Q',directory,i+120)[0]))
 r=next(e for e in entries if e[1]==5);summary=next(e for e in entries if e[0]=='\x05HwpSummaryInformation');rawroot=full(r[2]);minifat=full(u32(b,60))
 data=(b''.join(rawroot[i*mini:(i+1)*mini]for i in chain(summary[2],minifat))if summary[3]<u32(b,56)else full(summary[2]))[:summary[3]]
 base=u32(data,44);count=u32(data,base+4);result={}
 names={2:'title',3:'subject',4:'author',5:'keywords',6:'description'}
 for i in range(count):
  pid=u32(data,base+8+i*8);at=base+u32(data,base+12+i*8)
  if pid in names:
   assert u32(data,at)==31,'Owned output must use VT_LPWSTR'
   count=u32(data,at+4);units=data[at+8:at+8+count*2];assert units[-2:]==b'\0\0'
   result[names[pid]]=units[:-2].decode('utf-16-le')
 return result
def opf_summary(path):
 with zipfile.ZipFile(path)as z:root=ET.fromstring(z.read('Contents/content.hpf'))
 ns='{http://www.idpf.org/2007/opf/}';metadata=root.find(ns+'metadata');assert metadata is not None
 result={'title':metadata.findtext(ns+'title',default='')};names={'subject':'subject','creator':'author','keyword':'keywords','description':'description'}
 for e in metadata.findall(ns+'meta'):
  if e.get('name')in names:result[names[e.get('name')]]=e.text or ''
 return result
results=[]
for name,reader in [('summary.hwp',cfb_summary),('summary.hwpx',opf_summary)]:
 path=root/name;values=reader(path);assert values==expected,(name,values,expected)
 results.append({'file':name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'fiveFieldsExact':True,'values':values})
(root/'independent-summary-oracle.json').write_text(json.dumps({'results':results,'failures':[],'scope':'Independent Python CFB/PropertySet VT_LPWSTR and XML ElementTree OPF readers over our generated fixtures. No Native getter reused. Not a Hancom UI result.'},ensure_ascii=False,indent=2),encoding='utf8')
print('PASS independent HWP PropertySet and HWPX OPF values match all five known strings')
