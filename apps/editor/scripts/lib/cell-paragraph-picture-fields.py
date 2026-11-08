"""Stored mixed-field/picture fixture and independent saved slot evidence."""
import json
import re
import struct
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / 'upstream/rhwp-source/scripts'))
from secd_tail_survey import Cfb, inflate, records


def fixture(source, target, mode):
    begin = '<hp:ctrl><hp:fieldBegin id="702" type="CLICK_HERE" name="입력값" editable="1" dirty="1"><hp:parameters cnt="1" name=""><hp:stringParam name="Command">Clickhere:set:46:Direction:wstring:2:안내 HelpState:wstring:2:설명  </hp:stringParam></hp:parameters></hp:fieldBegin></hp:ctrl>'
    end = '<hp:ctrl><hp:fieldEnd beginIDRef="702"/></hp:ctrl>'
    with ZipFile(source) as src, ZipFile(target, 'w') as dst:
        for entry in src.infolist():
            data = src.read(entry)
            if entry.filename == 'Contents/section0.xml':
                xml = data.decode('utf-8')
                assert xml.count('<hp:t>P</hp:t>') == 1
                xml = xml.replace('<hp:t>P</hp:t>', '<hp:t>앞</hp:t>' + begin + '<hp:t>필드😀</hp:t>' + end + '<hp:t> 뒤문구 P</hp:t>')
                xml = xml.replace('<hp:t>i</hp:t>', '<hp:t>i중간문구 </hp:t>')
                xml = xml.replace('<hp:t>B</hp:t>', '<hp:t>B 일반문구</hp:t>')
                if mode == 'empty':
                    xml = xml.replace('<hp:t>필드😀</hp:t>', '<hp:t/>', 1)
                elif mode == 'enclosing':
                    xml = xml.replace(end, '', 1)
                    xml = xml.replace('</hp:pic>', '</hp:pic>' + end, 1)
                else:
                    assert mode == 'filled'
                data = xml.encode('utf-8')
            dst.writestr(entry, data)


def scan(raw):
    text, slots = '', []
    i = start = 0
    while i < len(raw):
        unit, = struct.unpack_from('<H', raw, i)
        if unit >= 32:
            i += 2
            continue
        text += raw[start:i].decode('utf-16le')
        if unit == 13:
            assert i + 2 == len(raw)
            return text, slots
        assert unit in (3, 4, 11), (unit, i)
        assert struct.unpack_from('<H', raw, i + 14) == (unit,)
        slots.append({'offset': len(text), 'kind': unit, 'raw': raw[i:i+16].hex()})
        i += 16
        start = i
    raise AssertionError('Missing paragraph end')


def inspect(path):
    output = []
    if path.suffix == '.hwpx':
        with ZipFile(path) as archive:
            root = ET.fromstring(archive.read('Contents/section0.xml'))
        for cell in root.findall('.//{*}tc'):
            address = cell.find('./{*}cellAddr')
            for index, paragraph in enumerate(cell.findall('./{*}subList/{*}p')):
                text, slots = '', []
                for run in paragraph.findall('./{*}run'):
                    for child in run:
                        kind = child.tag.rsplit('}', 1)[-1]
                        if kind == 't':
                            text += child.text or ''
                        elif kind == 'pic':
                            slots.append({'offset': len(text), 'kind': 11, 'resource': child.find('.//{*}img').get('binaryItemIDRef')})
                        elif kind == 'ctrl':
                            for field in child:
                                tag = field.tag.rsplit('}', 1)[-1]
                                assert tag in ('fieldBegin', 'fieldEnd'), tag
                                slots.append({'offset': len(text), 'kind': 3 if tag == 'fieldBegin' else 4, 'record': ET.tostring(field, encoding='unicode')})
                        else:
                            raise AssertionError(kind)
                output.append({'row': int(address.get('rowAddr')), 'col': int(address.get('colAddr')), 'paragraph': index, 'text': text, 'slots': slots})
        return output
    doc = Cfb(path.read_bytes())
    compressed = doc.read('FileHeader')[36] & 1
    owner = None
    paragraph = -1
    for tag, level, data in records(inflate(doc.read('Section0'), compressed)):
        if level < 2:
            owner = None
        if tag == 72 and level == 2:
            owner = struct.unpack_from('<HH', data, 8)
            paragraph = -1
        if owner is not None and tag == 66 and level == 2:
            paragraph += 1
        if owner is not None and tag == 67 and level == 3:
            text, slots = scan(data)
            col, row = owner
            output.append({'row': row, 'col': col, 'paragraph': paragraph, 'text': text, 'slots': slots})
    return output


if sys.argv[1] == 'fixture':
    fixture(Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[4])
else:
    assert sys.argv[1] == 'inspect'
    print(json.dumps(inspect(Path(sys.argv[2])), ensure_ascii=True))
