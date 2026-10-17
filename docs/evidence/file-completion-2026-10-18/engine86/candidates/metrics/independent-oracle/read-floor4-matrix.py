from pathlib import Path
import zipfile,xml.etree.ElementTree as E,json,hashlib,sys

root=Path(__file__).resolve().parent
manifest=json.loads((root/'floor4-matrix-input-manifest.json').read_text(encoding='utf-8'))
source=root/manifest['file']
saved=root/(sys.argv[1] if len(sys.argv)>1 else 'hancom-gulimche-floor4-matrix.hwpx')
output=root/(sys.argv[2] if len(sys.argv)>2 else 'floor4-matrix-hancom-comparison.json')
assert saved.is_file() and not output.exists()
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(source.read_bytes())==manifest['sha256']
local=lambda name:name.rsplit('}',1)[-1]
def parse(path):
    with zipfile.ZipFile(path) as z:
        head=E.fromstring(z.read('Contents/header.xml'))
        section=E.fromstring(z.read('Contents/section0.xml'))
        dictionary=lambda tag:{e.attrib['id']:e for e in head.iter() if local(e.tag)==tag and 'id' in e.attrib}
        chars=dictionary('charPr');paras=dictionary('paraPr')
        fonts={face.attrib['lang'].lower():{f.attrib['id']:f for f in face if local(f.tag)=='font'} for face in head.iter() if local(face.tag)=='fontface'}
        records=[]
        def attrs(parent,tag):return next((dict(e.attrib) for e in parent.iter() if local(e.tag)==tag),None)
        for table in (e for e in section.iter() if local(e.tag)=='tbl'):
            cells=[e for e in table.iter() if local(e.tag)=='tc'];assert len(cells)==1
            cell=cells[0];ps=[e for e in cell.iter() if local(e.tag)=='p'];assert len(ps)==1
            p=ps[0];pr=paras[p.attrib['paraPrIDRef']]
            runs=[e for e in p if local(e.tag)=='run'];assert len(runs)==1
            char=chars[runs[0].attrib['charPrIDRef']]
            refs=attrs(char,'fontRef');assert refs is not None
            faceinfo={k:{'face':fonts[k][v].attrib['face'],'type':fonts[k][v].attrib.get('type'),'isEmbedded':fonts[k][v].attrib.get('isEmbedded')} for k,v in refs.items()}
            descriptor={k:[dict(c.attrib) for c in fonts[k][v]] for k,v in refs.items()}
            text=''.join(e.text or '' for e in p.iter() if local(e.tag)=='t')
            properties={'font':faceinfo,'height':char.attrib['height'],'useFontSpace':char.attrib.get('useFontSpace'),'useKerning':char.attrib.get('useKerning'),
                'ratio':attrs(char,'ratio'),'spacing':attrs(char,'spacing'),'relSz':attrs(char,'relSz'),'offset':attrs(char,'offset'),
                'bold':attrs(char,'bold'),'italic':attrs(char,'italic'),'condense':pr.attrib.get('condense'),'align':attrs(pr,'align'),'breakSetting':attrs(pr,'breakSetting'),'autoSpacing':attrs(pr,'autoSpacing'),
                'cellMargin':attrs(cell,'cellMargin'),'cellSz':attrs(cell,'cellSz'),
                'tableInMargin':attrs(table,'inMargin'),'tableSize':attrs(table,'sz'),
                'paragraphMargins':[dict(e.attrib) for e in pr.iter() if local(e.tag) in {'intent','left','right','prev','next'}]}
            records.append({'properties':properties,'descriptor':descriptor,'textSHA256':sha(text.encode()),'characters':len(text),
                'lineSegments':[dict(e.attrib) for e in p.iter() if local(e.tag)=='lineseg']})
        return records
a,b=parse(source),parse(saved)
assert len(a)==len(b)==36
results=[];failures=[];propertyChanges=[]
for expected,before,after in zip(manifest['records'],a,b):
    index=expected['tableIndex']
    assert before['textSHA256']==after['textSHA256']==expected['textSHA256']
    starts=[int(line['textpos']) for line in after['lineSegments']]
    if not len(starts)>=2 or starts[0]!=0 or starts[1]!=expected['predictedFirstLineScalars']:
        failures.append({'tableIndex':index,'expectedFirstBreak':expected['predictedFirstLineScalars'],'actualLineStarts':starts})
    changes={key:{'before':before['properties'][key],'after':after['properties'][key]} for key in before['properties'] if before['properties'][key]!=after['properties'][key]}
    if changes:propertyChanges.append({'tableIndex':index,'changes':changes})
    results.append({'tableIndex':index,'groupIndex':expected['groupIndex'],'heightHU':expected['heightHU'],'ratio':expected['allLanguageRatioPercent'],'mixture':expected['mixture'],'alignment':expected['alignment'],
        'widthHU':expected['widthHU'],'predictedThresholdHU':expected['advancePredictionHU']['glyphFloor4Total'],'predictedFirstBreak':expected['predictedFirstLineScalars'],'actualLineStarts':starts,
        'nativeLineWidthsHU':[int(line['horzsize']) for line in after['lineSegments']],'propertiesUnchanged':not changes,'fontDescriptorChanged':before['descriptor']!=after['descriptor']})
result={'input':{'file':source.name,'sha256':sha(source.read_bytes())},'hancom':{'file':saved.name,'sha256':sha(saved.read_bytes())},'tables':36,'predictedBoundaryMatches':36-len(failures),'failures':failures,'measurementPropertyChanges':propertyChanges,'results':results,
 'scope':'Actual Hancom readback of self-authored glyph admission matrix. Exact text SHA and resolved measurement properties are checked. Glyph-placement advances, font-size generalization outside this matrix and global cached-row changes are not proved by line-partition thresholds alone.'}
output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'output':str(output),'matches':36-len(failures),'failures':failures,'measurementPropertyChanges':len(propertyChanges)},ensure_ascii=False,indent=2))
