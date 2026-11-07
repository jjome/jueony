"""Build a true in-cell source picture and inspect its native saved records."""
import hashlib
import json
import re
import struct
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "upstream/rhwp-source/scripts"))
from secd_tail_survey import Cfb, inflate, records


def digest(data):
    return hashlib.sha256(data).hexdigest()


def embed(source, target):
    # insertPicture at a table cursor creates a sibling floating picture.
    # Keep its native picture and image resource, move the picture to the
    # selected cell's paragraph in the source fixture only.
    with ZipFile(source) as src, ZipFile(target, "w") as dst:
        for entry in src.infolist():
            data = src.read(entry)
            if entry.filename == "Contents/section0.xml":
                matches = re.findall(rb"<hp:pic\b.*?</hp:pic>", data, re.DOTALL)
                needle = b"<hp:t>Picture</hp:t>"
                assert len(matches) == 1 and data.count(needle) == 1
                data = data.replace(matches[0], b"", 1).replace(needle, matches[0]+needle, 1)
            dst.writestr(entry, data)


def inspect(path):
    if path.suffix == ".hwpx":
        with ZipFile(path) as zipfile:
            root = ET.fromstring(zipfile.read("Contents/section0.xml"))
            owner, = [c for c in root.findall(".//{*}tc") if c.find(".//{*}pic") is not None]
            picture, = owner.findall(".//{*}pic")
            asset, = [name for name in zipfile.namelist() if name.startswith("BinData/")]
            assert picture.find(".//{*}img").get("binaryItemIDRef") == Path(asset).stem
            pos = owner.find("./{*}cellAddr")
            return {"row": int(pos.get("rowAddr")), "col": int(pos.get("colAddr")),
                    "records": [digest(ET.tostring(picture))], "image": digest(zipfile.read(asset))}
    doc = Cfb(path.read_bytes())
    compressed = doc.read("FileHeader")[36] & 1
    entries = list(records(inflate(doc.read("Section0"), compressed)))
    pictures = []
    owner = None
    for i, (tag, level, data) in enumerate(entries):
        if level < 2:
            owner = None
        if tag == 72 and level == 2:
            owner = struct.unpack_from("<HH", data, 8)
        if tag == 71 and level == 3 and data[:4] == b" osg":
            assert owner is not None
            sequence = [entries[i], entries[i+1], entries[i+2]]
            assert [t for t, _, _ in sequence] == [71, 76, 85]
            pictures.append((owner, [digest(d) for _, _, d in sequence]))
    ((col, row), payload), = pictures
    entry, = [n for n in doc.names() if re.fullmatch(r"BIN[0-9A-Fa-f]+\.(?:png|jpg|jpeg)", n, re.I)]
    return {"row": row, "col": col, "records": payload, "image": digest(inflate(doc.read(entry), compressed))}


if sys.argv[1] == "embed":
    embed(Path(sys.argv[2]), Path(sys.argv[3]))
else:
    print(json.dumps(inspect(Path(sys.argv[2]))))
