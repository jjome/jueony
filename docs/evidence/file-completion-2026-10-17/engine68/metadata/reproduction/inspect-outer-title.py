from pathlib import Path
import zipfile,re,json,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2]/'build/outer-native-candidate48/permanent-staging/fixtures';out=[]
for name in ['outer-hwpx.hwpx','outer-hwpx-hancom.hwpx']:
 with zipfile.ZipFile(root/name)as z:b=z.read('Contents/content.hpf')
 e=ET.fromstring(b).find('{http://www.idpf.org/2007/opf/}metadata/{http://www.idpf.org/2007/opf/}title')
 value=e.text or '';start=b.find(b'<opf:title');end=b.find(b'</opf:title>',start)
 raw=b[start:end+12]if end>=0 else b[start:b.find(b'/>',start)+2]
 out.append({'name':name,'xmlDeclarationHex':b[:100].hex(),'rawTitleElementHex':raw.hex(),'valueUnicodeEscaped':value.encode('unicode_escape').decode('ascii'),'codepoints':[f'U+{ord(c):04X}'for c in value]})
target=Path(__file__).resolve().parents[2]/'build/document-metadata-final68/outer-title-raw-byte-diagnosis.json';target.write_text(json.dumps(out,indent=2),encoding='utf8');print(json.dumps(out))
