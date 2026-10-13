"""Create an over-limit original master from a generated document for read-only tests."""
import sys
import zipfile
import xml.etree.ElementTree as ET

source, target = sys.argv[1:3]
with zipfile.ZipFile(source) as archive:
    files = {name: archive.read(name) for name in archive.namelist()}
master = next(name for name in files if "masterpage" in name.lower() and name.endswith(".xml"))
root = ET.fromstring(files[master])
text = next(e for e in root.iter() if e.tag.split("}")[-1] == "t")
text.text = "가" * 4001
files[master] = ET.tostring(root, encoding="utf-8", xml_declaration=True)
with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for name, data in files.items():
        archive.writestr(name, data)
