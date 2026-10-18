from pathlib import Path
import gzip, hashlib, json, re

ROOT = Path(__file__).resolve().parent
sha = lambda b: hashlib.sha256(b).hexdigest()
read = lambda n: json.loads((ROOT / n).read_bytes())
manifest = read('SHA256-MANIFEST.json')
for name, record in manifest.items():
    p = (ROOT / name).resolve()
    assert p.is_relative_to(ROOT), name
    raw = p.read_bytes()
    assert len(raw) == record['bytes'] and sha(raw) == record['sha256'], name
engine = read('engine-build.json')
assert engine['sourceId'] == '3f07621d4728accf' and len(engine['patches']) == 110
frontend = read('frontend-build.json')
assert frontend['engineWasmSha256'] == engine['wasmSha256']
workflow = read('workflows/result.json')
assert workflow['passedCases'] == workflow['totalCases'] == 346
assert len(workflow['suites']) == 27 and workflow['failures'] == []
for suite in workflow['suites']:
    raw = (ROOT / 'workflows' / suite['name'] / 'result.json').read_bytes()
    result = json.loads(raw)
    assert sha(raw) == suite['resultSHA256']
    assert suite['status'] == 'PASS' and suite['scriptUnchanged']
    assert len(result['results']) == suite['expectedCases'] and result['failures'] == []
    if 'engine' in result:
        assert result['engine']['wasmSha256'] == engine['wasmSha256']
gap = read('workflows/authored-floating-gap-layout/result.json')
assert gap['pass'] == 18 and gap['fail'] == gap['skipped'] == 0
assert gap['observations'][0]['fullSemanticAsserted'] is True
edits = [r for r in gap['results'] if 'exactUndo' in r]
assert len(edits) == 8
for result in edits:
    assert result['exactUndo'] and result['exactRedo'] and len(result['exports']) == 4
    for export in result['exports']:
        assert export['guard'] == 'checked' and export['losses'] == export['semantic'] == export['geometry'] == 0
columns = read('columns/result.json')
assert len(columns['results']) == 24 and columns['failures'] == []
assert columns['candidate']['wasmSha256'] == engine['wasmSha256']
native = read('windows/result.json')
assert native['status'] == 'PASS' and native['passed'] == 10 and native['failed'] == native['ignored'] == 0
assert native['engine']['wasmSha256'] == engine['wasmSha256']
bundle = read('bundle/result.json')
assert bundle['passed'] == 7 and bundle['failed'] == 0
assert bundle['build']['customSourceSha256'] == frontend['customSourceSha256']
unit = gzip.decompress((ROOT / 'checks/unit.log.gz').read_bytes()).decode('utf8')
assert re.search(r'# pass 1008\b', unit) and re.search(r'# fail 0\b', unit) and re.search(r'# skipped 0\b', unit)
assert gzip.decompress((ROOT / 'checks/typescript.log.gz').read_bytes()) == b''
assert json.loads(gzip.decompress((ROOT / 'checks/boundaries.log.gz').read_bytes()))['ok']
assert 'Ran 12 tests' in gzip.decompress((ROOT / 'checks/checklist.log.gz').read_bytes()).decode('utf8')
assert read('before/invalid-history-harness.json')['failures'], 'The invalid old harness is not passing evidence'
remaining = read('remaining/native-mcst-edited-storage.json')
assert all(row['liveToReopen']['geometry'] == 5232 for row in remaining['rows'])
print(f'PASS {len(manifest)} sealed records: official110 workflows346, unit1008, columns24, Windows10, bundle7; remaining defects are not completion claims')
