from pathlib import Path
import hashlib, json, shutil

ROOT = Path(__file__).resolve().parents[2]
WORK = Path(__file__).resolve().parent
OUT = WORK / 'compact'
OUT.mkdir(exist_ok=True)
sha = lambda b: hashlib.sha256(b).hexdigest()

def write(name, value):
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def compact(v):
    if isinstance(v, list):
        return [compact(x) for x in v]
    if not isinstance(v, dict):
        return v
    result = {}
    for key, value in v.items():
        if key == 'engine':
            result[key] = {k: value.get(k) for k in ('sourceId', 'wasmSha256', 'jsSha256', 'buildMode', 'baseCommit')}
        elif key == 'checked' and isinstance(value, list):
            result['checkedCount'] = len(value)
            result['wholePublishedLayoutChecked'] = 'whole-document-published-layout' in value
        elif key != 'message':
            result[key] = compact(value)
    return result

plan = json.loads((WORK / 'plan.json').read_text(encoding='utf-8'))
pkg = Path(plan['enginePackage'])
metadata = json.loads((pkg / 'jueony-engine-build.json').read_text(encoding='utf-8'))
assert metadata['sourceId'] == plan['sourceId'] == 'ad6186043c15532f'
for name, key in [('rhwp_bg.wasm', 'wasmSha256'), ('rhwp.js', 'jsSha256')]:
    assert sha((pkg / name).read_bytes()) == metadata[key]
write('engine-metadata.json', metadata)
write('plan.json', plan)
summary = {'sourceId': metadata['sourceId'], 'groups': [], 'passed': 0, 'failed': 0,
           'actualContract': {'pageCount': 16, 'bothFormatsTwice': True, 'alternatingSix': True,
                              'semanticDifferences': 0, 'geometryDifferences': 0,
                              'independentNativeNoteBytesMatch': True,
                              'realApiUndoRedo': True, 'productionGate': 'checked'},
           'limits': ['These groups prove preservation of the pinned actual-Hancom MCST source through this engine, not equality of the original public HWP and the independently saved Hancom HWPX.',
                      'Historical native lineage fifteen-page source remains separately preserved, not compared equal to sixteen pages.',
                      'Python3 fresh line fitting and complex-document print equality are outside these passed groups.',
                      'No new OS picker UI was performed by these Node verifiers; actual Hancom note-property evidence is a separate sibling archive.']}
raw = []
for group in plan['groups']:
    name = group['name']
    script = ROOT / group['script']
    assert sha(script.read_bytes()) == group['verifierSha256']
    path = WORK / name / 'result.json'
    d = json.loads(path.read_text(encoding='utf-8'))
    assert d['engine']['wasmSha256'] == metadata['wasmSha256']
    assert d['verifierSha256'] == group['verifierSha256']
    assert not d['failures'] and len(d['results']) == group['count']
    assert all(not isinstance(x, dict) or x.get('status') == 'PASS' for x in d['results'])
    write(f'results/{name}.json', compact(d))
    shutil.copyfile(script, OUT / script.name)
    shutil.copyfile(WORK / (name + '.log'), OUT / (name + '.log'))
    raw.append({'path': str(path.relative_to(ROOT)), 'sha256': sha(path.read_bytes()), 'bytes': path.stat().st_size,
                'compact': f'results/{name}.json', 'transformation': 'Engine metadata deduplicated; preservation checked paths reduced to count and whole-layout presence; messages omitted. Numeric outcomes, exact note metadata, loss status, every cycle result and failures retained.'})
    summary['groups'].append({'name': name, 'passed': group['count'], 'failed': 0,
                              'verifierSha256': group['verifierSha256']})
    summary['passed'] += group['count']

note = json.loads((WORK / 'note4/result.json').read_text(encoding='utf-8'))
actual = next(x for x in note['observations'] if x['kind'] == 'actual-note-contract')
assert len(actual['cycles']) == 10
for c in actual['cycles']:
    assert c['semanticDifferences'] == c['geometryDifferences'] == 0 and c['pages']['after'] == 16
    assert c['guardStatus'] == 'checked'
for n in actual['expected']:
    assert len(bytes.fromhex(n['rawHex'])) == 28
summary['actualIndependentNotes'] = actual['expected']
mcst = json.loads((WORK / 'mcst15/result.json').read_text(encoding='utf-8'))
assert sum(len(x.get('cycles', [])) for x in mcst['observations']) == 106
summary['mcstStrictReopens'] = 106
baseline = ROOT / 'build/note-shape-i32-candidate82/wasm-baseline82/result.json'
b = json.loads(baseline.read_text(encoding='utf-8'))
assert len(b['results']) == len(b['failures']) == 2
assert b['verifierSha256'] == next(g['verifierSha256'] for g in plan['groups'] if g['name'] == 'note4')
write('baseline82-note4.json', compact(b))
shutil.copyfile(baseline.parent.parent / 'wasm-baseline82.log', OUT / 'baseline82-note4.log')
summary['sameVerifierBaseline82'] = {'passed': 2, 'failed': 2, 'failures': b['failures'],
                                   'sha256': sha(baseline.read_bytes())}
write('summary.json', summary)
write('raw-result-hashes.json', raw)
dependencies = ['apps/editor/scripts/lib/hwp-summary-evidence.mjs', 'apps/editor/scripts/lib/hancom-review.mjs',
                'apps/editor/src/adapters/rhwp/preservation.ts', 'apps/editor/src/adapters/rhwp/document-save-layout.ts']
write('reproduction.json', {'node': '22.22.2', 'arguments': ['--experimental-strip-types'],
      'instructions': 'Run each exact-hash original script from the unchanged repository, using the absolute environment values in plan.json with a fresh per-group JUEONY_TEST_OUTPUT. Public inputs are pinned in the scripts and remain ignored/read-only.',
      'dependencies': [{'path': p, 'sha256': sha((ROOT / p).read_bytes())} for p in dependencies],
      'runtimeGuardOrComparisonChanged': False, 'comparisonTolerance': 0.2,
      'publicDerivativesBodySnapshotsFontProgramsOrBinariesArchived': False})
shutil.copyfile(Path(__file__), OUT / 'package.py')
(OUT / 'verify.py').write_text("from pathlib import Path\nimport json,hashlib\nr=Path(__file__).resolve().parent\nm=json.loads((r/'manifest.json').read_text(encoding='utf-8'))\nfor x in m['files']:\n b=(r/x['path']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'],x['path']\nprint('PASS',len(m['files']),'exact SHA256 payloads')\n", encoding='utf-8')
files = [{'path': str(p.relative_to(OUT)).replace('\\', '/'), 'bytes': p.stat().st_size,
          'sha256': sha(p.read_bytes())} for p in sorted(OUT.rglob('*')) if p.is_file() and p.name != 'manifest.json']
write('manifest.json', {'schemaVersion': 1, 'scope': 'Formal83 exact final engine four mandatory preservation groups and same-verifier formal82 native-note failures.', 'files': files})
print(json.dumps({'passed': summary['passed'], 'failed': 0, 'payloads': len(files),
                  'bytes': sum(x['bytes'] for x in files), 'manifestSha256': sha((OUT / 'manifest.json').read_bytes())}, indent=2))
