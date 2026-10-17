from pathlib import Path
from fractions import Fraction
import zipfile,xml.etree.ElementTree as E,copy,json,hashlib

root=Path(__file__).resolve().parent
source=root/'own-gulimche-threshold-left-no-ls.hwpx'
target=root/'own-gulimche-half-glyph-matrix-no-ls.hwpx'
manifest=root/'half-glyph-matrix-input-manifest.json'
assert not target.exists() and not manifest.exists()
hp='http://www.hancom.co.kr/hwpml/2011/paragraph'
local=lambda t:t.rsplit('}',1)[-1]
q=lambda n:'{'+hp+'}'+n
sha=lambda b:hashlib.sha256(b).hexdigest()
with zipfile.ZipFile(source) as z:
    entries=[(i,z.read(i.filename)) for i in z.infolist()]
    section=E.fromstring(z.read('Contents/section0.xml'))
    header=E.fromstring(z.read('Contents/header.xml'))
paras=list(section)
charprops=next(e for e in header.iter() if local(e.tag)=='charProperties')
style=next(e for e in charprops if e.attrib.get('id')=='7')
nextid=max(int(e.attrib['id']) for e in charprops)+1
ids={}
for height in [900,1100]:
    cp=copy.deepcopy(style);cp.set('id',str(nextid));cp.set('height',str(height))
    for k in next(e for e in cp if local(e.tag)=='ratio').attrib:
        next(e for e in cp if local(e.tag)=='ratio').set(k,'100')
    charprops.append(cp);ids[height]=nextid;nextid+=1
charprops.set('itemCnt',str(len(charprops)))
original=''.join(t.text or '' for t in paras[0].iter(q('t')))[:31]
prefixes={'A':original,'B':'가 '+'가'*4+' '+'가'*4+' '+'가'*6+'.'+'가'*2}
for mixture,prefix in prefixes.items():
    assert prefix.endswith('가가') and prefix.count('.')==1
    assert prefix.count('가')==(25 if mixture=='A' else 17)
section.clear()
records=[]
for height in [900,1100]:
    for mixture,prefix in prefixes.items():
        full_count=prefix.count('가');half_count=len(prefix)-full_count
        full4=(height//4)*4;half4=(Fraction(height,2)//4)*4
        base=full_count*full4+half_count*half4
        variants=[('all-spaces',prefix.replace('.',' '),[-4,0],0),
            ('two-periods',prefix.replace(' ','.',1),[4,8],2),
            ('latin-i',prefix.replace('.','i'),[0,4],1),
            ('latin-W',prefix.replace('.','W'),[0,4],1)]
        for variant,text_prefix,deltas,nonspace_half in variants:
            assert len(text_prefix)==len(prefix) and text_prefix.count('가')==full_count
            for delta in deltas:
                index=len(records)
                p=copy.deepcopy(paras[0] if index==0 else paras[1]);p.set('id',str(30000+index))
                table=next(e for e in p.iter() if local(e.tag)=='tbl');table.set('id',str(3100000000+index))
                width=base+delta;table.find(q('sz')).set('width',str(width))
                cell=next(e for e in table.iter() if local(e.tag)=='tc')
                next(e for e in cell if local(e.tag)=='cellSz').set('width',str(width))
                cp=next(e for e in cell.iter() if local(e.tag)=='p');cp.set('id',str(40000+index))
                run=next(e for e in cp if local(e.tag)=='run');run.set('charPrIDRef',str(ids[height]))
                text=text_prefix+'나'*5;next(e for e in cp.iter() if local(e.tag)=='t').text=text
                for parent in p.iter():
                    for child in list(parent):
                        if local(child.tag)=='linesegarray':parent.remove(child)
                section.append(p)
                nearest_hypothesis=base+nonspace_half*4
                records.append({'tableIndex':index,'heightHU':height,'ratio':100,'mixture':mixture,'variant':variant,
                    'fullCount':full_count,'halfCount':half_count,'spaceCount':text_prefix.count(' '),
                    'periodCount':text_prefix.count('.'),'latinI':text_prefix.count('i'),'latinW':text_prefix.count('W'),
                    'prefixScalars':len(text_prefix),'textSHA256':sha(text.encode()),'widthHU':width,
                    'allGlyphFloor4TotalHU':base,'spaceFloor4NonspaceNearest4TotalHU':nearest_hypothesis,
                    'predictedFirstBreakUnderMixedRounding':len(text_prefix) if width>=nearest_hypothesis else len(text_prefix)-1,
                    'scope':'Prediction, not oracle. Literal first-break expectation remains unchanged if Hancom disagrees.'})
assert len(records)==32 and not list(section.iter(q('linesegarray')))
with zipfile.ZipFile(target,'w') as z:
    for info,data in entries:
        z.writestr(info,E.tostring(section,encoding='utf-8',xml_declaration=True) if info.filename=='Contents/section0.xml' else E.tostring(header,encoding='utf-8',xml_declaration=True) if info.filename=='Contents/header.xml' else data)
manifest.write_text(json.dumps({'file':target.name,'sha256':sha(target.read_bytes()),'sourceSHA256':sha(source.read_bytes()),
    'tableCount':32,'records':records,'fixed':{'font':'GulimChe (굴림체)','alignment':'LEFT','ratioAllSlots':100,'relativeSizeAllSlots':100,'spacingAllSlots':0,'useFontSpace':False,'useKerning':False,'condense':0,'storedLineSegments':0},
    'scope':'Self-authored SPACE/period/i/W discrimination controls. No public text, no font program, no engine metric or fit tolerance change.'},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'file':str(target),'sha256':sha(target.read_bytes()),'tables':32},indent=2))
