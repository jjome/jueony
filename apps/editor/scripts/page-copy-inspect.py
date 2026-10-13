"""Independent ZIP/XML probe; generated test fixtures only."""
from pathlib import Path
import sys,json,zipfile,xml.etree.ElementTree as ET
secret='JUEONY_COPY_EXCLUDED_AUX_20261014'
def inject(source,target):
    with zipfile.ZipFile(source) as original,zipfile.ZipFile(target,'w') as output:
        for info in original.infolist():
            data=original.read(info.filename)
            if info.filename=='Preview/PrvText.txt':data=secret.encode('utf8')
            if info.filename=='Contents/content.hpf':data=data.replace(b'</opf:metadata>',('<dc:description>'+secret+'</dc:description></opf:metadata>').encode('utf8'))
            output.writestr(info,data)
        output.writestr('Custom/full-original-context.txt',secret)
def inspect(path,expected):
    with zipfile.ZipFile(path) as z:
        paths=z.namelist();sections=[p for p in paths if p.startswith('Contents/section') and p.endswith('.xml')]
        assert len(sections)==1,sections
        root=ET.fromstring(z.read(sections[0]))
        # Text run payload only; metadata attributes are intentionally not body text.
        texts=[''.join(t.text or '' for t in p.iter() if t.tag.rsplit('}',1)[-1]=='t') for p in list(root) if p.tag.rsplit('}',1)[-1]=='p']
        assert texts==expected,(texts,expected)
        for p in paths:
            assert secret.encode('utf8') not in z.read(p),p
        assert not any(p.startswith('Custom/') for p in paths),paths
        return {'sectionCount':len(sections),'paragraphTexts':texts,'entries':paths,'excludedAuxiliaryMarkerPresent':False}
if sys.argv[1]=='inject':inject(sys.argv[2],sys.argv[3])
elif sys.argv[1]=='inspect':print(json.dumps(inspect(sys.argv[2],json.loads(sys.argv[3]))))
else:raise ValueError('unknown command')
