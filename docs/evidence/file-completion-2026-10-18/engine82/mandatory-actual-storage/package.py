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
    out = {}
    for key, value in v.items():
        if key == 'engine':
            out[key] = {k: value.get(k) for k in ('sourceId', 'wasmSha256', 'jsSha256', 'buildMode', 'baseCommit')}
        elif key == 'checked' and isinstance(value, list):
            out['checkedCount'] = len(value)
            out['wholePublishedLayoutChecked'] = 'whole-document-published-layout' in value
        elif key != 'message':
            out[key] = compact(value)
    return out

pkg = ROOT / 'build/rhwp-engine/source-65b8886bcdae0760/pkg'
metadata = json.loads((pkg / 'jueony-engine-build.json').read_text(encoding='utf-8'))
assert metadata['sourceId'] == '65b8886bcdae0760'
assert sha((pkg / 'rhwp_bg.wasm').read_bytes()) == metadata['wasmSha256']
assert sha((pkg / 'rhwp.js').read_bytes()) == metadata['jsSha256']
write('engine-metadata.json', metadata)
groups = [('font3', 'verify-font-fallback-storage-engine.mjs', 'font3-final', 3),
          ('mcst15', 'verify-mcst-flow-spacing-engine.mjs', 'mcst15', 15),
          ('whole-layout7', 'verify-document-save-layout-engine.mjs', 'whole-layout7', 7)]
summary = {'sourceId': metadata['sourceId'], 'groups': [], 'baseline81': [],
           'actualContract': {'bothFormatsTwice': True, 'alternatingSixSteps': True,
                              'pageCount': 16, 'semanticDifferences': 0, 'geometryDifferences': 0,
                              'productionPreservation': 'checked', 'publicDerivedBytesWritten': 0},
           'limitations': ['Pinned actual MCST same-engine conversion success is distinct from the original public HWP versus independently Hancom-saved HWPX comparison.',
                          'Historical fifteen-page lineage remains a separate corpus.',
                          'Python3 fresh line fitting and native screen/print equality are not closed here.']}
hashes = []
for label, script, suffix, count in groups:
    production = ROOT / 'apps/editor/scripts' / script
    final = json.loads((WORK / ('final82-' + suffix) / 'result.json').read_text(encoding='utf-8'))
    assert final['verifierSha256'] == sha(production.read_bytes())
    assert final['engine']['wasmSha256'] == metadata['wasmSha256']
    assert not final['failures'] and len(final['results']) == count
    baseline = json.loads((WORK / ('baseline81-' + suffix) / 'result.json').read_text(encoding='utf-8'))
    assert baseline['verifierSha256'] == final['verifierSha256'] and baseline['failures']
    write(f'final82/{label}.json', compact(final))
    write(f'baseline81/{label}.json', compact(baseline))
    shutil.copyfile(production, OUT / script)
    for prefix in ('baseline81-', 'final82-'):
        name = prefix + suffix
        source = WORK / name / 'result.json'
        hashes.append({'path': str(source.relative_to(ROOT)), 'sha256': sha(source.read_bytes()),
                       'bytes': source.stat().st_size, 'compactRepresentation': f'{prefix[:-1]}/{label}.json'})
        shutil.copyfile(WORK / (name + '.log'), OUT / (prefix + label + '.log'))
    summary['groups'].append({'name': label, 'passed': count, 'failed': 0,
                              'verifierSha256': final['verifierSha256']})
    summary['baseline81'].append({'name': label, 'failureCount': len(baseline['failures']),
                                  'failures': baseline['failures']})

mcst = json.loads((WORK / 'final82-mcst15/result.json').read_text(encoding='utf-8'))
assert sum(len(x.get('cycles', [])) for x in mcst['observations']) == 106
actual = next(x for x in mcst['observations'] if x.get('kind') == 'supported-actual-cross-format')
assert len(actual['cycles']) == 10
assert all(c['geometryDifferences'] == c['semanticDifferences'] == 0 and c['pages']['after'] == 16
           and c['preservation']['status'] == 'checked' for c in actual['cycles'])
font = json.loads((WORK / 'final82-font3-final/result.json').read_text(encoding='utf-8'))
assert font['status'] == 'FONT_SCOPE_PASS_AND_CONVERSION_CHECKED'
assert font['inputUnchanged'] and font['sourceUnchanged']
summary['strictMCSTReopens'] = 106
summary['allGroupsPassed'] = 25
write('summary.json', summary)
write('raw-result-hashes.json', hashes)
dependencies = ['apps/editor/src/adapters/rhwp/preservation.ts',
                'apps/editor/src/adapters/rhwp/document-save-layout.ts',
                'apps/editor/scripts/lib/hancom-review.mjs']
write('reproduction.json', {'node': '22.22.2', 'arguments': ['--experimental-strip-types'],
      'environment': {'JUEONY_ENGINE_PACKAGE': 'absolute final82 package matching engine-metadata.json',
                      'JUEONY_REPOSITORY': 'absolute repository with immutable SHA-pinned fixtures',
                      'JUEONY_TEST_OUTPUT': 'fresh absolute group directory'},
      'dependencies': [{'path': p, 'sha256': sha((ROOT / p).read_bytes())} for p in dependencies],
      'sourceFilesChanged': [p[1] for p in groups],
      'runtimeGuardsChanged': False, 'comparisonTolerance': 0.2,
      'unknownGuardVerifiersChanged': False, 'existingCorruptDTOInjectionStillRequired': True,
      'publicBytesSnapshotsFontsAndBinariesCopied': False})
shutil.copyfile(Path(__file__), OUT / 'package.py')
(OUT / 'verify.py').write_text("from pathlib import Path\nimport json,hashlib\nr=Path(__file__).resolve().parent\nm=json.loads((r/'manifest.json').read_text(encoding='utf-8'))\nfor x in m['files']:\n b=(r/x['path']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'],x['path']\nprint('PASS',len(m['files']),'exact SHA256 payloads')\n", encoding='utf-8')
files = [{'path': str(p.relative_to(OUT)).replace('\\', '/'), 'bytes': p.stat().st_size,
          'sha256': sha(p.read_bytes())} for p in sorted(OUT.rglob('*')) if p.is_file() and p.name != 'manifest.json']
write('manifest.json', {'schemaVersion': 1, 'scope': 'Formal81 new-positive failure and formal82 mandatory complete conversion success; no blocked-or-success alternative.', 'files': files})
print(json.dumps({'payloads': len(files), 'bytes': sum(x['bytes'] for x in files),
                  'manifestSha256': sha((OUT / 'manifest.json').read_bytes())}, indent=2))
