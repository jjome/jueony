"""Owned synthetic fixture mutations; not an application file writer."""
import sys,re,struct,zlib,zipfile
from pathlib import Path
source,target,mode,style_id=sys.argv[1:];style_id=int(style_id)
if mode in ['language','lock']:
 with zipfile.ZipFile(source) as old,zipfile.ZipFile(target,'w') as out:
  for entry in old.infolist():
   data=old.read(entry.filename)
   if entry.filename=='Contents/header.xml':
    s=data.decode('utf8');pattern=r'<hh:style\b[^>]*\bid="'+str(style_id)+r'"[^>]*>';matches=list(re.finditer(pattern,s));assert len(matches)==1
    tag=matches[0].group();key,value=('langID','1033') if mode=='language' else ('lockForm','1');changed,n=re.subn(key+r'="[^"]*"',key+'="'+value+'"',tag);assert n==1;s=s[:matches[0].start()]+changed+s[matches[0].end():];data=s.encode('utf8')
   out.writestr(entry,data)
else:
 assert mode=='raw-tail';b=bytearray(Path(source).read_bytes());assert b[:8]==bytes.fromhex('d0cf11e0a1b11ae1')
 u32=lambda data,o:struct.unpack_from('<I',data,o)[0];sector=1<<struct.unpack_from('<H',b,30)[0];mini=1<<struct.unpack_from('<H',b,32)[0]
 assert u32(b,44)<=109 and u32(b,72)==0,'small owned CFB only'
 def block(i):return b[(i+1)*sector:(i+2)*sector]
 fat=[]
 for i in struct.unpack_from('<109I',b,76)[:u32(b,44)]:fat.extend(struct.unpack('<'+str(sector//4)+'I',block(i)))
 def chain(start,table):
  seen=set();result=[]
  while start<0xfffffff0:
   assert 0<=start<len(table) and start not in seen;seen.add(start);result.append(start);start=table[start]
  return result
 def read_blocks(ids):return bytearray().join(block(i) for i in ids)
 def write_blocks(ids,data):
  assert len(data)<=len(ids)*sector
  for n,i in enumerate(ids):b[(i+1)*sector:(i+2)*sector]=data[n*sector:(n+1)*sector].ljust(sector,b'\0')
 dirs=chain(u32(b,48),fat);directory=read_blocks(dirs);root=None;entry=None
 for o in range(0,len(directory),128):
  n=struct.unpack_from('<H',directory,o+64)[0];name=directory[o:o+n-2].decode('utf-16le') if n>=2 else ''
  if directory[o+66]==5:root=o
  if name=='DocInfo':entry=o
 assert root is not None and entry is not None
 size=struct.unpack_from('<Q',directory,entry+120)[0];start=u32(directory,entry+116);is_mini=size<u32(b,56)
 if is_mini:
  mini_table=struct.unpack('<'+str(len(chain(u32(b,60),fat))*sector//4)+'I',read_blocks(chain(u32(b,60),fat)))
  ids=chain(start,mini_table);root_ids=chain(u32(directory,root+116),fat);stream=read_blocks(root_ids);data=bytearray().join(stream[i*mini:(i+1)*mini] for i in ids)[:size];capacity=len(ids)*mini
 else:ids=chain(start,fat);data=read_blocks(ids)[:size];capacity=len(ids)*sector
 raw=bytearray(zlib.decompress(data,-15));offset=0;index=0;found=False
 while offset<len(raw):
  h=u32(raw,offset);offset+=4;length=h>>20
  if length==4095:length=u32(raw,offset);offset+=4
  if h&1023==26:
   if index==style_id:assert length>=10;raw[offset+length-2:offset+length]=b'\x34\x12';found=True;break
   index+=1
  offset+=length
 assert found
 candidates=[]
 for strategy in [zlib.Z_DEFAULT_STRATEGY,zlib.Z_FILTERED,zlib.Z_RLE,zlib.Z_HUFFMAN_ONLY]:
  c=zlib.compressobj(9,zlib.DEFLATED,-15,8,strategy);candidates.append(c.compress(raw)+c.flush())
 packed=min(candidates,key=len);assert len(packed)<=capacity,(len(packed),capacity);payload=packed.ljust(capacity,b'\0')
 if is_mini:
  for n,i in enumerate(ids):stream[i*mini:(i+1)*mini]=payload[n*mini:(n+1)*mini]
  write_blocks(root_ids,stream)
 else:write_blocks(ids,payload)
 struct.pack_into('<Q',directory,entry+120,len(packed));write_blocks(dirs,directory);Path(target).write_bytes(b)
