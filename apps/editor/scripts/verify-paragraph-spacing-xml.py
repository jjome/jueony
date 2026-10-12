"""Independent ZIP/XML inspection of the two-paragraph keyboard fixture, no rhwp parser."""
import argparse
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument("--directory", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
file = args.directory / "paragraph-spacing.hwpx"
ns = {"hh": "http://www.hancom.co.kr/hwpml/2011/head", "hp": "http://www.hancom.co.kr/hwpml/2011/paragraph", "hc": "http://www.hancom.co.kr/hwpml/2011/core"}
with zipfile.ZipFile(file) as archive:
    header = ET.fromstring(archive.read("Contents/header.xml"))
    body = ET.fromstring(archive.read("Contents/section0.xml"))
shapes = {element.attrib["id"]: element for element in header.findall(".//hh:paraPr", ns)}
paragraphs = body.findall("hp:p", ns)
assert len(paragraphs) == 2, "keyboard fixture must retain both body paragraphs"
expected = [{"left": 2200, "right": 4000, "intent": 1000}, {"left": 6200, "right": 8000, "intent": 0}]
results = []
for index, paragraph in enumerate(paragraphs):
    shape = shapes[paragraph.attrib["paraPrIDRef"]]
    entry = {"paragraph": index, "paraShape": paragraph.attrib["paraPrIDRef"]}
    for branch, divisor in [("case", 2), ("default", 1)]:
        margin = shape.find(f"hp:switch/hp:{branch}/hh:margin", ns)
        assert margin is not None, f"missing {branch} margin"
        values = {}
        for field, raw in expected[index].items():
            child = margin.find(f"hc:{field}", ns)
            assert child is not None and child.attrib["unit"] == "HWPUNIT"
            values[field] = int(child.attrib["value"])
            assert values[field] == raw // divisor, f"paragraph {index} {branch}/{field}: {values[field]}"
        entry[branch] = values
    results.append(entry)
report = {"status": "PASS", "file": str(file), "checks": "Exact margin/indent values in HwpUnitChar case and legacy default; all body paragraphs retained", "paragraphs": results, "nativeHancom": "NOT_RUN"}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print("PASS independent HWPX paragraph spacing XML (2 paragraphs, both branches)")
