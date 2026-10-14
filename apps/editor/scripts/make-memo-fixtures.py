"""Self-authored memo fixtures from a blank engine HWPX, no public documents."""
from pathlib import Path
import sys, zipfile
base, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(base) as z:
    files = {n:z.read(n) for n in z.namelist()}
original = files['Contents/section0.xml'].decode('utf-8')
def memo(index, text):
    return f'''<hp:ctrl><hp:fieldBegin id="{100+index}" type="MEMO" name="" editable="1" dirty="1" fieldid="{200+index}"><hp:parameters cnt="2" name=""><hp:stringParam name="Command">MEMO/65535/{index}/0/0/reviewer/\\;;</hp:stringParam><hp:integerParam name="Number">{index}</hp:integerParam></hp:parameters><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0"><hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t>{text}</hp:t></hp:run></hp:p><hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t>두 번째 검토 의견</hp:t></hp:run></hp:p></hp:subList></hp:fieldBegin></hp:ctrl><hp:t>검토 대상 {index}</hp:t><hp:ctrl><hp:fieldEnd beginIDRef="{100+index}" fieldid="{200+index}"/></hp:ctrl>'''
for name, content in [('one',memo(1,'검토 메모 😀')),('two',memo(1,'첫 메모')+memo(2,'다른 메모')),('duplicate',memo(1,'중복 A')+memo(1,'중복 B'))]:
    xml=original.replace('</hp:run>',content+'</hp:run>',1)
    # A genuine empty body paragraph must survive alongside the storage carrier.
    at=xml.rfind('</hs:sec>')
    assert at>=0
    xml=xml[:at]+'<hp:p id="999" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t/></hp:run></hp:p>'+xml[at:]
    with zipfile.ZipFile(out/(name+'.hwpx'),'w',compression=zipfile.ZIP_DEFLATED) as z:
        for path,data in files.items():z.writestr(path,xml.encode() if path=='Contents/section0.xml' else data)
