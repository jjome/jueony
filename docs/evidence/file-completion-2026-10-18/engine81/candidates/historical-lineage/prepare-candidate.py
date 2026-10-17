from pathlib import Path
import shutil, hashlib, json

repo = Path(__file__).resolve().parents[2]
work = Path(__file__).resolve().parent
base = repo / 'build/rhwp-engine/source-20fddc2d172763e6'
candidate = work / 'source-candidate80'
if candidate.exists():
    raise SystemExit('candidate already exists; preserve prior work')
shutil.copytree(base, candidate, ignore=shutil.ignore_patterns('pkg', 'target'))
tests = candidate / 'tests'
tests.mkdir(exist_ok=True)
old = repo / 'build/table-origin-closure77/source-candidate77'
for dirname in ['tests/fonts', 'samples']:
    if (old / dirname).exists():
        shutil.copytree(old / dirname, candidate / dirname, dirs_exist_ok=True)
for dirname in ['final-inputs', 'hancom-current', 'support']:
    shutil.copytree(old.parent / dirname, work / dirname)
for name in ['independent-oracle68.json','multiline-original-prepared.hwp',
             'caption-original-prepared.hwp','positive-original-prepared.hwp']:
    shutil.copy2(old.parent / name, work / name)
shutil.copy2(old / 'tests/jueony_actual11.rs', tests / 'jueony_actual11.rs')
path = candidate / 'src/document_core/converters/hwpx_to_hwp.rs'
source = path.read_text(encoding='utf-8')
source = source.replace('Document, HwpVersion, Section, SectionDef, HWP3_ORIGIN_STREAM_PATH, HWPX_ORIGIN_STREAM_PATH,',
    'Document, HwpVersion, Section, SectionDef, HWP3_ORIGIN_HWPX_MARKER_PATH,\n    HWP3_ORIGIN_STREAM_PATH, HWP5_ORIGIN_HWPX_MARKER_PATH,\n    HWP5_ORIGIN_HWPX_PARAGRAPH_AXIS, HWPX_ORIGIN_STREAM_PATH,')
needle = '    if matches!(source_format, FileFormat::Hwpx)\n        && !doc\n            .extra_streams'
assert source.count(needle) == 1
source = source.replace(needle, '''    // A container conversion is not a new layout origin.  The paragraph-axis
    // HWP5 provenance is explicit, not inferred from cached line coordinates.
    // Only the unambiguous, otherwise stream-free owner is restored here;
    // opaque/legacy/conflicting provenance keeps the existing conversion path.
    // Existing streams are never removed or rewritten by this decision.
    let explicit_hwp5_paragraph_origin =
        doc.provenance.format == crate::model::provenance::SourceFormat::Hwpx
            && !doc.provenance.hwp3_lineage
            && !doc.provenance.hwpx_lineage
            && doc.extra_streams.is_empty()
            && !doc
                .hwpx_aux_entries
                .iter()
                .any(|(p, _)| p == HWP3_ORIGIN_HWPX_MARKER_PATH)
            && {
                let mut origins = doc
                    .hwpx_aux_entries
                    .iter()
                    .filter(|(p, _)| p == HWP5_ORIGIN_HWPX_MARKER_PATH);
                matches!(origins.next(), Some((_, payload))
                    if payload.as_slice() == HWP5_ORIGIN_HWPX_PARAGRAPH_AXIS)
                    && origins.next().is_none()
            };
    if matches!(source_format, FileFormat::Hwpx)
        && !explicit_hwp5_paragraph_origin
        && !doc
            .extra_streams''')
path.write_text(source, encoding='utf-8', newline='\n')
with (candidate / 'Cargo.toml').open('a', encoding='utf-8') as f:
    for name in ['jueony_historical_origin','jueony_actual11']:
        f.write(f'\n[[test]]\nname = "{name}"\npath = "tests/{name}.rs"\n')
manifest=[]
for p in sorted((base/'src').rglob('*.rs')):
    q=candidate/p.relative_to(base)
    before=hashlib.sha256(p.read_bytes()).hexdigest()
    after=hashlib.sha256(q.read_bytes()).hexdigest()
    manifest.append({'path':p.relative_to(base).as_posix(),'before':before,'after':after})
(work/'source-proof-initial.json').write_text(json.dumps({'base':str(base),'candidate':str(candidate),
    'runtimeFiles':len(manifest),'changed':[r for r in manifest if r['before']!=r['after']],
    'files':manifest},indent=2),encoding='utf-8')
print(json.dumps({'candidate':str(candidate),'runtimeFiles':len(manifest),'changed':sum(r['before']!=r['after'] for r in manifest)}))
