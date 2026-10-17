from pathlib import Path
import argparse,copy,re,zipfile,xml.etree.ElementTree as E,json,hashlib
ap=argparse.ArgumentParser(description='Reproduce self-authored table-height controls and excluded/extended source-cache fixtures. No Hancom SaveAs is simulated.')
ap.add_argument('controls',type=Path);ap.add_argument('output',type=Path);args=ap.parse_args();args.output.mkdir(parents=True,exist_ok=True)
def entries(path):
 with zipfile.ZipFile(path)as z:return [(i,z.read(i.filename))for i in z.infolist()]
def write(path,parts,section):
 with zipfile.ZipFile(path,'w')as z:
  for info,b in parts:z.writestr(info,section if info.filename=='Contents/section0.xml'else b)
parts=entries(args.controls/'auto-zero.hwpx');s=next(b for i,b in parts if i.filename=='Contents/section0.xml').decode('utf-8');tbl=re.search(r'<hp:tbl\b[\s\S]*?</hp:tbl>',s);assert tbl
for name,height,protect,cellheight in [('auto-zero',0,0,282),('large',9000,0,282),('small-protected',1400,1,282),('large-protected',9000,1,282),('explicit-rows-9000',9000,0,3000)]:
 t=tbl.group();t=re.sub(r'(<hp:sz\b[^>]*\bheight=")\d+("[^>]*\bprotect=")\d+("[^>]*/>)',lambda m:m[1]+str(height)+m[2]+str(protect)+m[3],t,count=1);t=re.sub(r'(<hp:cellSz\b[^>]*\bheight=")\d+("[^>]*/>)',lambda m:m[1]+str(cellheight)+m[2],t)
 generated=(s[:tbl.start()]+t+s[tbl.end():]).encode();write(args.output/(name+'.hwpx'),parts,generated)
 with zipfile.ZipFile(args.controls/(name+'.hwpx'))as z:assert z.read('Contents/section0.xml')==generated,name+' XML source mismatch'
# The actual Hancom SaveAs file remains the independent source, never generated.
parts=entries(args.controls/'large-hancom.hwpx');s=next(b for i,b in parts if i.filename=='Contents/section0.xml').decode();tbl=re.search(r'<hp:tbl\b[\s\S]*?</hp:tbl>',s);t=tbl.group()
variants={'offset':t.replace('vertOffset="0"','vertOffset="300"',1),'negative-offset':t.replace('vertOffset="0"','vertOffset="-300"',1),'page-absolute':t.replace('vertRelTo="PARA"','vertRelTo="PAGE"',1),'protected':t.replace('heightRelTo="ABSOLUTE" protect="0"','heightRelTo="ABSOLUTE" protect="1"',1),'row-break':t.replace('pageBreak="NONE"','pageBreak="ROW"',1),'cell-protected':t.replace('<hp:tc name="" header="0" hasMargin="1" protect="0"','<hp:tc name="" header="0" hasMargin="1" protect="1"',1),'field-name':t.replace('<hp:tc name=""','<hp:tc name="source"',1),'no-adjust':t.replace('noAdjust="0"','noAdjust="1"',1),'relative-height':t.replace('heightRelTo="ABSOLUTE"','heightRelTo="PAPER"',1)}
negative=args.output/'excluded';negative.mkdir(exist_ok=True)
for name,new in variants.items():
 assert new!=t,name;write(negative/(name+'.hwpx'),parts,(s[:tbl.start()]+new+s[tbl.end():]).encode())
for name,new in [('gap',s.replace('vertpos="7347"','vertpos="7447"',1)),('reverse',s.replace('vertpos="7347"','vertpos="1500"',1)),('column-origin',s.replace('vertpos="0" vertsize=','vertpos="100" vertsize=',1))]:
 assert new!=s,name;write(negative/(name+'.hwpx'),parts,new.encode())
(negative/'dense-original.hwpx').write_bytes((args.controls/'large.hwpx').read_bytes())
parts=entries(args.controls/'large.hwpx');source=next(b for i,b in parts if i.filename=='Contents/section0.xml');hp='{http://www.hancom.co.kr/hwpml/2011/paragraph}';extended=args.output/'extended';extended.mkdir(exist_ok=True)
for total in [4,5]:
 root=E.fromstring(source);template=root[3]
 for i in range(total-3):
  added=copy.deepcopy(template);root.insert(4+i,added);added.find('.//'+hp+'tbl').set('id',str(4+i))
 for i,para in enumerate(root):
  para.set('id',str(1000+i*100))
  for line in para.findall('./'+hp+'linesegarray/'+hp+'lineseg'):line.set('vertpos',str(i*1600))
  for k,cellpara in enumerate(para.findall('.//'+hp+'p')):cellpara.set('id',str(1001+i*100+k))
 write(extended/('stack-'+str(total)+'.hwpx'),parts,E.tostring(root,encoding='utf-8'))
print('Reproduced 5 authored control XMLs exactly, 13 excluded variants, and 4/5-table topology fixtures. No actual Hancom outputs generated.')
