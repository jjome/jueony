"""Synthetic caret/settings preservation fixtures; never edits a user document."""
from pathlib import Path
import json, re, sys, zipfile
source=Path(sys.argv[1]); destination=Path(sys.argv[2]); mode=sys.argv[3]
with zipfile.ZipFile(source) as z:
    entries={x.filename:(x,z.read(x)) for x in z.infolist()}
if mode=='inspect':
    settings=entries['settings.xml'][1].decode('utf8')
    print(json.dumps({'settings':settings},ensure_ascii=True))
    sys.exit(0)
ns='http://www.owpml.org/owpml/2023/app' if mode=='2023' else 'http://www.hancom.co.kr/hwpml/2011/app'
caret='<q:CaretPosition custom="keep &amp; safe" listIDRef="0" paraIDRef="1" pos="3"/>'
if mode=='nonempty': caret=caret[:-2]+'></q:CaretPosition>'
if mode=='duplicate': caret+=caret
if mode=='list': caret=caret.replace('listIDRef="0"','listIDRef="9"')
if mode=='paragraph': caret=caret.replace('paraIDRef="1"','paraIDRef="99"')
if mode=='midpoint': caret=caret.replace('pos="3"','pos="2"')
if mode=='overflow': caret=caret.replace('pos="3"','pos="4294967296"')
if mode=='negative': caret=caret.replace('pos="3"','pos="-1"')
if mode=='namespace': ns='https://example.invalid/app'
settings=('<?xml version="1.0" encoding="UTF-8"?>\n'
          f'<q:HWPApplicationSetting xmlns:q="{ns}" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0">'
          '<!--keep original settings-->\n'+caret+'\n'
          '<config:config-item-set name="PrintInfo"><config:config-item name="PrintMethod" type="short">0</config:config-item>'
          '<config:config-item name="ExternalSetting" type="string">unchanged &amp; preserved</config:config-item>'
          '</config:config-item-set></q:HWPApplicationSetting>').encode('utf8')
if mode=='malformed': settings=settings.replace(b'</q:HWPApplicationSetting>',b'</wrong>')
entries['settings.xml']=(entries['settings.xml'][0],settings)
for name,(info,data) in list(entries.items()):
    if name.startswith('Contents/section') and name.endswith('.xml'):
        # Real Hancom fixtures also repeat p@id: a caret ordinal must not use it.
        entries[name]=(info,re.sub(rb'(<hp:p\s+id=")[^"]*(")',rb'\g<1>2147483648\2',data))
        if mode=='duplicate-structure':
            data=entries[name][1]
            match=re.search(rb'<hp:ctrl>\s*<hp:colPr.*?</hp:ctrl>',data)
            if not match: raise ValueError('Expected synthetic column control')
            entries[name]=(info,data[:match.end()]+match.group()+data[match.end():])
with zipfile.ZipFile(destination,'w') as z:
    for info,data in entries.values(): z.writestr(info,data)
