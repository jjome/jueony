import copy, hashlib, json, pathlib, re, sys, xml.etree.ElementTree as ET, zipfile

def sha(p): return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def dump_new(path, value):
    with pathlib.Path(path).open('x', encoding='utf-8') as f: json.dump(value, f, ensure_ascii=False, indent=2)
def canonical(e): return [e.tag, sorted(e.attrib.items()), e.text or '', [canonical(c) for c in e], e.tail or '']
def header(path):
    with zipfile.ZipFile(path) as z: return ET.fromstring(z.read('Contents/header.xml'))
def first(root, name): return next(e for e in root.iter() if e.tag == '{http://www.hancom.co.kr/hwpml/2011/head}' + name)

mode = sys.argv[1]
if mode == 'prepare':
    repo, out = map(pathlib.Path, sys.argv[2:4]); src = repo/'build/metadata-author-closure82/own-summary-five-fields-source.hwpx'
    dest = out/'generated-inputs'; dest.mkdir(); rows = []
    with zipfile.ZipFile(src) as z: entries = [(copy.copy(e), z.read(e.filename)) for e in z.infolist()]
    original = dict((e.filename, b) for e, b in entries)['Contents/header.xml']; m = re.search(rb'<hh:font\b[^>]*>', original); assert m
    assert not any(e.filename.lower().endswith(('.ttf', '.otf', '.ttc', '.woff', '.woff2', '.hft')) for e, _ in entries)
    assert all(e.get('isEmbedded') in (None, '0', 'false') for e in ET.fromstring(original).iter() if e.tag.rsplit('}', 1)[-1] in ('font', 'substFont'))
    specs = [('unknown-substitute', 'TTF', 'UNKNOWN'), ('hft-ttf-substitute', 'HFT', 'TTF'), ('rep-substitute', 'TTF', 'REP'), ('missing-substitute', 'TTF', None), ('lowercase-primary', 'ttf', False)]
    for name, parent, child in specs:
        tag = m[0].replace(b' type="TTF"', (' type="'+parent+'"').encode()); tail = original[m.end():]
        if child is not False:
            sub = ('<hh:substFont face="OWN-NONEMBEDDED-SUBSTITUTE"'+(' type="'+child+'"' if child else '')+' isEmbedded="0" binaryItemIDRef=""/>').encode()
            tail = sub + tail
        xml = original[:m.start()] + tag + tail; ET.fromstring(xml); path = dest/(name+'.hwpx')
        with path.open('xb') as raw:
            with zipfile.ZipFile(raw, 'w') as z:
                for e, b in entries: z.writestr(copy.copy(e), xml if e.filename == 'Contents/header.xml' else b)
        rows.append({'name': name, 'path': str(path.resolve()), 'sha256': sha(path), 'primaryType': parent, 'substituteType': child, 'ownFixture': True})
    dump_new(out/'generated-inputs.json', {'base': str(src.resolve()), 'baseSha256': sha(src), 'fontProgramsExtractedOrEmbedded': False, 'fixtures': rows})
elif mode == 'audit':
    manifest, output = map(pathlib.Path, sys.argv[2:4]); data = json.loads(manifest.read_text(encoding='utf-8')); results, failures = [], []
    for row in data['outputs']:
        if row['format'] != 'hwpx': continue
        record = {'label': row['label'], 'path': row['path'], 'sha256': sha(row['path']), 'parsedEntries': []}
        try:
            with zipfile.ZipFile(row['path']) as z:
                assert z.testzip() is None
                for item in z.infolist():
                    if item.filename.lower().endswith(('.xml', '.hpf')):
                        ET.fromstring(z.read(item.filename)); record['parsedEntries'].append(item.filename)
            assert record['parsedEntries']
            root = header(row['path']); font = first(root, 'font'); record['firstFontType'] = font.get('type')
            if 'expectedType' in row: assert font.get('type') == row['expectedType']
            if row.get('compareFirstFont'):
                record['fullFirstFontResourceEqual'] = canonical(first(header(row['source']), 'font')) == canonical(font)
                assert record['fullFirstFontResourceEqual']
            if 'expectedDirection' in row:
                before = first(header(row['source']), 'paraPr'); after = first(root, 'paraPr')
                record['firstDirection'] = after.get('textDir'); assert record['firstDirection'] == row['expectedDirection']
                record['fullFirstParagraphResourceEqual'] = canonical(before) == canonical(after); assert record['fullFirstParagraphResourceEqual']
            record['status'] = 'PASS'
        except Exception as error:
            record['status'] = 'FAIL'; record['error'] = type(error).__name__+': '+str(error); failures.append(record['label'])
        results.append(record)
    immutable = [{'path': x['path'], 'sha256': sha(x['path']), 'unchanged': sha(x['path']) == x['sha256']} for x in data['inputs']]
    failures += [x['path'] for x in immutable if not x['unchanged']]
    dump_new(output, {'implementation': 'Python standard library zipfile + ElementTree, independent of engine parser.', 'status': 'PASS' if not failures else 'FAIL', 'results': results, 'inputImmutability': immutable, 'failures': failures, 'actualNativeHancomExecution': False})
    sys.exit(bool(failures))
else: raise ValueError('Unknown mode')
