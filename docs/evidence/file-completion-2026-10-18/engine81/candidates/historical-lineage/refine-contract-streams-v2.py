from pathlib import Path
import shutil

work=Path(__file__).resolve().parent
failed=work/'failed-v1'
failed.mkdir()
for name in ['native-candidate-v1.log','candidate-source-proof.json','explicit-hwp5-origin-return80.patch']:
    shutil.copy2(work/name,failed/name)
candidate=work/'source-candidate80'
rel=Path('src/document_core/converters/hwpx_to_hwp.rs')
shutil.copy2(candidate/rel,failed/'hwpx_to_hwp.rs')
shutil.copy2(candidate/'tests/jueony_historical_origin.rs',failed/'jueony_historical_origin.rs')
path=candidate/rel
source=path.read_text(encoding='utf-8')
source=source.replace('Only the unambiguous, otherwise stream-free owner is restored here;',
                      'Only the unambiguous owner with the parser contract streams is restored;')
source=source.replace('            && doc.extra_streams.is_empty()', '''            && doc.extra_streams.len() == 6
            && doc.extra_streams.iter().all(|(path, _)| {
                matches!(
                    path.as_str(),
                    "/PrvText"
                        | "/PrvImage"
                        | "/Scripts/DefaultJScript"
                        | "/HwpSummaryInformation"
                        | "/DocOptions/_LinkDoc"
                        | "/Scripts/JScriptVersion"
                )
            })
            && doc.extra_streams.iter().map(|(path, _)| path).collect::<BTreeSet<_>>().len()
                == doc.extra_streams.len()''')
path.write_bytes(source.replace('\n','\r\n').encode('utf-8'))
path=candidate/'tests/jueony_historical_origin.rs'
source=path.read_text(encoding='utf-8').replace(' assert!(d.document().extra_streams.is_empty(),"narrow stream-free owner proof");',
 ' assert_eq!(d.document().extra_streams.len(),6,"parser standard contract streams");')
path.write_text(source,encoding='utf-8',newline='\n')
source=(work/'run-candidate.sh').read_text(encoding='utf-8').replace('candidate-v1','candidate-v2').replace('actual11-v1','actual11-v2')
(work/'run-candidate-v2.sh').write_text(source,encoding='utf-8',newline='\n')
# Keep the boundary harness source identical in the unchanged formal80 baseline.
shutil.copy2(path,work/'source-baseline80/tests/jueony_historical_origin.rs')
