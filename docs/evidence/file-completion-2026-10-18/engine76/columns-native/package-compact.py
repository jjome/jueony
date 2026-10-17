"""Copy only owned column-layout evidence; never edit originals or permanent docs."""
from pathlib import Path
import hashlib
import json
import re
import shutil

REPO = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = HERE / 'compact-columns76'
OUT.mkdir(exist_ok=True)
origins = []

def sha(data):
    return hashlib.sha256(data).hexdigest()

def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def copy(source, destination):
    source = Path(source)
    data = source.read_bytes()
    target = OUT / destination
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    origins.append({'path': destination, 'source': source.relative_to(REPO).as_posix(),
                    'sourceSha256': sha(data), 'derivation': 'byte-exact copy'})

for name in [
    'handoff.json', 'generated-column-stack-delta-formal74.patch',
    'source-provenance-baseline.json', 'source-provenance-candidate.json',
    'helper-provenance.json', 'invalid-negative-fixture-proof.json',
    'negative-disk-feature-proof.json', 'fixed-oracle-compact.json',
    'verify-generated-columns.mjs', 'verify-generated-columns-canary73.mjs', 'verify-columns-browser.mjs', 'run-baseline.sh', 'run-candidate.sh',
    'run-baseline-tests-only.sh', 'run-candidate-tests-only.sh',
    'native-valid-baseline31-final.log',
    'native-valid-candidate40-final.log',
    'native-valid-candidate40-model-proof.log',
    'native-valid-candidate40-compact-oracle.log',
]:
    copy(HERE / name, name)
for name in ['src/renderer/generated_column_stack.rs', 'src/renderer/mod.rs',
             'src/renderer/typeset/controls/flow_table.rs', 'tests/jueony_generated_columns.rs']:
    copy(HERE / 'source' / name, 'candidate-source/' + name)
copy(HERE / 'baseline-source/tests/jueony_generated_columns.rs', 'baseline-source/tests/jueony_generated_columns.rs')

failure_history = []
for source in sorted(HERE.glob('native-*.log')) + sorted((HERE.parent / 'column2-candidate73').glob('native-*.log')):
    raw = source.read_bytes()
    text = raw.decode('utf-8-sig', errors='replace')
    if 'FAILED' not in text and 'error:' not in text and 'panicked' not in text:
        continue
    # Keep all failure/summary lines verbatim. Giant assert_eq JSON dumps remain
    # in the ignored original, and are bound by their complete original SHA.
    lines = []
    for line in text.splitlines():
        if len(line) > 16000:
            lines.append('[oversize line retained in original; utf8Sha256=' + sha(line.encode()) + ']')
        else:
            lines.append(line)
    destination = 'failure-history/' + source.parent.name + '-' + source.name
    target = OUT / destination
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    failure_history.append({'source': source.relative_to(REPO).as_posix(),
                            'sourceSha256': sha(raw), 'sourceBytes': len(raw),
                            'compactLog': destination,
                            'results': re.findall(r'test result:.*', text),
                            'classification': 'Preserved failure; see scope and source provenance. No prior failure is relabeled PASS.'})

for name in ['wasm73-negative-canary.log', 'wasm73-negative-canary/result.json']:
    copy(HERE / name, name)
for name in ['edge76-columns.log', 'edge76-columns/result.json', 'edge76-columns-isolated2.log']:
    copy(HERE / name, name)
for source in sorted((HERE / 'edge76-columns-isolated2').iterdir()):
    if source.is_file() and source.suffix in ['.json','.png','.hwp','.hwpx']:
        copy(source, 'edge76-columns-isolated2/' + source.name)
frozen = json.loads((REPO / 'build/file-closure69-overlap/independent-oracle68.json').read_text(encoding='utf-8-sig'))
fixture_paths = set()
for item in frozen['observations']:
    fixture_paths.add(Path(item['original']['path']))
    fixture_paths.add(REPO / 'build/file-closure69-overlap/hancom-current' / item['name'])
for source in sorted(fixture_paths):
    assert source.is_relative_to(REPO / 'build/file-closure69-overlap')
    copy(source, 'fixtures/' + source.relative_to(REPO).as_posix())
for source in sorted((HERE / 'valid-negative-disk').glob('baseline-*.hwp')):
    copy(source, 'fixtures/' + source.relative_to(REPO).as_posix())

dump(OUT / 'failure-history/index.json', failure_history)
dump(OUT / 'scope.json', {
    'status': 'PRIVATE_NATIVE40_PASS_BASELINE31_PASS_FORMAL76_WASM_PENDING',
    'candidatePatchSha256': sha((HERE / 'generated-column-stack-delta-formal74.patch').read_bytes()),
    'base': 'formal74 source-c2c0c48efdd724e2',
    'scope': 'Native HWP lineage, equal-width LTR two-column, ordinary first frame, exactly two full-body-width simple unprotected whole tables. Shared anchor/paint/occupied-bottom authority. Computed row heights preserve all real cell minima.',
    'unchanged': ['original source/cache/LINE_SEG bytes', 'serializer', 'loss/geometry protection', '0.2 geometry comparator', 'single-column positive and negative contracts'],
    'native': {'candidate': {'pass': 40, 'fail': 0, 'ignored': 0}, 'baseline': {'pass': 31, 'fail': 0, 'ignored': 0}},
    'fixedOracle': {'originalSha256': sha((REPO / 'build/file-closure69-overlap/independent-oracle68.json').read_bytes()),
                    'compact': 'fixed-oracle-compact.json',
                    'note': 'All 11 exact complete afterLayout arrays and fixture identity fields used by these tests. The original 5.4 MB snapshot is unchanged; this derived view is not a replacement or normalization of the comparator.'},
    'negativeScope': '30 boundaries compare complete live/IR/export-loss/reopened layout evidence exactly against an independently compiled baseline. Six previously stale low-level fixtures are rebuilt with actual raw_attr/common-margin dual writes and disk property assertions. Decoded feature proof separately labels existing unsupported synthetic Field/Unknown/cache/reset representations; they are NOT claimed as preserved disk features.',
    'failureHistory': 'All earlier failures are retained, including mtime/shared-target suspect results, fresh-source 35/39 failures, natural-height first failures and invalid-fixture failures. Fresh separate physical source/target plus compile-time flow/helper SHA is the basis for final results.',
    'wasm73Canary': {'pass': 18, 'fail': 6, 'note': 'Expected pre-fix failures: actual column2 37 fields, fixed oracle, strict HWPX layout guard, actual edit paths and old negative17. No API execution error. Not a candidate PASS.'},
     'edge': {'pass':5,'fail':0,'profile':'dist-file-closure-final76','sourceId':'23d2545926a179a5','output':'edge76-columns-isolated2','keyboardUndoRedo':True,'actualSaveAsUi':True,'sourceUnchanged':True,'writersEach':3,'pickersEach':1,'consolePageErrors':0,'canvasFontMetricsActive':False,'note':'Actual editor rendering and keyboard/UI commands; do not generalize to a separately activated Canvas font-metric mode. First sandbox launch failed with OS username/password error and is preserved separately; isolated escalated retry passed.'},
    'pending': ['Root formal76 WASM24/actual11 results are reported PASS but final result files must be appended by root', 'root integration regressions', 'XML-only final76b profile (different frontend fingerprint) is not covered by this first final76 browser run'],
    'nativeGui': 'No GUI launched by this worker. Actual Hancom inputs and immutable oracle were provided by root; no fresh Hancom screen/print equivalence is asserted.',
    'content': 'Only owned synthetic fixtures, source diffs, small logs and compact evidence; no public/user documents, font programs, WASM, EXE or original full snapshots.'
})

readme = '''Reproduce from the shared workspace; do not overwrite existing fixtures.

1. Run verify_manifest.py on this compact directory before copying anything.
2. Use formal74 source-c2c0c48efdd724e2, separate physical baseline/candidate
   sources, offline --locked Cargo, and DIFFERENT targets columns74-baseline
   and columns74-candidate. Do not alternate identical packages in one target.
3. The provided Native harness and run scripts record compile-time included
   flow/helper SHA and actual source/target directory. Candidate patch is only
   the three source files; Cargo test registration is private harness setup.
4. Fixtures retain original repository-relative paths and SHA. Restore only
   absent files into a clean temporary workspace, or verify existing hashes.
   The compact fixed oracle can be selected with JUEONY_COLUMN_ORACLE; it
   contains every afterLayout field consumed by the fixed geometry tests.
5. Final Native replay is native-valid-candidate40-compact-oracle.log. Old
   failures are in failure-history and remain failures, not replaced by this run.
6. For formal76 WASM use Node22 --experimental-strip-types and the ORIGINAL
   build-path verify-generated-columns.mjs (relative production reader imports).
   Set absolute JUEONY_REPO, JUEONY_ENGINE_PACKAGE,
   JUEONY_BASELINE_ENGINE_PACKAGE, JUEONY_TEST_OUTPUT (new empty output).
   The verifier uses unchanged production preservation/strict guard and every
   semantic/control/text geometry field; root appends the formal result later.
'''
(OUT / 'REPRODUCE.txt').write_text(readme, encoding='utf-8')
verifier = '''from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
for item in manifest['files']:
 p=(root/item['path']).resolve()
 assert p.is_relative_to(root) and p.is_file(),item['path']
 data=p.read_bytes()
 assert len(data)==item['bytes'] and hashlib.sha256(data).hexdigest()==item['sha256'],item['path']
print('PASS',len(manifest['files']),'files; exact SHA and size')
'''
(OUT / 'verify_manifest.py').write_text(verifier, encoding='utf-8')
copy(Path(__file__), 'package-compact.py')
files = [{'path': p.relative_to(OUT).as_posix(), 'bytes': p.stat().st_size,
          'sha256': sha(p.read_bytes())} for p in sorted(OUT.rglob('*')) if p.is_file() and p.name != 'manifest.json']
dump(OUT / 'manifest.json', {'schemaVersion': 1, 'files': files, 'origins': origins,
                            'totalBytes': sum(f['bytes'] for f in files),
                            'immutableOriginals': True,
                            'note': 'Prepared in ignored build only. Permanent docs/evidence untouched; formal76 results pending.'})
print('PASS compact package', len(files), 'files', sum(f['bytes'] for f in files), 'bytes', OUT)
