from pathlib import Path
from fractions import Fraction
import zipfile,xml.etree.ElementTree as E,copy,json,hashlib

root=Path(__file__).resolve().parent
source=root/'own-gulimche-threshold-left-no-ls.hwpx'
target=root/'own-gulimche-floor4-matrix-no-ls.hwpx'
manifest=root/'floor4-matrix-input-manifest.json'
assert not target.exists() and not manifest.exists()
hp='http://www.hancom.co.kr/hwpml/2011/paragraph'
hh='http://www.hancom.co.kr/hwpml/2011/head'
q=lambda namespace,name:'{'+namespace+'}'+name
local=lambda name:name.rsplit('}',1)[-1]
sha=lambda b:hashlib.sha256(b).hexdigest()
with zipfile.ZipFile(source) as z:
    entries=[(i,z.read(i.filename)) for i in z.infolist()]
    section=E.fromstring(z.read('Contents/section0.xml'))
    header=E.fromstring(z.read('Contents/header.xml'))
    assert not any(i.filename.lower().endswith(('.ttf','.ttc','.otf')) for i in z.infolist())
paras=list(section)
assert len(paras)==12
charprops=next(e for e in header.iter() if local(e.tag)=='charProperties')
paraprops=next(e for e in header.iter() if local(e.tag)=='paraProperties')
source_char=next(e for e in charprops if e.attrib.get('id')=='7')
source_para=next(e for e in paraprops if e.attrib.get('id')=='20')
char_id=max(int(e.attrib['id']) for e in charprops)+1
para_id=max(int(e.attrib['id']) for e in paraprops)+1
styles={}
for height,ratio in [(900,100),(1000,97),(1100,100),(1100,97),(1200,100)]:
    style=copy.deepcopy(source_char)
    style.set('id',str(char_id));style.set('height',str(height))
    ratios=next(e for e in style if local(e.tag)=='ratio')
    for key in ratios.attrib:ratios.set(key,str(ratio))
    charprops.append(style);styles[height,ratio]=char_id;char_id+=1
justify=copy.deepcopy(source_para)
justify.set('id',str(para_id))
next(e for e in justify if local(e.tag)=='align').set('horizontal','JUSTIFY')
paraprops.append(justify)
charprops.set('itemCnt',str(len(charprops)))
paraprops.set('itemCnt',str(len(paraprops)))
first_text=''.join(e.text or '' for e in paras[0].iter(q(hp,'t')))
prefix_a=first_text[:31]
assert prefix_a.count('가')==25 and prefix_a.count(' ')==5 and prefix_a.count('.')==1
prefix_b='가 '+'가'*4+' '+'가'*4+' '+'가'*6+'.'+'가'*2
assert prefix_b.count('가')==17 and prefix_b.count(' ')==3 and prefix_b.count('.')==1
groups=[]
for height,ratio in styles:
    for name,prefix in [('A',prefix_a),('B',prefix_b)]:
        groups.append((height,ratio,name,prefix,'LEFT'))
for name,prefix in [('A',prefix_a),('B',prefix_b)]:
    groups.append((1100,97,name,prefix,'JUSTIFY'))
section.clear()
records=[]
for group,(height,ratio,name,prefix,alignment) in enumerate(groups):
    full=Fraction(height*ratio,100)
    half=Fraction(height*ratio,200)
    full4=(full//4)*4;half4=(half//4)*4
    full_count=prefix.count('가');half_count=len(prefix)-full_count
    threshold=full_count*full4+half_count*half4
    for delta in [-4,0,4]:
        index=len(records)
        p=copy.deepcopy(paras[0] if index==0 else paras[1])
        p.set('id',str(10000+index))
        table=next(e for e in p.iter() if local(e.tag)=='tbl')
        table.set('id',str(3000000000+index))
        width=threshold+delta
        table.find(q(hp,'sz')).set('width',str(width))
        cells=[e for e in table.iter() if local(e.tag)=='tc']
        assert len(cells)==1
        cell=cells[0]
        next(e for e in cell if local(e.tag)=='cellSz').set('width',str(width))
        cps=list(cell.iter(q(hp,'p')));assert len(cps)==1
        cp=cps[0];cp.set('id',str(20000+index))
        cp.set('paraPrIDRef',str(para_id if alignment=='JUSTIFY' else 20))
        runs=list(cp.iter(q(hp,'run')));assert len(runs)==1
        runs[0].set('charPrIDRef',str(styles[height,ratio]))
        texts=list(cp.iter(q(hp,'t')));assert len(texts)==1
        text=prefix+'나'*5
        texts[0].text=text
        for parent in p.iter():
            for child in list(parent):
                if local(child.tag)=='linesegarray':parent.remove(child)
        assert not list(p.iter(q(hp,'linesegarray')))
        section.append(p)
        ideal=full_count*full+half_count*half
        glyph1=full_count*(full//1)+half_count*(half//1)
        records.append({'tableIndex':index,'groupIndex':group,'heightHU':height,'points':height/100,
          'allLanguageRatioPercent':ratio,'alignment':alignment,'mixture':name,
          'fullwidthHangulCount':full_count,'halfwidthCount':half_count,
          'spaceCount':prefix.count(' '),'periodCount':prefix.count('.'),
          'prefixScalars':len(prefix),'textScalars':len(text),'textSHA256':sha(text.encode()),
          'widthHU':width,'deltaFromFloor4PredictionHU':delta,
          'advancePredictionHU':{'fullNatural':float(full),'halfNatural':float(half),
             'fullFloor4':full4,'halfFloor4':half4,'glyphFloor4Total':threshold,
             'idealTotal':float(ideal),'glyphFloor1Total':glyph1},
          'predictedFirstLineScalars':len(prefix) if delta>=0 else len(prefix)-1,
          'charPrIDRef':styles[height,ratio],'paraPrIDRef':int(cp.attrib['paraPrIDRef']),
          'boundaryCodepoints':[hex(ord(prefix[-1])),hex(ord('나'))]})
assert len(records)==36
with zipfile.ZipFile(target,'w') as z:
    for info,data in entries:
        replacement=E.tostring(section,encoding='utf-8',xml_declaration=True) if info.filename=='Contents/section0.xml' else E.tostring(header,encoding='utf-8',xml_declaration=True) if info.filename=='Contents/header.xml' else data
        z.writestr(info,replacement)
summary={'file':target.name,'sha256':sha(target.read_bytes()),'source':source.name,'sourceSHA256':sha(source.read_bytes()),
 'tableCount':36,'groupCount':12,'records':records,
 'scope':'Independent floor-4 advance hypothesis controls, not a claimed fit rule. Self-authored Hangul/ASCII only. No font programs, no stored line segments, unchanged table margins and font refs. Native Hancom UI readback is still required.',
 'fixed':{'font':'굴림체 (all seven language font refs preserved)','letterSpacingAllSlots':0,'relativeSizeAllSlots':100,'condense':0,'useFontSpace':False,'useKerning':False,'breakNonLatinWord':'KEEP_WORD','breakLatinWord':'KEEP_WORD','paragraphMarginsHU':0,'leftOrJustifyOnly':True}}
manifest.write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'file':str(target),'sha256':summary['sha256'],'tables':36,'groups':12,'widths':[r['widthHU'] for r in records]},indent=2))
