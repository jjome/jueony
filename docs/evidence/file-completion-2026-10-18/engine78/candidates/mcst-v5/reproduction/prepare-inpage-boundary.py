import pathlib
out=pathlib.Path('build/file-closure75-public-readonly')
prefix=(out/'baseline76/tests/jueony_mcst_exclusions.rs').read_text(encoding='utf-8').split('#[test]')[0]
body=r'''
#[test]
fn valid_inpage_restore_and_real_dirty_owner_match_formal76() {
 let root=PathBuf::from(std::env::var("JUEONY_REPO").unwrap());let out=root.join("build/file-closure75-public-readonly");let baseline=std::env::var("JUEONY_BASELINE").is_ok();
 let bytes=std::fs::read(root.join("build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx")).unwrap();
 let core=DocumentCore::from_bytes(&bytes).unwrap();let mut records=vec![];let mut failed=0;
 for mode in ["inpage-rebuilt-owner","actual-dirty-predecessor"] {
  let mut doc=core.document().clone();let controls=doc.sections[0].paragraphs[0].controls.clone();
  let plain=doc.sections[0].paragraphs[51].clone();assert!(plain.controls.is_empty());assert_eq!(plain.line_segs.len(),1);
  doc.sections[0].paragraphs=vec![plain;6];doc.sections.truncate(1);
  for (i,p) in doc.sections[0].paragraphs.iter_mut().enumerate(){p.controls.clear();p.field_ranges.clear();p.orphan_field_ends.clear();p.stored_text_partition_dirty=false;p.cell_format_vpos_dirty=false;p.column_type=Default::default();p.raw_break_type=0;
   let rebuilt=1100+i as i32*2400;p.line_segs[0].vertical_pos=rebuilt;p.source_line_seg_vertical_pos=Some(vec![rebuilt-100]);
  }
  doc.sections[0].paragraphs[0].controls=controls;
  let mut d=DocumentCore::from_bytes(&bytes).unwrap();d.set_document(doc);
  let mut dirty=false;if mode=="actual-dirty-predecessor"{let n=d.document().sections[0].paragraphs[1].text.chars().count();d.insert_text_native(0,1,n," CHECK").unwrap();dirty=d.document().sections[0].paragraphs[1].stored_text_partition_is_dirty();assert!(d.document().sections[0].paragraphs[1].text.ends_with(" CHECK"),"must exercise actual API edit");}
  let before=model(&d);let actual=state(&d);let immutable=before==model(&d);let model_sha=sha(&serde_json::to_vec(&before).unwrap());let path=out.join(format!("formal76-boundary-{mode}.json"));
  let current=json!({"geometry":actual,"modelSHA":model_sha,"pages":d.page_count(),"readOnly":immutable,"dirtyOwner":dirty,"sourceSnapshot":d.document().sections[0].paragraphs.iter().map(|p|&p.source_line_seg_vertical_pos).collect::<Vec<_>>(),"rebuiltPositions":d.document().sections[0].paragraphs.iter().map(|p|p.line_segs.iter().map(|l|l.vertical_pos).collect::<Vec<_>>()).collect::<Vec<_>>()});
  if baseline{std::fs::write(path,serde_json::to_vec(&current).unwrap()).unwrap();records.push(json!({"mode":mode,"baseline":true,"pages":d.page_count(),"readOnly":immutable,"dirtyOwner":dirty}));}
  else{let expected:Value=serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();let mut delta=vec![];diff(&expected["geometry"],&current["geometry"],"$",&mut delta);let same=expected["modelSHA"]==current["modelSHA"];let passed=delta.is_empty()&&same&&immutable;if !passed{failed+=1;}records.push(json!({"mode":mode,"passed":passed,"pages":d.page_count(),"geometryDifferences":delta.len(),"firstDifferences":delta.iter().take(15).collect::<Vec<_>>(),"readOnly":immutable,"modelSame":same,"dirtyOwner":dirty}));}
 }
 let label=if baseline{"formal76-boundary-baseline.json"}else{"metrics-plan76-v5-boundary-result.json"};std::fs::write(out.join(label),serde_json::to_vec_pretty(&records).unwrap()).unwrap();assert_eq!(failed,0,"in-page restoration changed baseline published geometry");
}
'''
for folder in ['baseline76','metrics-plan-candidate76-v5']:
 p=out/folder
 (p/'tests/jueony_mcst_boundary.rs').write_text(prefix+body,encoding='utf-8')
 c=p/'Cargo.toml';s=c.read_text(encoding='utf-8')
 if 'name="jueony_mcst_boundary"' not in s:s+='\n[[test]]\nname="jueony_mcst_boundary"\npath="tests/jueony_mcst_boundary.rs"\n';c.write_text(s,encoding='utf-8')
