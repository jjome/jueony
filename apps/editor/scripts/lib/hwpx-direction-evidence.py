"""Read source XML direction resources independently; never rewrite a document."""
import hashlib
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile

path = Path(sys.argv[1])
raw = path.read_bytes()
rows = []
if zipfile.is_zipfile(path):
    with zipfile.ZipFile(path) as archive:
        header = archive.getinfo('Contents/header.xml')
        assert header.file_size <= 32 * 1024 * 1024
        root = ET.fromstring(archive.read(header))
        for paragraph in root.iter('{http://www.hancom.co.kr/hwpml/2011/head}paraPr'):
            if 'textDir' in paragraph.attrib:
                identity = int(paragraph.attrib['id'])
                assert 0 <= identity <= 100000
                rows.append({'path': f'docInfo/paraShape/{identity}/textDir',
                             'lexical': paragraph.attrib['textDir']})
assert len(rows) <= 10000 and len({row['path'] for row in rows}) == len(rows)
print(json.dumps({'inputSHA256': hashlib.sha256(raw).hexdigest(), 'resources': rows}))
