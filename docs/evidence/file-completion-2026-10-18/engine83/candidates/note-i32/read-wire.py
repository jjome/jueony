from pathlib import Path
import ast, hashlib, json, struct, zlib

ROOT = Path(__file__).resolve().parents[2]
WORK = Path(__file__).resolve().parent
reader = ROOT / 'build/file-closure69-public/independent-resource-graph.py'
tree = ast.parse(reader.read_text(encoding='utf-8'))
nodes = [n for n in tree.body if isinstance(n, (ast.Import, ast.ImportFrom, ast.FunctionDef))
         or isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'sha' for t in n.targets)]
namespace = {}
exec(compile(ast.Module(body=nodes, type_ignores=[]), '<independent-CFB-reader>', 'exec'), namespace)
paths = [ROOT / 'build/hancom-final-file-review-20261017/source-mcst-bid-2026.hwp',
         ROOT / 'build/mcst-cross-closure77/mcst-actual-v7-final-native-review.hwp',
         WORK / 'mcst-note-i32-native-review.hwp']
rows = []
for path in paths:
    original = path.read_bytes()
    streams, compressed = namespace['streams'](path)
    notes = []
    for name, data in streams.items():
        if not name.startswith('Section'):
            continue
        for tag, level, payload in namespace['records'](zlib.decompress(data, -15) if compressed else data):
            if tag != 74:
                continue
            assert len(payload) == 28
            notes.append({'section': name, 'rawHex': payload.hex(), 'bytes': 28,
                          'length': struct.unpack_from('<i', payload, 12)[0],
                          'above': struct.unpack_from('<h', payload, 16)[0],
                          'below': struct.unpack_from('<h', payload, 18)[0],
                          'between': struct.unpack_from('<H', payload, 20)[0],
                          'type': payload[22], 'width': payload[23],
                          'color': struct.unpack_from('<I', payload, 24)[0]})
    assert path.read_bytes() == original
    rows.append({'path': str(path.relative_to(ROOT)), 'sha256': hashlib.sha256(original).hexdigest(),
                 'bytes': len(original), 'notes': notes})
assert rows[0]['notes'] == rows[2]['notes'], 'Candidate note record bytes must match independent native Hancom original'
assert rows[1]['notes'] != rows[2]['notes'], 'Malformed baseline remains a distinct immutable failure'
report = {'readerSha256': hashlib.sha256(reader.read_bytes()).hexdigest(), 'records': rows,
          'candidateMatchesOriginalEntire28BytePayloads': True, 'originalsUnchanged': True,
          'scope': 'Independent CFB+deflate record decoder, no engine parser/serializer used. Numeric note shapes and structural bytes only; no document body or font bytes copied.'}
(WORK / 'independent-note-wire-final.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print('PASS exact native note payloads', len(rows[2]['notes']), rows[2]['sha256'])
