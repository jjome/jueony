from pathlib import Path
import struct,zlib,json,hashlib
sha=lambda b:hashlib.sha256(b).hexdigest()
def records(raw):
 out=[];p=0
 while p<len(raw):
  assert p+4<=len(raw);h=struct.unpack_from('<I',raw,p)[0];p+=4;tag=h&1023;level=(h>>10)&1023;n=h>>20
  if n==4095:n=struct.unpack_from('<I',raw,p)[0];p+=4
  assert p+n<=len(raw);out.append((tag,level,raw[p:p+n]));p+=n
 return out
def streams(path):
 b=path.read_bytes();assert b[:8]==bytes.fromhex('d0cf11e0a1b11ae1');sector=1<<struct.unpack_from('<H',b,30)[0];mini=1<<struct.unpack_from('<H',b,32)[0];at=lambda n:b[(n+1)*sector:(n+2)*sector]
 fatIds=[struct.unpack_from('<I',b,76+i*4)[0] for i in range(109)];fatIds=[n for n in fatIds if n<0xfffffffa];assert len(fatIds)==struct.unpack_from('<I',b,44)[0];fat=b''.join(at(n) for n in fatIds)
 def chain(n,map):
  seen=set();out=[]
  while n<0xfffffffa:
   assert n not in seen and n*4+4<=len(map);seen.add(n);out.append(n);n=struct.unpack_from('<I',map,n*4)[0]
  return out
 directory=b''.join(at(n) for n in chain(struct.unpack_from('<I',b,48)[0],fat));entries=[]
 for p in range(0,len(directory),128):
  e=directory[p:p+128]
  if e[66]:entries.append({'name':e[:struct.unpack_from('<H',e,64)[0]-2].decode('utf-16le'),'type':e[66],'start':struct.unpack_from('<I',e,116)[0],'size':struct.unpack_from('<Q',e,120)[0]})
 r=next(e for e in entries if e['type']==5);miniRoot=b''.join(at(n) for n in chain(r['start'],fat));miniFat=b''.join(at(n) for n in chain(struct.unpack_from('<I',b,60)[0],fat));result={}
 for e in entries:
  if e['type']!=2:continue
  if e['size']<struct.unpack_from('<I',b,56)[0]:v=b''.join(miniRoot[n*mini:(n+1)*mini] for n in chain(e['start'],miniFat))
  else:v=b''.join(at(n) for n in chain(e['start'],fat))
  assert e['name'] not in result;result[e['name']]=v[:e['size']]
 compressed=struct.unpack_from('<I',result['FileHeader'],36)[0]&1
 result['DocInfo']=zlib.decompress(result['DocInfo'],-15) if compressed else result['DocInfo']
 return result,compressed
