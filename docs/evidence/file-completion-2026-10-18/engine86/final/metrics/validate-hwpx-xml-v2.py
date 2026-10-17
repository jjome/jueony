"""Independently parse every XML/OPF part; never repair input prefixes."""
from pathlib import Path
import hashlib
import json
import sys
import xml.etree.ElementTree as ET
import zipfile

path = Path(sys.argv[1])
data = path.read_bytes()
parts = []
directions = []
fonts = []
errors = []
with zipfile.ZipFile(path) as package:
    for name in package.namelist():
        if name.endswith('/'):
            continue
        payload = package.read(name)
        if not (name.lower().endswith(('.xml', '.hpf', '.opf')) or payload.lstrip().startswith(b'<?xml')):
            continue
        part = {'name': name, 'sha256': hashlib.sha256(payload).hexdigest()}
        try:
            node = ET.fromstring(payload)
            if name == 'Contents/header.xml':
                head = '{http://www.hancom.co.kr/hwpml/2011/head}'
                directions = sorted([{'id': p.get('id'), 'value': p.get('textDir')} for p in node.iter(head+'paraPr') if 'textDir' in p.attrib], key=lambda p: int(p['id']))
                fonts = [{'language': group.get('lang'), 'id': font.get('id'), 'face': font.get('face'), 'type': font.get('type'), 'embedded': font.get('isEmbedded')} for group in node.iter(head+'fontface') for font in group.findall(head+'font')]
            part['valid'] = True
        except ET.ParseError as error:
            part['valid'] = False
            errors.append({'part': name, 'error': str(error)})
        parts.append(part)
if not parts:
    errors.append({'error': 'No XML package parts found'})
print(json.dumps({'sha256': hashlib.sha256(data).hexdigest(), 'parts': parts, 'errors': errors, 'directions': directions, 'fonts': fonts}, ensure_ascii=False))
