from pathlib import Path
import struct,zlib,json,hashlib
at=Path(__file__).parent
u32=lambda b,o:struct.unpack_from('<I',b,o)[0]
def streams(path):
 b=path.read_bytes();assert b[:8]==bytes.fromhex('d0cf11e0a1b11ae1');size=1<<struct.unpack_from('<H',b,30)[0];mini=1<<struct.unpack_from('<H',b,32)[0];assert u32(b,72)==0
 def sector(i):assert 0<=i<(len(b)//size)-1;return b[(i+1)*size:(i+2)*size]
 fat=b''.join(sector(u32(b,76+4*i))for i in range(u32(b,44)))
 def chain(first,t):
  result=[]
  while first<0xfffffff0:
   assert first not in result and len(result)<10000;result.append(first);first=u32(t,first*4)
  return result
 def full(first):return b''.join(sector(i)for i in chain(first,fat))
 directory=full(u32(b,48));entries=[]
 for i in range(0,len(directory),128):
  n=struct.unpack_from('<H',directory,i+64)[0]
  if n>=2:entries.append((directory[i:i+n-2].decode('utf-16-le'),directory[i+66],u32(directory,i+116),struct.unpack_from('<Q',directory,i+120)[0]))
 roots=[e for e in entries if e[1]==5];assert len(roots)==1;rawroot=full(roots[0][2]);minifat=full(u32(b,60));out={}
 for name,kind,first,length in entries:
  if kind!=2:continue
  assert name not in out
  raw=b''.join(rawroot[i*mini:(i+1)*mini]for i in chain(first,minifat))if length<u32(b,56)else full(first)
  assert len(raw)>=length;out[name]=raw[:length]
 return out
records=[]
for name in ['support/negative.hwp','hancom-current/negative.hwp']:
 path=at/name;ss=streams(path);body=ss['Section0'];compressed=bool(u32(ss['FileHeader'],36)&1);body=zlib.decompress(body,-15)if compressed else body
 cursor=0;para=-1;roots=[]
 while cursor<len(body):
  header=u32(body,cursor);cursor+=4;tag=header&1023;level=(header>>10)&1023;length=header>>20
  if length==4095:length=u32(body,cursor);cursor+=4
  payload=body[cursor:cursor+length];assert len(payload)==length;cursor+=length
  if tag==66 and level==0:para+=1;roots.append({'para':para,'textUnits':u32(payload,0)&0x7fffffff,'lines':[],'controls':[]})
  elif para>=0 and tag==69 and level==1:
   assert length%36==0
   roots[-1]['lines']=[dict(zip(['textStart','verticalPos','lineHeight','textHeight','baseline','lineSpacing','columnStart','segmentWidth','tag'],struct.unpack_from('<Iiiiiiiii',payload,i)))for i in range(0,length,36)]
  elif para>=0 and tag==71 and level==1:
   roots[-1]['controls'].append({'controlIdHex':payload[:4].hex(),'rawLength':length,'rawSha256':hashlib.sha256(payload).hexdigest(),'commonDwords':list(struct.unpack_from('<'+('I'*(min(len(payload),32)//4)),payload))})
 records.append({'name':name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'roots':roots})
result={'scope':'Independent CFB/inflate/record parser; original source and actual Hancom raw rows/control words only. No Native getters, source rewrite or cache normalization.','files':records}
(at/'negative-raw-origin-proof.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps(result,indent=2))

