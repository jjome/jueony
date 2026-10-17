"""Package bounded, self-authored width diagnostics; never copies a font/public body."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile
import xml.etree.ElementTree as ET

REPO = Path(__file__).resolve().parents[3]
BASE = REPO / 'build/Python3-width-own76'
REVIEW = BASE / 'review76'
OUT = BASE / 'compact-review76'
OUT.mkdir(exist_ok=True)

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def dump(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def copy(path, name=None):
    destination = OUT / (name or path.name)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, destination)

comparison = json.loads((REVIEW / 'comparison.json').read_text(encoding='utf-8'))
names = [entry['name'] for entry in comparison['files']]
assert len(names) == 4 and all('29868' in name for name in names)
for name in names:
    copy(BASE / name, 'fixtures/' + name)
    copy(REVIEW / (name + '.json'), 'readback/' + name + '.json')
for name in ['comparison.json', 'installed-font-numeric-proof.json',
             'read-four-files.mjs', 'read-installed-font-metrics.py', 'package-compact.py']:
    copy(REVIEW / name)
for name in ['manifest.json', 'READ-FIRST-CORRECTIONS.json',
             'prepare-own-widths.mjs', 'prepare-own-widths-char-break.mjs']:
    copy(BASE / name, 'preparation/' + name)
for path in sorted((BASE / 'hancom-captures').iterdir()):
    if path.is_file() and path.suffix in ['.png', '.txt']:
        copy(path, 'actual-hancom/' + path.name)

def local(tag):
    return tag.rsplit('}', 1)[-1]

xml_proofs = []
for name in names:
    with zipfile.ZipFile(BASE / name) as archive:
        header = ET.fromstring(archive.read('Contents/header.xml'))
        section = ET.fromstring(archive.read('Contents/section0.xml'))
        cell = next(node for node in section.iter() if local(node.tag) == 'tc')
        paragraphs = [node for node in cell.iter() if local(node.tag) == 'p']
        paragraph = next(node for node in paragraphs if any(local(n.tag) == 't' and n.text for n in node.iter()))
        para_id = paragraph.attrib['paraPrIDRef']
        para = next(node for node in header.iter() if local(node.tag) == 'paraPr' and node.get('id') == para_id)
        run = next(node for node in paragraph if local(node.tag) == 'run' and node.get('charPrIDRef') is not None)
        char = next(node for node in header.iter() if local(node.tag) == 'charPr' and node.get('id') == run.get('charPrIDRef'))
        xml_proofs.append({'name': name, 'sha256': digest(BASE / name),
            'paragraph': paragraph.attrib, 'paraPr': para.attrib,
            'align': [node.attrib for node in para if local(node.tag) == 'align'],
            'breakSetting': [node.attrib for node in para if local(node.tag) == 'breakSetting'],
            'charPr': char.attrib,
            'fontRefs': [node.attrib for node in char if local(node.tag) == 'fontRef'],
            'ratio': [node.attrib for node in char if local(node.tag) == 'ratio'],
            'rawLineSegments': [node.attrib for node in paragraph.iter() if local(node.tag) == 'lineseg'],
            'cellSize': [node.attrib for node in cell if local(node.tag) == 'cellSz']})
dump('four-file-raw-xml.json', xml_proofs)
for proof in xml_proofs:
    expected = [] if proof['name'].startswith('own-') else ['0', '31']
    assert [line['textpos'] for line in proof['rawLineSegments']] == expected, proof['name']
for entry in comparison['files']:
    assert entry['partitions'][0]['textChars'] == (30 if entry['name'].startswith('own-') else 31)
assert [(item['semantic']['count'], item['geometry']['count']) for item in comparison['comparisons']] == [(0, 38), (0, 10)]

source_root = REPO / 'build/rhwp-engine/source-23d2545926a179a5'
source_spans = {
    'src/renderer/composer/line_breaking.rs': [(450, 466), (1246, 1253), (1469, 1510), (3797, 3827)],
    'src/renderer/composer.rs': [(3438, 3459)],
    'src/renderer/layout/text_measurement.rs': [(991, 1001), (1430, 1446), (1665, 1693)],
    'src/renderer/layout/paragraph_layout.rs': [(2444, 2481)],
    'src/parser/hwpx/header.rs': [(1115, 1127)]
}
proofs = []
for relative, spans in source_spans.items():
    path = source_root / relative
    lines = path.read_text(encoding='utf-8').splitlines()
    proofs.append({'path': relative, 'sha256': digest(path), 'excerpts': [
        {'startLine': start, 'endLine': end, 'lines': lines[start-1:end]} for start, end in spans]})
dump('readonly-engine-source-proof.json', {'engineSourceId': '23d2545926a179a5', 'files': proofs,
    'note': 'Existing source only. Stored-row paint compression is downstream of line selection and is not a proven fresh Hancom fit rule.'})

dump('preparation-failures-and-corrections.json', {
    'status': 'DIAGNOSIS_NOT_A_FIX', 'originalInputsChanged': False,
    'productionMetricOrGuardChanged': False,
    'errors': [
        {'kind': 'interpretation', 'initialClaim': 'KEEP_WORD meant word breaking; API koreanBreakUnit=1 failed.',
         'correction': 'Existing engine #2185 contract is inverted relative to the schema label: KEEP_WORD sets bit7=1, character breaking. API output was correct. The original no-ls series is source-matched.'},
        {'kind': 'preparation', 'initialOperation': 'Reused mutable ZipInfo while reading and writing one diagnostic variant.',
         'result': 'In-memory CRC/header-offset error; originals were not changed. Incomplete variant and corrected later variants remain in the parent ignored build folder, outside the measured four-file set.'},
        {'kind': 'filename-and-manifest-label', 'series': '*-char-break-v3-no-ls.hwpx',
         'correction': 'These explicitly use BREAK_WORD, bit7=0, and are WORD-BREAK negative controls. They are not source-matched character fixtures despite the old filenames/labels.'}
    ],
    'rejectedHypotheses': [
        {'claim': 'JUSTIFY-specific word-space compression alone explains fresh Hancom acceptance of character 31.',
         'status': 'DISPROVED', 'counterexample': 'Actual Hancom LEFT output also has lineStarts [0,31] at width 29868HU. LEFT alignment is preserved.'}
    ],
    'unresolved': 'The fresh Hancom line-fit mechanism that accepts character 31 remains unknown. Existing engine paint compression for a stored row does not establish the fresh line-fit rule.',
    'limitations': ['No global width, fit tolerance, or preservation comparator changes were made.',
                    'The actual Hancom threshold across other widths is not measured.',
                    'Own snapToGrid=1 differs from public source snapToGrid=0. No horizontal character grid or tabs occur, but complete property identity is not claimed.',
                    'Observed imported-row owner and no-LS fresh paths differ. Do not replace original cached rows or normalize layout provenance from this evidence alone.']
})

dump('summary.json', {
    'engineSourceId': comparison['engine']['sourceId'],
    'engineWasmSha256': comparison['engine']['wasmSha256'],
    'result': 'REPRODUCED_UNRESOLVED',
    'actualHancomEvidence': 'Root performed actual Open(no-LS own document) and SaveAs; this worker only read files and packaged their own-text evidence.',
    'fourFiles': [{k: item[k] for k in ['name', 'sha256', 'sourceFormat', 'partitions']}
                  | {'hwp5OriginHwpx': item['info']['hwp5OriginHwpx']} for item in comparison['files']],
    'comparisons': [{'alignment': item['alignment'], 'semanticDifferences': item['semantic']['count'],
                     'geometryDifferences': item['geometry']['count']} for item in comparison['comparisons']],
    'publicSourceSeparation': {
        'source': 'Public originals and full public snapshots are deliberately excluded.',
        'fontSlots': 'All source targeted slots resolve to GulimChe, metricEntry588; own fixtures resolve to that same family/metric.',
        'target1': 'Hanging indent -1064HU; raw source starts [0,33], Hancom [0,31], cleared-cache [0,31].',
        'target2': 'Indent0; raw source starts [0,31,63], Hancom [0,31,61], cleared-cache [0,30,60].',
        'boundary1': 'Character30 U+C791 and character31 U+AD8C are ordinary precomposed Hangul; no NBSP/combining boundary.',
        'boundary2': 'Comma U+002C binds to preceding Hangul token in the current tokenizer; this is a different later boundary.',
        'owner': 'Original target rows retain imported row ownership with frameProvenanceIncomplete; fresh no-LS reflows. This prevents attributing the current 92 residual differences to a universal fresh-width rule.'},
    'scope': 'Self-authored fixtures, original SHA, engine readback, all existing geometry comparator fields at unchanged0.2, numeric installed font measurements only. No font program/public body/engine binary copied.'
})
dump('reproduce.json', {
    'runFrom': str(REPO),
    'enginePackage': 'build/rhwp-engine/source-23d2545926a179a5/pkg',
    'node22': 'C:/Users/jjome/AppData/Local/Volta/tools/image/node/22.22.2/node.exe',
    'commands': [
        'node --experimental-strip-types build/Python3-width-own76/review76/read-four-files.mjs',
        'C:/Python314/python.exe build/Python3-width-own76/review76/read-installed-font-metrics.py',
        'C:/Python314/python.exe build/Python3-width-own76/review76/package-compact.py',
        'C:/Python314/python.exe build/Python3-width-own76/compact-review76/verify_manifest.py'],
    'inputHandling': 'Restore the four fixtures under build/Python3-width-own76 with their original names. Reader and font reader write review outputs only. Packaging never launches Hancom.',
    'fontHandling': 'Font program must already exist on the local Windows system. It is read in place, not copied. Optional public source raw audit is skipped when its ignored raw file is absent.',
    'capturedGui': 'Actual Hancom root-owned captures include LEFT SaveAs and disk reopen. The historical word-justify capture filename does not change the source KEEP_WORD/bit7=1 character-breaking contract.',
    'verification': 'Packager asserts raw starts absent/source and [0,31]/actual, fresh30 vs actual31 and exact unchanged semantic0/geometry38,10 before manifest generation.'})

verify = '''from pathlib import Path
import hashlib,json
p=Path(__file__).resolve().parent
m=json.loads((p/'manifest-sha256.json').read_text(encoding='utf-8'))
for f in m['files']:
 b=(p/f['path']).read_bytes()
 assert len(b)==f['bytes'], f['path']
 assert hashlib.sha256(b).hexdigest()==f['sha256'], f['path']
print('PASS',len(m['files']),'compact evidence files')
'''
(OUT / 'verify_manifest.py').write_text(verify, encoding='utf-8')
files = [{'path': path.relative_to(OUT).as_posix(), 'bytes': path.stat().st_size, 'sha256': digest(path)}
         for path in sorted(OUT.rglob('*')) if path.is_file() and path.name != 'manifest-sha256.json']
dump('manifest-sha256.json', {'schemaVersion': 1, 'source': 'Self-authored width review76 only',
                             'excluded': ['font program', 'public body', 'WASM/EXE', 'public full snapshots'], 'files': files})
print('PACKAGED', len(files), 'files', sum(item['bytes'] for item in files), 'bytes', OUT)
