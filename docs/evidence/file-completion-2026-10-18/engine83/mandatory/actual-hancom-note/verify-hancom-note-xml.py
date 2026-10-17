from pathlib import Path
import argparse, hashlib, json, zipfile
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument('--repository', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
root, out = Path(args.repository), Path(args.output)
assert root.is_absolute() and out.is_absolute()
sources = [
    ('build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx', '20a3960b4315626c3f97d9c5d47746e3cfadd8fe50dde43a4a424aa3a2a76936'),
    ('build/note-shape-i32-candidate82/mcst-note-i32-hancom.hwpx', '9a02598407a6a34f372d13e89086ecb5142c512b8a41b169dd1b862b53ca88fc'),
]
rows = []
for rel, pin in sources:
    path = root / rel
    before = path.read_bytes()
    assert hashlib.sha256(before).hexdigest() == pin
    notes = []
    with zipfile.ZipFile(path) as archive:
        for name in archive.namelist():
            if not name.startswith('Contents/section') or not name.endswith('.xml'):
                continue
            for node in ET.fromstring(archive.read(name)).iter():
                kind = node.tag.rsplit('}', 1)[-1]
                if kind in ('footNotePr', 'endNotePr'):
                    notes.append({'section': name, 'kind': kind,
                                  'properties': [{'name': child.tag.rsplit('}', 1)[-1], 'attributes': child.attrib}
                                                 for child in node.iter() if child is not node]})
    assert path.read_bytes() == before
    rows.append({'path': rel, 'sha256': pin, 'bytes': len(before), 'notes': notes})
assert len(rows[0]['notes']) == len(rows[1]['notes']) == 2
assert rows[0]['notes'] == rows[1]['notes']
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({'status': 'PASS_ALL_ACTUAL_NOTE_XML_PROPERTIES_EXACT',
    'verifierSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'rows': rows, 'originalsUnchanged': True,
    'scope': 'All note XML attributes independently compared after actual Hancom Open/SaveAs. No body, full snapshot, font or document file is copied; this is not a full-document layout/ID equality claim.'}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('PASS actual Hancom note property sets', len(rows[0]['notes']))
