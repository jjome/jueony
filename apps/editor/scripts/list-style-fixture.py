import re,sys,zipfile
source,target,mode=sys.argv[1:]
with zipfile.ZipFile(source) as original,zipfile.ZipFile(target,'w') as out:
 for item in original.infolist():
  data=original.read(item.filename)
  if item.filename=='Contents/header.xml':
   s=data.decode('utf8')
   if mode=='check':s,n=re.subn(r'(<hh:bullet\b[^>]*)(>)',r'\1 checkedChar="☑"\2',s,count=1)
   elif mode=='image':s,n=re.subn(r'(<hh:bullet\b[^>]*useImage=")0(")',r'\g<1>1\2',s,count=1)
   elif mode=='invalid-char':s,n=re.subn(r'(<hh:bullet\b.*?<hh:paraHead\b[^>]*charPrIDRef=")\d+(\")',r'\g<1>65000\2',s,count=1,flags=re.S)
   else:raise ValueError(mode)
   assert n==1,mode
   data=s.encode('utf8')
  out.writestr(item,data)
