"""Remove the odd entry from a generated fixture; preserve every other ZIP byte payload."""
import re
import sys
import zipfile

source, target = sys.argv[1:3]
with zipfile.ZipFile(source) as original, zipfile.ZipFile(target, "w") as output:
    for item in original.infolist():
        data = original.read(item.filename)
        if item.filename == "Contents/section0.xml":
            text, count = re.subn(r'<hp:pageBorderFill\b[^>]*\btype="ODD"[^>]*>.*?</hp:pageBorderFill>', '', data.decode("utf8"), flags=re.S)
            assert count == 1, count
            data = text.encode("utf8")
        output.writestr(item, data)
