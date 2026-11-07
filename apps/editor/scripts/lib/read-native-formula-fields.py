"""Inspect table calculation fields independently of the WASM reader."""

import json
import re
import struct
import sys
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile

repo = Path(__file__).resolve().parents[4]
sys.dont_write_bytecode = True
sys.path.insert(0, str(repo / "upstream/rhwp-source/scripts"))
from secd_tail_survey import Cfb, inflate, records


def xml_fields(path):
    with ZipFile(path) as package:
        fields = []
        for name in package.namelist():
            if not re.fullmatch(r"Contents/section\d+\.xml", name):
                continue
            root = ElementTree.fromstring(package.read(name))
            ends = {node.get("beginIDRef"): node.get("fieldid")
                    for node in root.findall(".//{*}fieldEnd")}
            for field in root.findall('.//{*}fieldBegin[@type="FORMULA"]'):
                fields.append({
                    "id": int(field.attrib["id"]),
                    "fieldid": field.get("fieldid"),
                    "endFieldid": ends.get(field.attrib["id"]),
                    "params": [[item.tag.split("}")[-1], item.get("name"), item.text]
                               for item in field.findall("./{*}parameters/*")],
                })
    return fields


def binary_fields(path):
    compound = Cfb(path.read_bytes())
    compressed = compound.read("FileHeader")[36] & 1
    fields, end_props = [], []
    for name in compound.names():
        if not re.fullmatch(r"Section\d+", name):
            continue
        for tag, _, data in records(inflate(compound.read(name), compressed)):
            if tag == 71 and data[:4] == b"umf%":  # CTRL_HEADER
                size = struct.unpack_from("<H", data, 9)[0] * 2
                fields.append({
                    "id": struct.unpack_from("<I", data, 11 + size)[0],
                    "prop": data[8], "command": data[11:11 + size].decode("utf-16-le"),
                })
            elif tag == 67:  # PARA_TEXT, field-end marker occupies 8 UTF-16 units.
                for offset in range(0, len(data) - 15, 2):
                    if data[offset:offset + 5] == b"\x04\x00umf":
                        end_props.append(data[offset + 5])
    return {"fields": fields, "endProps": end_props}


file_path = Path(sys.argv[1])
print(json.dumps(xml_fields(file_path) if file_path.suffix.lower() == ".hwpx"
                 else binary_fields(file_path)))
