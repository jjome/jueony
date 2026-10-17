from pathlib import Path
import zipfile,xml.etree.ElementTree as E,copy,json,hashlib
p=Path('build/gulimche-admission-candidate81');source=Path('build/line-fit-threshold80/own-gulimche-floor4-matrix-no-ls.hwpx');out=p/'owned-glyph-probe.hwpx'
assert not out.exists()
hp='http://www.hancom.co.kr/hwpml/2011/paragraph';q=lambda n:'{'+hp+'}'+n
with zipfile.ZipFile(source) as z:
 section=E.fromstring(z.read('Contents/section0.xml'));paras=list(section);section.clear();records=[]
 for index,(height,ratio,full,space,ascii_width) in enumerate([(900,100,900,448,452),(1000,97,968,484,484),(1100,100,1100,548,552),(1100,97,1064,532,532),(1200,100,1200,600,600)]):
  paragraph=copy.deepcopy(paras[index*6]);table=next(paragraph.iter(q('tbl')));table.find(q('sz')).set('width','40000');cell=next(table.iter(q('tc')));next(cell.iter(q('cellSz'))).set('width','40000');texts=list(cell.iter(q('t')));assert len(texts)==1;texts[0].text='가나 .iW';section.append(paragraph)
  records.append({'parentParagraph':index,'heightHU':height,'ratioPercent':ratio,'glyphs':[{'character':c,'expectedAdvanceHU':width} for c,width in zip('가나 .iW',[full,full,space,ascii_width,ascii_width,ascii_width])]})
 with zipfile.ZipFile(out,'w') as target:
  for info in z.infolist():target.writestr(info,E.tostring(section,encoding='utf-8',xml_declaration=True) if info.filename=='Contents/section0.xml' else z.read(info.filename))
manifest={'file':str(out).replace('\\','/'),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'records':records,'scope':'Own plain no-LS TTF glyph dispatch probe; this file is not a new Hancom UI oracle. Expected natural advances combine the fixed 68-table Hancom threshold evidence and verified same-width font hmtx.'}
(p/'glyph-probe.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(manifest['sha256'])
