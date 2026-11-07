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


def embed(source, target, mode):
    # insertPicture at a table cursor creates a sibling floating picture.
    # Keep its native picture and image resource, move the picture to the
    # selected cell's paragraph in the source fixture only.
    with ZipFile(source) as src, ZipFile(target, "w") as dst:
        for entry in src.infolist():
            data = src.read(entry)
            if entry.filename == "Contents/section0.xml":
                matches = re.findall(rb"<hp:pic\b.*?</hp:pic>", data, re.DOTALL)
                many = mode in ("embed-many", "embed-grouped")
                labels = [b"PicA", b"PicB", b"PicC", b"PicD"] if many else [b"Picture"]
                assert len(matches) == len(labels)
                for picture in matches:
                    data = data.replace(picture, b"", 1)
                if many:
                    # Two independent objects share one stored resource. A
                    # third PNG has the same bytes and its own resource ID.
                    ref = rb'binaryItemIDRef="[^"]+"'
                    matches[1] = re.sub(ref, re.search(ref, matches[0])[0], matches[1], count=1)
                if mode == "embed-grouped":
                    # Preserve both text before/after each inline picture and
                    # their native order in a single paragraph.
                    grouped = b"<hp:t>P</hp:t>"+matches[0]+b"<hp:t>i</hp:t>"+matches[1]+b"<hp:t>c</hp:t>"+matches[2]+b"<hp:t>B</hp:t>"
                    assert data.count(b"<hp:t>PicB</hp:t>") == 1
                    data = data.replace(b"<hp:t>PicB</hp:t>", grouped)
                    matches, labels = matches[3:], labels[3:]
                for label, picture in zip(labels, matches):
                    needle = b"<hp:t>" + label + b"</hp:t>"
                    assert data.count(needle) == 1
                    data = data.replace(needle, picture+needle, 1)
            dst.writestr(entry, data)


def picture_anchors_in_text(raw):
    """Read picture slots in a fixture's PARA_TEXT, counting Unicode scalars."""
    offsets = []
    i = start = length = 0
    while i < len(raw):
        unit, = struct.unpack_from("<H", raw, i)
        if unit >= 32:
            i += 2
            continue
        length += len(raw[start:i].decode("utf-16le"))
        if unit == 13:
            assert i + 2 == len(raw)
            break
        assert unit == 11 and raw[i+2:i+6] == b" osg"
        assert struct.unpack_from("<H", raw, i + 14) == (11,)
        offsets.append(length)
        i += 16
        start = i
    return offsets


def inspect_pictures(path, paragraphs=False, anchors=False):
    if path.suffix == ".hwpx":
        with ZipFile(path) as zipfile:
            root = ET.fromstring(zipfile.read("Contents/section0.xml"))
            manifest = ET.fromstring(zipfile.read("Contents/content.hpf"))
            assets = {x.get("id"): x.get("href") for x in manifest.findall(".//{*}item")}
            pictures = []
            cells = root.findall(".//{*}tc")
            if paragraphs:
                # The fixture has one body paragraph before this table. The
                # writer assigns fresh sequential p IDs to its cell paragraphs.
                cell_paragraphs = [p for c in cells for p in c.findall("./{*}subList/{*}p")]
                assert all(p.get("id") == str(i) for i, p in enumerate(cell_paragraphs, 1))
            for owner in cells:
                pos = owner.find("./{*}cellAddr")
                for paragraph in owner.findall("./{*}subList/{*}p"):
                    if paragraphs:
                        del paragraph.attrib["id"]
                    picture_offsets = {}
                    if anchors:
                        length = 0
                        for item in paragraph.findall("./{*}run/*"):
                            kind = item.tag.rsplit("}", 1)[-1]
                            if kind == "t":
                                length += len(item.text or "")
                            elif kind == "pic":
                                picture_offsets[item] = length
                    for picture in paragraph.findall(".//{*}pic"):
                        ref = picture.find(".//{*}img").get("binaryItemIDRef")
                        result = {"row": int(pos.get("rowAddr")), "col": int(pos.get("colAddr")),
                                  "resource": ref, "records": [digest(ET.tostring(picture))],
                                  "image": digest(zipfile.read(assets[ref]))}
                        if anchors:
                            result["textOffset"] = picture_offsets[picture]
                        if paragraphs:
                            result["paragraph"] = digest(ET.tostring(paragraph))
                        pictures.append(result)
            return pictures
    doc = Cfb(path.read_bytes())
    compressed = doc.read("FileHeader")[36] & 1
    entries = list(records(inflate(doc.read("Section0"), compressed)))
    bin_records = [data for tag, _, data in records(inflate(doc.read("DocInfo"), compressed)) if tag == 18]
    pictures = []
    owner = None
    paragraph = []
    raw_text = b""
    picture_index = 0
    for i, (tag, level, data) in enumerate(entries):
        if level < 2:
            owner = None
        if tag == 72 and level == 2:
            owner = struct.unpack_from("<HH", data, 8)
        if tag == 66 and level == 2:
            paragraph = [digest(data)]
            raw_text = b""
            picture_index = 0
        if tag == 67 and level == 3:
            raw_text = data
        if level == 3 and tag in (67, 68, 69):
            paragraph.append(digest(data))
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
            result = {"row": row, "col": col, "resource": ref,
                      "records": [digest(d) for _, _, d in sequence],
                      "image": digest(inflate(doc.read(entry), compressed))}
            if anchors:
                result["textOffset"] = picture_anchors_in_text(raw_text)[picture_index]
                picture_index += 1
            if paragraphs:
                result["paragraph"] = list(paragraph)
            pictures.append(result)
    return pictures


if sys.argv[1] in ("embed", "embed-many", "embed-grouped"):
    embed(Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[1])
else:
    pictures = inspect_pictures(Path(sys.argv[2]), sys.argv[1] == "inspect-grouped", sys.argv[1] == "inspect-anchors")
    if sys.argv[1] == "inspect":
        picture, = pictures
        picture.pop("resource")
        print(json.dumps(picture))
    else:
        assert sys.argv[1] in ("inspect-many", "inspect-grouped", "inspect-anchors")
        print(json.dumps(pictures))
