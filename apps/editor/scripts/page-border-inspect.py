import json, sys, zipfile, xml.etree.ElementTree as ET

def local(element):
    return element.tag.split('}')[-1]

with zipfile.ZipFile(sys.argv[1]) as source:
    section = ET.fromstring(source.read('Contents/section0.xml'))
    header = ET.fromstring(source.read('Contents/header.xml'))

entries = []
visibility = {}
for element in section.iter():
    if local(element) == 'pageBorderFill':
        entries.append({'type': element.attrib.get('type'), 'id': element.attrib.get('borderFillIDRef'),
                        'headerInside': element.attrib.get('headerInside'), 'footerInside': element.attrib.get('footerInside'),
                        'textBorder': element.attrib.get('textBorder')})
    if local(element) == 'visibility':
        visibility = element.attrib
fills = []
for element in header.iter():
    if local(element) == 'borderFill':
        gradient = next((child for child in element.iter() if local(child) == 'gradation'), None)
        if gradient is not None:
            fills.append({'id': element.attrib.get('id'), 'gradient': gradient.attrib,
                          'colors': [child.attrib.get('value') for child in gradient if local(child) == 'color']})
print(json.dumps({'entries': entries, 'visibility': visibility, 'fills': fills}, ensure_ascii=True))
