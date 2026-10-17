
use rhwp::{DocumentCore, model::control::Control};
use serde_json::{Value,json};
fn root()->std::path::PathBuf{std::env::var("JUEONY_REPO").unwrap().into()}
fn parse(s:&str)->Value{serde_json::from_str(s).unwrap()}
fn table(d:&DocumentCore)->&rhwp::model::table::Table{d.document().sections[0].paragraphs.iter().flat_map(|p|p.controls.iter()).find_map(|c|if let Control::Table(t)=c{Some(t)}else{None}).unwrap()}
fn geometry(d:&DocumentCore)->Value{json!((0..d.page_count()).map(|p|json!({"controls":parse(&d.get_page_control_layout_native(p).unwrap()),"text":parse(&d.get_page_text_layout_native(p).unwrap())})).collect::<Vec<_>>())}
fn diff(a:&Value,b:&Value,p:&str,out:&mut Vec<Value>){match(a,b){(Value::Number(a),Value::Number(b))=>{let measured=p.ends_with("/x")||p.ends_with("/y")||p.ends_with("/w")||p.ends_with("/h")||p.contains("/charX/");if if measured{(a.as_f64().unwrap()-b.as_f64().unwrap()).abs()>0.2}else{a!=b}{out.push(json!({"path":p,"before":a,"after":b}));}},(Value::Array(a),Value::Array(b))=>{if a.len()!=b.len(){out.push(json!({"path":p,"beforeLength":a.len(),"afterLength":b.len()}));}for(i,(a,b))in a.iter().zip(b).enumerate(){diff(a,b,&format!("{p}/{i}"),out)}},(Value::Object(a),Value::Object(b))=>{if a.keys().collect::<Vec<_>>()!=b.keys().collect::<Vec<_>>(){out.push(json!({"path":p,"keysChanged":true}));}for(k,a)in a{diff(a,&b[k],&format!("{p}/{k}"),out)}},_=>if a!=b{out.push(json!({"path":p,"before":a,"after":b}));}}}

fn raw(d:&DocumentCore)->Value{json!({"profile":format!("{:?}",d.document().layout_profile()),"info":parse(&d.get_document_info()),"charShapes":d.document().doc_info.char_shapes,"resolvedParagraphs":d.document().sections.iter().enumerate().map(|(si,s)|s.paragraphs.iter().enumerate().map(|(pi,_)|json!({"para":parse(&d.get_para_properties_at_native(si,pi).unwrap()),"char":parse(&d.get_char_properties_at_native(si,pi,0).unwrap())})).collect::<Vec<_>>()).collect::<Vec<_>>(),"sections":d.document().sections.iter().map(|s|json!({"rawStreamPresent":s.raw_stream.is_some(),"paragraphs":s.paragraphs.iter().enumerate().map(|(i,p)|json!({"index":i,"paragraph":p,"sourceVpos":p.source_line_seg_vertical_pos})).collect::<Vec<_>>()})).collect::<Vec<_>>()})}
fn fixture()->DocumentCore{
 let mut d=DocumentCore::new_empty();d.create_blank_document_native().unwrap();
 d.insert_text_native(0,0,0,"earlier").unwrap();d.insert_section_break_native(0,0,7).unwrap();
 d.insert_text_native(1,0,0,"본문 전").unwrap();d.split_paragraph_native(1,0,d.get_paragraph_length_native(1,0).unwrap(),None).unwrap();
 d.create_table_native(1,1,0,3,2).unwrap();
 for i in 0..6 {
  let width=if i%2==1{14000}else{6000};let height=[5000,7000,9000][i/2];
  d.set_cell_properties_native(1,1,0,i,&json!({"width":width,"height":height}).to_string()).unwrap();
  d.insert_text_in_cell_native(1,1,0,i,0,0,&format!("셀 {i} 😀")).unwrap();
  if i%2==1{let len=d.get_cell_paragraph_length_native(1,1,0,i,0).unwrap();d.apply_char_format_in_cell_native(1,1,0,i,0,0,len,r##"{"bold":true}"##).unwrap();}
 }
 d.split_paragraph_native(1,1,d.get_paragraph_length_native(1,1).unwrap(),None).unwrap();d.insert_text_native(1,2,0,"본문 후").unwrap();
 let mut d=DocumentCore::from_bytes(&d.export_hwpx_native().unwrap()).unwrap();
 d.split_paragraph_native(1,2,d.get_paragraph_length_native(1,2).unwrap(),None).unwrap();d.create_table_native(1,3,0,1,2).unwrap();
 for i in 0..2{d.set_cell_properties_native(1,3,0,i,&json!({"width":if i==1{14000}else{6000},"height":5000}).to_string()).unwrap();d.insert_text_in_cell_native(1,3,0,i,0,0,&format!("이웃{i}")).unwrap();}
 d.split_paragraph_native(1,3,d.get_paragraph_length_native(1,3).unwrap(),None).unwrap();d.insert_section_break_native(1,4,0).unwrap();
 d.insert_text_native(2,0,0,"다음 구역 본문").unwrap();d.split_paragraph_native(2,0,d.get_paragraph_length_native(2,0).unwrap(),None).unwrap();d.create_table_native(2,1,0,1,2).unwrap();d.insert_text_in_cell_native(2,1,0,0,0,0,"다음 구역 표").unwrap();d
}
fn export(d:&DocumentCore,f:&str)->Vec<u8>{let a=if f=="hwp"{d.export_hwp_with_adapter_snapshot_with_report().unwrap()}else{d.export_hwpx_native_with_report().unwrap()};assert!(a.content_loss().is_empty(),"{}",a.content_loss().to_json());a.bytes().to_vec()}
fn differences(a:&Value,b:&Value)->Vec<Value>{let mut x=vec![];diff(a,b,"",&mut x);x}
#[test]fn current_later_section_roundtrip(){let d=fixture();let before=geometry(&d);let source_raw=raw(&d);let mut results=vec![];for f in ["hwp","hwpx"]{let bytes=export(&d,f);let r=DocumentCore::from_bytes(&bytes).unwrap();results.push(json!({"format":f,"differences":differences(&before,&geometry(&r)),"reopened":raw(&r),"layout":geometry(&r)}));}std::fs::write(root().join("build/structure-closure77/native-candidate-raw.json"),serde_json::to_vec_pretty(&json!({"source":source_raw,"sourceAfterExport":raw(&d),"sourceLayout":before,"results":results})).unwrap()).unwrap();assert!(results.iter().all(|r|r["differences"].as_array().unwrap().is_empty()),"{}",json!(results.iter().map(|r|json!({"format":r["format"],"differences":r["differences"]})).collect::<Vec<_>>()));}
#[test]fn cache_and_source_vpos_control_diagnostics(){let d=fixture();let before=geometry(&d);let bytes=export(&d,"hwpx");let r=DocumentCore::from_bytes(&bytes).unwrap();let reopened=geometry(&r);let mut results=vec![];for mode in ["source-cache-reset","loaded-cache-reset","source-vpos-current","loaded-vpos-current","source-clear-snapshots","loaded-clear-snapshots","loaded-clear-host-lines","loaded-clear-tail-lines","source-clear-p0-lines","loaded-restore-p0-lines","loaded-restore-rawCtrl","source-clear-rawCtrl","loaded-restore-rawTableAttr","source-force-rawTableAttr","loaded-replace-p0-model","source-replace-p0-model","loaded-replace-table-model","source-replace-table-model"]{let source=mode.starts_with("source");let mut c=if source{fixture()}else{DocumentCore::from_bytes(&bytes).unwrap()};let mut doc=c.document().clone();if mode.ends_with("vpos-current"){for p in &mut doc.sections[2].paragraphs{p.source_line_seg_vertical_pos=Some(p.line_segs.iter().map(|s|s.vertical_pos).collect());}}if mode.ends_with("clear-snapshots"){for p in &mut doc.sections[2].paragraphs{p.source_line_seg_vertical_pos=None;}}if mode.ends_with("clear-host-lines"){doc.sections[2].paragraphs[1].line_segs.clear();doc.sections[2].paragraphs[1].source_line_seg_vertical_pos=None;}if mode.ends_with("clear-tail-lines"){for p in &mut doc.sections[2].paragraphs[2..]{p.line_segs.clear();p.source_line_seg_vertical_pos=None;}}
if mode=="source-clear-p0-lines"{doc.sections[2].paragraphs[0].line_segs.clear();doc.sections[2].paragraphs[0].source_line_seg_vertical_pos=None;}
if mode=="loaded-restore-p0-lines"{doc.sections[2].paragraphs[0].line_segs=d.document().sections[2].paragraphs[0].line_segs.clone();}
if mode=="loaded-replace-p0-model"{doc.sections[2].paragraphs[0]=d.document().sections[2].paragraphs[0].clone();}
if mode=="source-replace-p0-model"{doc.sections[2].paragraphs[0]=r.document().sections[2].paragraphs[0].clone();}
if mode=="loaded-replace-table-model"{doc.sections[2].paragraphs[1].controls=d.document().sections[2].paragraphs[1].controls.clone();}
if mode=="source-replace-table-model"{doc.sections[2].paragraphs[1].controls=r.document().sections[2].paragraphs[1].controls.clone();}
if let Control::Table(t)=&mut doc.sections[2].paragraphs[1].controls[0]{
 let Control::Table(original)=&d.document().sections[2].paragraphs[1].controls[0]else{panic!()};
 if mode=="loaded-restore-rawCtrl"{t.raw_ctrl_data=original.raw_ctrl_data.clone();}
 if mode=="source-clear-rawCtrl"{t.raw_ctrl_data.clear();}
 if mode=="loaded-restore-rawTableAttr"{t.raw_table_record_attr=original.raw_table_record_attr;}
 if mode=="source-force-rawTableAttr"{t.raw_table_record_attr=0x0400_0000;}
}
c.set_document(doc);let now=geometry(&c);results.push(json!({"mode":mode,"versusSource":differences(&before,&now),"versusReopened":differences(&reopened,&now),"raw":raw(&c),"layout":now}));}std::fs::write(root().join("build/structure-closure77/native-candidate-controls.json"),serde_json::to_vec_pretty(&results).unwrap()).unwrap();println!("CONTROLS:{}",json!(results.iter().map(|x|json!({"mode":x["mode"],"sourceDifferences":x["versusSource"].as_array().unwrap().len(),"reopenedDifferences":x["versusReopened"].as_array().unwrap().len()})).collect::<Vec<_>>()));}

#[test] fn full_live_two_codecs_two_cycles_and_snapshot_history() {
 let mut d=fixture();
 let start=geometry(&d); let snapshot=d.save_snapshot_native();
 d.insert_text_native(2,0,d.get_paragraph_length_native(2,0).unwrap()," 추가").unwrap();
 let edited=geometry(&d);let redo=d.save_snapshot_native();
 d.restore_snapshot_native(snapshot).unwrap();
 assert!(differences(&start,&geometry(&d)).is_empty(),"undo geometry");
 d.restore_snapshot_native(redo).unwrap();
 assert!(differences(&edited,&geometry(&d)).is_empty(),"redo geometry");
 for f in ["hwp","hwpx"] {
   let first=export(&d,f); let r1=DocumentCore::from_bytes(&first).unwrap();
   let x=differences(&edited,&geometry(&r1)); assert!(x.is_empty(),"{f} cycle1 {}",json!(x));
   let second=export(&r1,f); let r2=DocumentCore::from_bytes(&second).unwrap();
   let x=differences(&edited,&geometry(&r2)); assert!(x.is_empty(),"{f} cycle2 {}",json!(x));
 }
}

fn two_cycle_roundtrip(d:&DocumentCore, name:&str) {
 let expected=geometry(d);
 for f in ["hwp","hwpx"] {
  let bytes=export(d,f); let first=DocumentCore::from_bytes(&bytes).unwrap();
  let changes=differences(&expected,&geometry(&first));assert!(changes.is_empty(),"{name}/{f}/1:{}",json!(changes));
  let second_bytes=export(&first,f);
  let output=root().join("build/structure-closure77/candidate-outputs");std::fs::create_dir_all(&output).unwrap();std::fs::write(output.join(format!("{}-cycle2.{f}",name.replace(' ',"-"))),&second_bytes).unwrap();
  let second=DocumentCore::from_bytes(&second_bytes).unwrap();
  let changes=differences(&expected,&geometry(&second));assert!(changes.is_empty(),"{name}/{f}/2:{}",json!(changes));
 }
}
#[test] fn original_later_section_split_attach_live_sequence() {
 let mut d=fixture(); let before=geometry(&d); let token=d.save_snapshot_native();
 d.split_table_native(1,1,0,1).unwrap();two_cycle_roundtrip(&d,"split");
 d.merge_table_with_next_native(1,1,0).unwrap();two_cycle_roundtrip(&d,"attach");
 assert!(differences(&before,&geometry(&d)).is_empty(),"attach restored whole document");
 d.restore_snapshot_native(token).unwrap();two_cycle_roundtrip(&d,"undo split");
}
#[test] fn existing_imported_rows_and_invalid_constructor_are_not_reclassified() {
 let bytes=std::fs::read(root().join("build/structure-closure77/source-final.hwpx")).unwrap();
 let mut d=DocumentCore::from_bytes(&bytes).unwrap();
 let before=geometry(&d);let doc=serde_json::to_value(&d.document().sections[2].paragraphs).unwrap();
 assert!(d.create_table_native(2,1,0,0,2).is_err());
 assert_eq!(doc,serde_json::to_value(&d.document().sections[2].paragraphs).unwrap());
 assert_eq!(before,geometry(&d));
 let _=export(&d,"hwpx");
 assert_eq!(doc,serde_json::to_value(&d.document().sections[2].paragraphs).unwrap());
}

#[test] fn factory_provenance_source_and_imported_ladder_bytes_are_separate() {
 use sha2::{Digest,Sha256};
 let file="src/document_core/commands/object_ops/table.rs";
 let compiled=include_str!("../src/document_core/commands/object_ops/table.rs");
 let compiled_sha=Sha256::digest(compiled.as_bytes()).iter().map(|b|format!("{b:02x}")).collect::<String>();
 let disk=std::fs::read(root().join("build/structure-closure77/source").join(file)).unwrap();
 assert_eq!(compiled.as_bytes(),disk.as_slice());
 println!("FACTORY_COMPILED_SOURCE_SHA:{compiled_sha}");
 let d=fixture();
 assert!(d.document().sections[2].paragraphs[1].line_segs.iter().all(|ls|ls.tag & rhwp::model::paragraph::LineSeg::TAG_IMPLEMENTATION_PROPERTY==0));
 assert!(d.document().sections[2].paragraphs[2].line_segs.iter().all(|ls|ls.tag & rhwp::model::paragraph::LineSeg::TAG_IMPLEMENTATION_PROPERTY!=0));
}
