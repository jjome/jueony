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
            ET.fromstring(payload)
            part['valid'] = True
        except ET.ParseError as error:
            part['valid'] = False
            errors.append({'part': name, 'error': str(error)})
        parts.append(part)
if not parts:
    errors.append({'error': 'No XML package parts found'})
print(json.dumps({'sha256': hashlib.sha256(data).hexdigest(), 'parts': parts, 'errors': errors}, ensure_ascii=False))
