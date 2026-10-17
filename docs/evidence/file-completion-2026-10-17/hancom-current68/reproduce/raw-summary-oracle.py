from pathlib import Path
import ast,struct,json,hashlib,zipfile,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2]
reader=root/'build/document-metadata-candidate/table-fixture-summary-oracle.py'
tree=ast.parse(reader.read_text(encoding='utf8'))
namespace=globals();namespace['keys']=['title','subject','author','keywords','description']
for node in tree.body:
 if isinstance(node,ast.FunctionDef):exec(compile(ast.Module(body=[node],type_ignores=[]),str(reader),'exec'),namespace)
files=[];errors=[]
original=root/'build/hancom-file-preservation-20261017'
names=['overlap-body-native-multiline.hwp','hancom-multiline-roundtrip.hwp','overlap-body-native-caption-multiline.hwp','hancom-caption-multiline-roundtrip.hwp','overlap-positive-native-caption-source-gap-10500.hwp','hancom-positive-roundtrip.hwp']
paths=[original/n for n in names]+list((Path(__file__).parent/'final-inputs').glob('*.hwp'))+list((Path(__file__).parent/'final-inputs').glob('*.hwpx'))+list(Path(__file__).parent.glob('*-prepared.hwp'))+list(Path(__file__).parent.glob('*-prepared.hwpx'))+list((Path(__file__).parent/'hancom-current').glob('*.hwp'))
for path in paths:
 try:files.append({'name':path.relative_to(root).as_posix(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'values':cfb(path)if path.suffix=='.hwp'else opf(path)})
 except Exception as e:errors.append({'name':str(path),'error':str(e)})
result={'files':files,'errors':errors,'readerSha256':hashlib.sha256(reader.read_bytes()).hexdigest(),'scope':'Independent raw CFB/PropertySet and OPF values for original6 and own review outputs. No Native getter or metadata normalization.'}
(Path(__file__).parent/'raw-summary-oracle.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'files':len(files),'errors':errors}))
