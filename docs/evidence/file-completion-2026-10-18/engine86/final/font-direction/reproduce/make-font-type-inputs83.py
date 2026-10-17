import argparse, copy, hashlib, json, pathlib, re, xml.etree.ElementTree as ET, zipfile
p = argparse.ArgumentParser(); p.add_argument('--repository', required=True); p.add_argument('--output', required=True); a = p.parse_args()
repo, out = pathlib.Path(a.repository), pathlib.Path(a.output)
assert repo.is_absolute() and out.is_absolute(); out.mkdir(exist_ok=False)
source = repo/'build/metadata-author-closure82/own-summary-five-fields-source.hwpx'
with zipfile.ZipFile(source) as z: entries = [(copy.copy(e), z.read(e.filename)) for e in z.infolist()]
assert not any(e.filename.lower().endswith(('.ttf','.otf','.ttc','.woff','.woff2','.hft')) for e, _ in entries)
header = dict((e.filename, b) for e, b in entries)['Contents/header.xml']; first = re.search(rb'<hh:font\b[^>]*>', header); assert first and b' type="TTF"' in first[0]
assert all(e.get('isEmbedded') in (None,'0','false') for e in ET.fromstring(header).iter() if e.tag.rsplit('}',1)[-1] in ('font','substFont'))
rows = []
for token in ['REP','TTF','HFT','UNKNOWN','MISSING']:
    tag = first[0].replace(b' type="TTF"', b'' if token == 'MISSING' else (' type="'+token+'"').encode())
    changed = header[:first.start()] + tag + header[first.end():]; ET.fromstring(changed)
    path = out/('own-font-'+token+'.hwpx')
    with path.open('xb') as raw:
        with zipfile.ZipFile(raw, 'w') as z:
            for e, b in entries: z.writestr(copy.copy(e), changed if e.filename == 'Contents/header.xml' else b)
    rows.append({'token':token,'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourceType':'TTF','sourceEnumDeltaOnly':True})
with (out/'manifest.json').open('x', encoding='utf-8') as f: json.dump({'source':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'fixtures':rows,'fontProgramsExtractedOrEmbedded':False},f,indent=2)
