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


def embed(source, target, many=False):
    # insertPicture at a table cursor creates a sibling floating picture.
    # Keep its native picture and image resource, move the picture to the
    # selected cell's paragraph in the source fixture only.
    with ZipFile(source) as src, ZipFile(target, "w") as dst:
        for entry in src.infolist():
            data = src.read(entry)
            if entry.filename == "Contents/section0.xml":
                matches = re.findall(rb"<hp:pic\b.*?</hp:pic>", data, re.DOTALL)
                labels = [b"PicA", b"PicB", b"PicC", b"PicD"] if many else [b"Picture"]
                assert len(matches) == len(labels)
                for picture in matches:
                    data = data.replace(picture, b"", 1)
                for i, (label, picture) in enumerate(zip(labels, matches)):
                    if many and i == 1:
                        # Two independent objects share one stored resource. A
                        # third PNG has the same bytes and its own resource ID.
                        ref = rb'binaryItemIDRef="[^"]+"'
                        picture = re.sub(ref, re.search(ref, matches[0])[0], picture, count=1)
                    needle = b"<hp:t>" + label + b"</hp:t>"
                    assert data.count(needle) == 1
                    data = data.replace(needle, picture+needle, 1)
            dst.writestr(entry, data)


def inspect_pictures(path):
    if path.suffix == ".hwpx":
        with ZipFile(path) as zipfile:
            root = ET.fromstring(zipfile.read("Contents/section0.xml"))
            manifest = ET.fromstring(zipfile.read("Contents/content.hpf"))
            assets = {x.get("id"): x.get("href") for x in manifest.findall(".//{*}item")}
            pictures = []
            for owner in root.findall(".//{*}tc"):
                pos = owner.find("./{*}cellAddr")
                for picture in owner.findall(".//{*}pic"):
                    ref = picture.find(".//{*}img").get("binaryItemIDRef")
                    pictures.append({"row": int(pos.get("rowAddr")), "col": int(pos.get("colAddr")),
                                     "resource": ref, "records": [digest(ET.tostring(picture))],
                                     "image": digest(zipfile.read(assets[ref]))})
            return pictures
    doc = Cfb(path.read_bytes())
    compressed = doc.read("FileHeader")[36] & 1
    entries = list(records(inflate(doc.read("Section0"), compressed)))
    bin_records = [data for tag, _, data in records(inflate(doc.read("DocInfo"), compressed)) if tag == 18]
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
            # Picture's 1-based BinData index follows the three effect bytes.
            ref, = struct.unpack_from("<H", sequence[2][2], 71)
            assert 0 < ref <= len(bin_records)
            flags, storage, chars = struct.unpack_from("<HHH", bin_records[ref-1])
            assert flags & 15 == 1  # embedded resource
            ext = bin_records[ref-1][6:6+chars*2].decode("utf-16le")
            entry = f"BIN{storage:04X}.{ext}"
            col, row = owner
            pictures.append({"row": row, "col": col, "resource": ref,
                             "records": [digest(d) for _, _, d in sequence],
                             "image": digest(inflate(doc.read(entry), compressed))})
    return pictures


if sys.argv[1] in ("embed", "embed-many"):
    embed(Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[1] == "embed-many")
else:
    pictures = inspect_pictures(Path(sys.argv[2]))
    if sys.argv[1] == "inspect":
        picture, = pictures
        picture.pop("resource")
        print(json.dumps(picture))
    else:
        assert sys.argv[1] == "inspect-many"
        print(json.dumps(pictures))
