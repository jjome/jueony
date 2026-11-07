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
    return shape, text


def binary_paragraph(native):
    compound = Cfb(native)
    streams = {e["name"]: compound.read(e["name"]) for e in compound.dir_entries if e["type"] == 2}
    compressed = streams["FileHeader"][36] & 1
    info = list(records(inflate(streams["DocInfo"], compressed)))
    body = list(records(inflate(streams["Section0"], compressed)))
    para_header, = [data for tag, level, data in body if tag == 66 and level == 0]
    shape_id = struct.unpack_from("<H", para_header, 8)[0]
    shape = [data for tag, _, data in info if tag == 25][shape_id]
    return shape_id, shape, streams, info, body


def inspect(folder, mode):
    source = folder / f"{mode}.hwpx"
    native = (folder / f"{mode}-disk.hwp").read_bytes()
    reopened = folder / f"{mode}-result.hwpx"
    with ZipFile(source) as package:
        shape, text = xml_paragraph(package)
        assert shape.attrib["textDir"] == mode
        input_parts = {name: package.read(name) for name in package.namelist()}
        token = f'textDir="{mode}"'.encode()
        header = input_parts["Contents/header.xml"]
        assert header.count(token) == 1
        input_parts["Contents/header.xml"] = header.replace(token, b'textDir="CONTROL"')

    shape_id, shape, streams, info, body = binary_paragraph(native)
    with ZipFile(reopened) as package:
        saved_shape, saved_text = xml_paragraph(package)
        assert saved_text == text and text == "N046 ABC 123 문단 방향 אבג"
        assert package.read("Preview/PrvImage.png") == streams["PrvImage"]
    result = {
        "inputDirection": mode, "reopenedDirection": saved_shape.attrib["textDir"], "paraShapeId": shape_id,
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


def check_editor(folder, check_hancom):
    reference = Path(__file__).resolve().parents[4] / "docs/evidence/n046-hancom-2026-11-08/comparison.json"
    samples = json.loads(reference.read_text(encoding="utf-8"))
    result = {}
    def inspect_xml(path, mode):
        with ZipFile(path) as package:
            shape, text = xml_paragraph(package)
            assert shape.attrib["textDir"] == mode and text == "글 방향 보존 확인"
            spacing = shape.find("./{*}autoSpacing").attrib
            assert spacing["eAsianEng"] == spacing["eAsianNum"] == "1"
        return {"textDir": mode, "sha256": digest(path.read_bytes())}

    for mode in ("LTR", "RTL"):
        native = (folder / f"{mode}.hwp").read_bytes()
        shape_id, shape, _, _, _ = binary_paragraph(native)
        word = struct.unpack_from("<I", shape, 42)[0]
        assert word & 0x0c == samples[mode]["byteAtOffset42"]
        assert word & 0x30 == 0x30, "adjacent automatic spacing flags were lost"
        result[mode] = {"shapeId": shape_id, "attr2": hex(word), "sha256": digest(native)}
        if check_hancom:
            result[mode]["hancomReadback"] = inspect_xml(folder / f"{mode}-hancom-readback.hwpx", mode)
    result["AUTO"] = inspect_xml(folder / "AUTO.hwpx", "AUTO")
    return result


if __name__ == "__main__":
    if sys.argv[1:2] == ["--editor"]:
        print(json.dumps(check_editor(Path(sys.argv[2]), "--hancom-readback" in sys.argv[3:]), indent=2))
    else:
        print(json.dumps(compare(Path(sys.argv[1])), indent=2))
