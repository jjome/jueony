"""Inspect native Hancom fixtures independently of the rhwp reader/writer."""
import argparse
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument("--directory", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
ns = {name: f"http://www.hancom.co.kr/hwpml/2011/{name_long}"
      for name, name_long in [("hh", "head"), ("hp", "paragraph"), ("hc", "core")]}
reports = []
for file in sorted(args.directory.glob("*.hwpx")):
    if file.name == "original-before-test.hwpx":
        continue
    with zipfile.ZipFile(file) as archive:
        header = ET.fromstring(archive.read("Contents/header.xml"))
        section = ET.fromstring(archive.read("Contents/section0.xml"))
    shapes = {p.attrib["id"]: p for p in header.findall(".//hh:paraPr", ns)}
    paragraphs = []
    for index, p in enumerate(section.findall("hp:p", ns)):
        shape = shapes[p.attrib["paraPrIDRef"]]
        branches = {}
        for branch, path in [("case", "hp:switch/hp:case/hh:margin"),
                             ("default", "hp:switch/hp:default/hh:margin"),
                             ("direct", "hh:margin")]:
            margin = shape.find(path, ns)
            if margin is not None:
                branches[branch] = {name: dict(margin.find(f"hc:{name}", ns).attrib)
                                    for name in ("left", "right", "intent")}
        paragraphs.append({"paragraph": index, "paraShape": p.attrib["paraPrIDRef"],
                           "text": "".join(p.itertext()), "margins": branches})
    reports.append({"file": file.name, "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
                    "paragraphs": paragraphs})
args.output.write_text(json.dumps({"reader": "Python ZIP/XML; no rhwp", "files": reports},
                                  ensure_ascii=False, indent=2), encoding="utf-8")
for report in reports:
    print(report["file"], report["paragraphs"][0]["margins"])
