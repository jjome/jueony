"""Compare the three synthetic N046 inputs, Hancom HWP files and reopened HWPX files."""

import hashlib
import json
import struct
import sys
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "upstream/rhwp-source/scripts"))
from secd_tail_survey import Cfb, inflate, records


def digest(data):
    return hashlib.sha256(data).hexdigest()


def xml_paragraph(package):
    section = ElementTree.fromstring(package.read("Contents/section0.xml"))
    paragraph, = section.findall("./{*}p")
    header = ElementTree.fromstring(package.read("Contents/header.xml"))
    shape, = header.findall(f".//{{*}}paraPr[@id='{paragraph.attrib['paraPrIDRef']}']")
    text = "".join(node.text or "" for node in paragraph.findall(".//{*}t"))
    return shape.attrib["textDir"], text


def inspect(folder, mode):
    source = folder / f"{mode}.hwpx"
    native = (folder / f"{mode}-disk.hwp").read_bytes()
    reopened = folder / f"{mode}-result.hwpx"
    with ZipFile(source) as package:
        direction, text = xml_paragraph(package)
        assert direction == mode
        input_parts = {name: package.read(name) for name in package.namelist()}
        token = f'textDir="{mode}"'.encode()
        header = input_parts["Contents/header.xml"]
        assert header.count(token) == 1
        input_parts["Contents/header.xml"] = header.replace(token, b'textDir="CONTROL"')

    compound = Cfb(native)
    streams = {e["name"]: compound.read(e["name"]) for e in compound.dir_entries if e["type"] == 2}
    compressed = streams["FileHeader"][36] & 1
    info = list(records(inflate(streams["DocInfo"], compressed)))
    body = list(records(inflate(streams["Section0"], compressed)))
    para_header, = [data for tag, level, data in body if tag == 66 and level == 0]
    shape_id = struct.unpack_from("<H", para_header, 8)[0]
    shape = [data for tag, _, data in info if tag == 25][shape_id]
    with ZipFile(reopened) as package:
        saved_dir, saved_text = xml_paragraph(package)
        assert saved_text == text and text == "N046 ABC 123 문단 방향 אבג"
        assert package.read("Preview/PrvImage.png") == streams["PrvImage"]
    result = {
        "inputDirection": mode, "reopenedDirection": saved_dir, "paraShapeId": shape_id,
        "paraShapeHex": shape.hex(), "byteAtOffset42": shape[42],
        "inputSha256": digest(source.read_bytes()), "hwpSha256": digest(native),
        "reopenedHwpxSha256": digest(reopened.read_bytes()), "previewSha256": digest(streams["PrvImage"]),
    }
    return result, input_parts, streams, info, body


def compare(folder):
    results = {}
    for mode in ("AUTO", "LTR", "RTL"):
        row, parts, streams, info, body = inspect(folder, mode)
        results[mode] = row
        if mode == "AUTO":
            base_parts, base_streams, base_info, base_body = parts, streams, info, body
        assert parts == base_parts and body == base_body
        assert streams.keys() == base_streams.keys()
        row["streamsDifferingFromAuto"] = sorted(name for name in streams if streams[name] != base_streams[name])
        assert len(info) == len(base_info)
        changes = []
        for (tag, level, data), (base_tag, base_level, baseline) in zip(info, base_info):
            assert (tag, level, len(data)) == (base_tag, base_level, len(baseline))
            changes.extend((tag, i, old, new) for i, (old, new) in enumerate(zip(baseline, data)) if old != new)
        assert changes == ([(25, 42, 8, 4)] if mode == "RTL" else [])
        assert (row["reopenedDirection"], row["byteAtOffset42"]) == (("RTL", 4) if mode == "RTL" else ("LTR", 8))
    return results


if __name__ == "__main__":
    print(json.dumps(compare(Path(sys.argv[1])), indent=2))
