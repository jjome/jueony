from pathlib import Path
import hashlib, json, shutil

ROOT = Path(__file__).resolve().parents[2]
WORK = Path(__file__).resolve().parent
OUT = WORK / 'compact'
OUT.mkdir(exist_ok=True)
sha = lambda b: hashlib.sha256(b).hexdigest()

def write(name, data):
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def compact(value):
    if isinstance(value, list):
        return [compact(v) for v in value]
    if not isinstance(value, dict):
        return value
    result = {}
    for k, v in value.items():
        if k == 'engine':
            result[k] = {key: v.get(key) for key in ('sourceId', 'wasmSha256', 'jsSha256', 'buildMode', 'baseCommit')}
        elif k == 'checked' and isinstance(v, list):
            result['checkedCount'] = len(v)
            result['wholePublishedLayoutChecked'] = 'whole-document-published-layout' in v
        elif k == 'message':
            continue
        else:
            result[k] = compact(v)
    return result

plan = json.loads((WORK / 'plan.json').read_text(encoding='utf-8'))
package = Path(plan['enginePackage'])
metadata = json.loads((package / 'jueony-engine-build.json').read_text(encoding='utf-8'))
assert metadata['sourceId'] == '5fd129829b65b02d'
for file, key in [('rhwp_bg.wasm', 'wasmSha256'), ('rhwp.js', 'jsSha256')]:
    assert sha((package / file).read_bytes()) == metadata[key]
write('engine-metadata.json', metadata)
write('plan.json', plan)
sources = []
summary = {'sourceId': metadata['sourceId'], 'groups': [], 'totalPassed': 0,
           'totalFailed': 0, 'actualHancomCrossFormat': 'BLOCKED_BEFORE_WRITE',
           'limitations': ['Font scope success is not complete MCST conversion success.',
                          'Historical same-engine native lineage preservation is not a claim of equality with the actual sixteen-page Hancom file.',
                          'No new native GUI, screen or print test was performed in these groups.']}
for group in plan['groups']:
    name = group['name']
    script = ROOT / group['script']
    assert sha(script.read_bytes()) == group['scriptSha256']
    path = WORK / name / 'result.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    assert data['engine']['wasmSha256'] == metadata['wasmSha256']
    assert not data['failures']
    assert len(data['results']) == group['count']
    write(f'results/{name}.json', compact(data))
    shutil.copyfile(script, OUT / script.name)
    shutil.copyfile(WORK / f'{name}.log', OUT / f'{name}.log')
    sources.append({'path': str(path.relative_to(ROOT)), 'sha256': sha(path.read_bytes()), 'bytes': path.stat().st_size,
                    'archive': f'results/{name}.json', 'transformation': 'Engine metadata deduplicated; checked path lists reduced to count and whole-layout presence; issue messages omitted. All pass/fail, exact fonts, source hashes, numeric geometry, pages and cycle outcomes retained.'})
    summary['groups'].append({'name': name, 'passed': len(data['results']), 'failed': len(data['failures']),
                              'verifierSha256': sha(script.read_bytes())})
    summary['totalPassed'] += len(data['results'])

for label, rel in [('font3', 'build/font-fallback-storage-baseline80/result.json'),
                   ('mcst15', 'build/file-closure81-historical-baseline80/result.json'),
                   ('whole-layout7', 'build/file-closure81-layout-baseline80/result.json')]:
    path = ROOT / rel
    data = json.loads(path.read_text(encoding='utf-8'))
    write(f'baseline80/{label}.json', compact(data))
    sources.append({'path': rel, 'sha256': sha(path.read_bytes()), 'bytes': path.stat().st_size,
                    'archive': f'baseline80/{label}.json', 'transformation': 'Same compact representation; original baseline failures retained.'})

font = json.loads((WORK / 'font3/result.json').read_text(encoding='utf-8'))
assert font['status'] == 'FONT_SCOPE_PASS_FULL_CONVERSION_BLOCKED'
assert font['inputUnchanged'] and font['sourceUnchanged']
assert font['wholeDocument']['pages'] == {'before': 16, 'after': 15, 'equal': False}
summary['fontScope'] = {k: font[k] for k in ('status', 'inputUnchanged', 'sourceUnchanged', 'wholeDocument', 'preservation')}
whole = json.loads((WORK / 'whole-layout7/result.json').read_text(encoding='utf-8'))
actual = next(o for o in whole['observations'] if o.get('label') == 'actual')
assert actual['writes'] == 0
summary['actualHancomCrossFormatEvidence'] = compact(actual)
summary['historical'] = compact(next(o for o in whole['observations'] if o.get('label') == 'historical-native-lineage'))
write('summary.json', summary)
write('original-evidence-hashes.json', sources)

dependencies = ['apps/editor/scripts/lib/hancom-review.mjs',
                'apps/editor/src/adapters/rhwp/preservation.ts',
                'apps/editor/src/adapters/rhwp/document-save-layout.ts']
write('reproduction.json', {'node': '22.22.2', 'arguments': ['--experimental-strip-types'],
      'environment': {'JUEONY_ENGINE_PACKAGE': 'absolute directory matching engine-metadata.json',
                      'JUEONY_REPOSITORY': 'absolute unchanged repository with read-only pinned public and self-authored test inputs',
                      'JUEONY_TEST_OUTPUT': 'fresh absolute per-group output'},
      'dependencies': [{'path': rel, 'sha256': sha((ROOT / rel).read_bytes())} for rel in dependencies],
      'publicInputCopied': False, 'wholeSnapshotsCopied': False, 'fontProgramsCopied': False,
      'binaryCopied': False, 'comparisonToleranceUnchanged': 0.2})
shutil.copyfile(Path(__file__), OUT / 'package.py')
verify = '''from pathlib import Path
import hashlib,json
r=Path(__file__).resolve().parent
m=json.loads((r/'manifest.json').read_text(encoding='utf-8'))
for e in m['files']:
 p=r/e['path'];b=p.read_bytes()
 assert len(b)==e['bytes'] and hashlib.sha256(b).hexdigest()==e['sha256'],e['path']
print('PASS',len(m['files']),'exact SHA256 payloads')
'''
(OUT / 'verify.py').write_text(verify, encoding='utf-8')
payloads = [{'path': str(p.relative_to(OUT)).replace('\\', '/'), 'bytes': p.stat().st_size,
             'sha256': sha(p.read_bytes())} for p in sorted(OUT.rglob('*')) if p.is_file() and p.name != 'manifest.json']
write('manifest.json', {'schemaVersion': 1, 'scope': 'Formal81 independent font/storage/whole-layout gate validation; includes immutable failed formal80 baselines.', 'files': payloads})
print(json.dumps({'passed': summary['totalPassed'], 'failed': summary['totalFailed'],
                 'payloads': len(payloads), 'bytes': sum(x['bytes'] for x in payloads),
                 'manifestSha256': sha((OUT / 'manifest.json').read_bytes())}, indent=2))
