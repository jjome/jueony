use rhwp::DocumentCore;
use rhwp::model::{document::Document,control::Control};
use serde_json::{Value,json};use sha2::{Digest,Sha256};use std::path::PathBuf;
fn sha(b:&[u8])->String{Sha256::digest(b).iter().map(|b|format!("{b:02x}")).collect()}
fn state(d:&DocumentCore)->Value{json!((0..d.page_count()).map(|p|json!({"page":p,"controls":serde_json::from_str::<Value>(&d.get_page_control_layout_native(p).unwrap()).unwrap(),"text":serde_json::from_str::<Value>(&d.get_page_text_layout_native(p).unwrap()).unwrap()})).collect::<Vec<_>>())}
fn safe(v:&Value)->Value{match v{Value::Number(_)|Value::Null|Value::Bool(_)=>v.clone(),Value::String(s)=>json!({"kind":"string","characters":s.chars().count(),"sha256":sha(s.as_bytes())}),_=>json!({"kind":if v.is_array(){"array"}else{"object"},"sha256":sha(&serde_json::to_vec(v).unwrap())})}}
fn diff(a:&Value,b:&Value,p:&str,out:&mut Vec<Value>){match(a,b){(Value::Number(a),Value::Number(b))=>{let(x,y)=(a.as_f64().unwrap(),b.as_f64().unwrap());if !x.is_finite()||!y.is_finite()||(x-y).abs()>0.2{out.push(json!({"path":p,"before":a,"after":b}));}},(Value::Array(a),Value::Array(b))=>{if a.len()!=b.len(){out.push(json!({"path":format!("{p}/length"),"before":a.len(),"after":b.len()}));}for i in 0..a.len().max(b.len()){diff(a.get(i).unwrap_or(&Value::Null),b.get(i).unwrap_or(&Value::Null),&format!("{p}/{i}"),out);}},(Value::Object(a),Value::Object(b))=>{let keys:std::collections::BTreeSet<_>=a.keys().chain(b.keys()).collect();for k in keys{diff(a.get(k).unwrap_or(&Value::Null),b.get(k).unwrap_or(&Value::Null),&format!("{p}/{k}"),out);}},_=>if a!=b{out.push(json!({"path":p,"before":safe(a),"after":safe(b)}));}}}
fn input(name:&str)->DocumentCore { let repo=PathBuf::from(std::env::var("JUEONY_REPO").unwrap()); DocumentCore::from_bytes(&std::fs::read(repo.join("build/hancom-final-file-review-20261017").join(name)).unwrap()).unwrap() }
fn table_y(d:&DocumentCore)->f64 {for page in 0..d.page_count(){let v:Value=serde_json::from_str(&d.get_page_control_layout_native(page).unwrap()).unwrap();for c in v["controls"].as_array().unwrap(){if c["paraIdx"]==44&&c["type"]=="table" {return c["y"].as_f64().unwrap();}}}panic!("missing table")}
#[test]fn source_frame_ownership_and_physical_target(){
 let native=input("source-mcst-bid-2026.hwp");let xml=input("mcst-bid-2026-hwpx-hancom.hwpx");
 let probe=rhwp::renderer::layout::jueony_reconstructed_probe83;
 let pars=&xml.document().sections[0].paragraphs;
 for pi in 43..=45 {let p=&pars[pi];println!("BOUND pi={} field={} orphan={} ranges={} titles={} marks={} ctrl_data={} tab={} restart={} fill={} dirty={} cell_dirty={} col={:?} lines={}",pi,p.field_ranges.len(),p.orphan_field_ends.len(),p.range_tags.len(),p.title_marks.len(),p.markpen_marks.len(),p.ctrl_data_records.iter().filter(|x|x.is_some()).count(),p.tab_extended.len(),p.numbering_restart.is_some(),p.layout_only_fill_lines,p.stored_text_partition_is_dirty(),p.cell_format_vpos_dirty,p.column_type,p.line_segs.len());}
 if let Control::Table(t)=&pars[44].controls[0]{let c=&t.cells[0];println!("TABLE lock={} sizeprotect={} overlap={} row={} col={} cells={} zones={} wrap={:?} field={:?} protect={} textdir={} linewrap={} paras={} cell_dirty={}",t.common.locked,t.common.size_protect,t.common.allow_overlap,t.row_count,t.col_count,t.cells.len(),t.zones.len(),t.common.text_wrap,c.field_name,c.cell_protect(),c.text_direction,c.line_wrap,c.paragraphs.len(),c.dirty_flag);}
 if let Control::Table(t)=&pars[44].controls[0]{for (i,p) in t.cells[0].paragraphs.iter().enumerate(){println!("CELL p={} controls={} fields={} orphan={} ranges={} title={} mark={} cdata={} tabs={} restart={} fill={} col={:?} dirty={} cell_dirty={}",i,p.controls.len(),p.field_ranges.len(),p.orphan_field_ends.len(),p.range_tags.len(),p.title_marks.len(),p.markpen_marks.len(),p.ctrl_data_records.iter().filter(|x|x.is_some()).count(),p.tab_extended.len(),p.numbering_restart.is_some(),p.layout_only_fill_lines,p.column_type,p.stored_text_partition_is_dirty(),p.cell_format_vpos_dirty);}}
 let basis=probe(xml.document(),43); println!("PROBE {:?} sourceY={} xmlY={}",basis,table_y(&native),table_y(&xml));
 assert_eq!(basis,Some(66882));assert_eq!(probe(native.document(),43),None);assert!((table_y(&native)-table_y(&xml)).abs()<=0.2);
 let out=PathBuf::from(std::env::var("JUEONY_REPO").unwrap()).join("build/mcst-leading-gap83");
 std::fs::write(out.join("candidate-physical.json"),serde_json::to_vec_pretty(&json!({"basis":basis,"sourceY":table_y(&native),"actualY":table_y(&xml),"sourcePages":native.page_count(),"actualPages":xml.page_count()})).unwrap()).unwrap();
}
#[test]fn actual_both_codecs_two_cycles_full_geometry(){
 let source=input("mcst-bid-2026-hwpx-hancom.hwpx");let before=state(&source);let source_hash=sha(&serde_json::to_vec(&(format!("{:?}",source.document().doc_info), &source.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>())).unwrap());let mut results=vec![];
 for codec in ["hwp","hwpx"] {let mut current=input("mcst-bid-2026-hwpx-hancom.hwpx");for cycle in 1..=2 {
 let artifact=if codec=="hwp"{current.export_hwp_with_adapter_snapshot_with_report().unwrap()}else{current.export_hwpx_native_with_report().unwrap()};assert!(artifact.content_loss().is_empty());let bytes=artifact.into_bytes();let r=DocumentCore::from_bytes(&bytes).unwrap();let mut ds=vec![];diff(&before,&state(&r),"pages",&mut ds);results.push(json!({"codec":codec,"cycle":cycle,"pages":r.page_count(),"differences":ds.len(),"firstDifferences":ds.iter().take(5).collect::<Vec<_>>(),"outputSHA":sha(&bytes)}));current=r;
 }}
 let out=PathBuf::from(std::env::var("JUEONY_REPO").unwrap()).join("build/mcst-leading-gap83");std::fs::write(out.join("candidate-storage.json"),serde_json::to_vec_pretty(&results).unwrap()).unwrap();assert_eq!(source_hash,sha(&serde_json::to_vec(&(format!("{:?}",source.document().doc_info), &source.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>())).unwrap()));assert!(results.iter().all(|r|r["differences"]==0),"{results:?}");
}
#[test]fn incomplete_or_dirty_maps_remain_unowned(){
 let d=input("mcst-bid-2026-hwpx-hancom.hwpx");let original=d.document();let probe=rhwp::renderer::layout::jueony_reconstructed_probe83;
 let mut failures=vec![];
 for case in ["dirty-first","dirty-host","missing-first-map","missing-host-map","missing-next-map","unequal-host-offset","unequal-after-offset","next-control","locked-table","protected-cell","nested-cell","caption","inset-mismatch","synthetic-first","zero-inset","two-lines"]{
 let mut model=original.clone();let p=&mut model.sections[0].paragraphs;
 match case {
 "dirty-first"=>p[43].stored_text_partition_dirty=true,
 "dirty-host"=>p[44].cell_format_vpos_dirty=true,
 "missing-first-map"=>p[43].source_line_seg_vertical_pos=None,
 "missing-host-map"=>p[44].source_line_seg_vertical_pos=None,
 "missing-next-map"=>p[45].source_line_seg_vertical_pos=None,
 "unequal-host-offset"=>p[44].line_segs[0].vertical_pos+=1,
 "unequal-after-offset"=>p[45].line_segs[0].vertical_pos+=1,
 "next-control"=>{let c=p[44].controls[0].clone();p[45].controls.push(c)},
 "locked-table"=>if let Control::Table(t)=&mut p[44].controls[0]{t.common.locked=true},
 "protected-cell"=>if let Control::Table(t)=&mut p[44].controls[0]{t.cells[0].set_cell_protect(true)},
 "nested-cell"=>{let control=p[44].controls[0].clone();if let Control::Table(t)=&mut p[44].controls[0]{t.cells[0].paragraphs[0].controls.push(control)}},
 "caption"=>if let Control::Table(t)=&mut p[44].controls[0]{t.caption=Some(Default::default())},
 "inset-mismatch"=>p[43].source_line_seg_vertical_pos=Some(vec![301]),
 "synthetic-first"=>p[43].line_segs[0].tag|=rhwp::model::paragraph::LineSeg::TAG_IMPLEMENTATION_PROPERTY,
 "zero-inset"=>p[43].source_line_seg_vertical_pos=Some(vec![0]),
 "two-lines"=>{let l=p[43].line_segs[0].clone();p[43].line_segs.push(l)},_=>unreachable!()};
 if probe(&model,43).is_some(){failures.push(case);}
 }assert!(failures.is_empty(),"ownership wrongly accepted {failures:?}");
}
#[test]fn compiled_candidate_source_proof(){let path=PathBuf::from(env!("CARGO_MANIFEST_DIR"));for (file,b) in [("src/renderer/layout.rs",include_bytes!("../src/renderer/layout.rs").as_slice()),("src/renderer/typeset/section/vpos.rs",include_bytes!("../src/renderer/typeset/section/vpos.rs").as_slice()),("src/model/document.rs",include_bytes!("../src/model/document.rs").as_slice()),("src/document_core/commands/document.rs",include_bytes!("../src/document_core/commands/document.rs").as_slice())]{assert_eq!(b,std::fs::read(path.join(file)).unwrap());println!("COMPILED_SOURCE {file} {}",sha(b));}}

#[test]fn actual_api_edit_snapshot_undo_redo_exact(){
 let mut d=input("mcst-bid-2026-hwpx-hancom.hwpx");let before=state(&d);let snap=d.save_snapshot_native();
 d.apply_para_format_native(0,43,r#"{"spacingBefore":12}"#).unwrap();let edited=state(&d);assert_ne!(before,edited,"real API change required");let redo=d.save_snapshot_native();
 d.restore_snapshot_native(snap).unwrap();let mut undo_diff=vec![];diff(&before,&state(&d),"pages",&mut undo_diff);assert!(undo_diff.is_empty(),"undo {undo_diff:?}");
 d.restore_snapshot_native(redo).unwrap();let mut redo_diff=vec![];diff(&edited,&state(&d),"pages",&mut redo_diff);assert!(redo_diff.is_empty(),"redo {redo_diff:?}");
 let mut outputs=vec![];for hwpx in [false,true] {let report=if hwpx {d.export_hwpx_native_with_report().unwrap()} else {d.export_hwp_with_adapter_snapshot_with_report().unwrap()};assert!(report.content_loss().is_empty());let reopened=DocumentCore::from_bytes(&report.into_bytes()).unwrap();let mut delta=vec![];diff(&edited,&state(&reopened),"pages",&mut delta);outputs.push(json!({"hwpx":hwpx,"differences":delta.len(),"firstDifferences":delta.iter().take(3).collect::<Vec<_>>()}));}
 let out=PathBuf::from(std::env::var("JUEONY_REPO").unwrap()).join("build/mcst-leading-gap83");std::fs::write(out.join("candidate-history.json"),serde_json::to_vec_pretty(&outputs).unwrap()).unwrap();assert!(outputs.iter().all(|x|x["differences"]==0),"edited export {outputs:?}");
}

#[test]fn unrelated_later_page_edit_preserves_owned_frame_and_history(){
 let mut d=input("mcst-bid-2026-hwpx-hancom.hwpx");let before=state(&d);let y=table_y(&d);let snap=d.save_snapshot_native();
 let triplet=serde_json::to_vec(&d.document().sections[0].paragraphs[43..46]).unwrap();
 let (pi,n)=d.document().sections[0].paragraphs.iter().enumerate().rev().find(|(i,p)|*i>45&&!p.text.trim().is_empty()&&p.controls.is_empty()).map(|(i,p)|(i,p.text.chars().count())).unwrap();
 d.insert_text_native(0,pi,n,"Z").unwrap();let edited=state(&d);let edited_y=table_y(&d);let triplet_unchanged=triplet==serde_json::to_vec(&d.document().sections[0].paragraphs[43..46]).unwrap();let redo=d.save_snapshot_native();
 let mut outputs=vec![];for hwpx in [false,true] {let report=if hwpx {d.export_hwpx_native_with_report().unwrap()}else{d.export_hwp_with_adapter_snapshot_with_report().unwrap()};let loss=report.content_loss().is_empty();let reopened=DocumentCore::from_bytes(&report.into_bytes()).unwrap();let mut delta=vec![];diff(&edited,&state(&reopened),"pages",&mut delta);outputs.push(json!({"hwpx":hwpx,"contentLossEmpty":loss,"differences":delta.len(),"firstDifferences":delta.iter().take(4).collect::<Vec<_>>() }));}
 d.restore_snapshot_native(snap).unwrap();let mut ud=vec![];diff(&before,&state(&d),"pages",&mut ud);d.restore_snapshot_native(redo).unwrap();let mut rd=vec![];diff(&edited,&state(&d),"pages",&mut rd);
 let out=PathBuf::from(std::env::var("JUEONY_REPO").unwrap()).join("build/mcst-leading-gap83");std::fs::write(out.join("candidate-unrelated-edit.json"),serde_json::to_vec_pretty(&json!({"editedParagraph":pi,"sourceY":y,"editedY":edited_y,"tripletUnchanged":triplet_unchanged,"undoDifferences":ud.len(),"redoDifferences":rd.len(),"outputs":outputs})).unwrap()).unwrap();
 assert!(triplet_unchanged);assert!((y-edited_y).abs()<=0.2,"unrelated edit must not move source-owned table");assert!(ud.is_empty());assert!(rd.is_empty());assert!(outputs.iter().all(|r|r["contentLossEmpty"]==true&&r["differences"]==0),"unrelated edited save {outputs:?}");
}

#[test]fn real_local_style_and_metric_edits_revoke_source_frame(){
 for operation in ["style","font-size","paragraph-margin","paragraph-line-spacing"] {
 let mut d=input("mcst-bid-2026-hwpx-hancom.hwpx");
 assert!(rhwp::renderer::layout::jueony_reconstructed_probe83(d.document(),43).is_some());
 match operation {"style"=>{d.apply_style_native(0,43,0).unwrap();},"font-size"=>{d.apply_char_format_native(0,43,0,1,r#"{"fontSize":17}"#).unwrap();},"paragraph-margin"=>{d.apply_para_format_native(0,43,r#"{"spacingBefore":12}"#).unwrap();},"paragraph-line-spacing"=>{d.apply_para_format_native(0,43,r#"{"lineSpacing":180}"#).unwrap();},_=>unreachable!()};
 assert_eq!(rhwp::renderer::layout::jueony_reconstructed_probe83(d.document(),43),None,"local edited source must not retain ownership: {operation}");
 println!("SOURCE_REVOKED {operation}");
 }
}
#[test]fn unrelated_later_page_edit_after_hwp_reopen_preserves_owned_frame(){
 let mut d=input("mcst-bid-2026-hwpx-hancom.hwpx");let hwp=d.export_hwp_with_adapter_snapshot_with_report().unwrap();assert!(hwp.content_loss().is_empty());d=DocumentCore::from_bytes(&hwp.into_bytes()).unwrap();let before=state(&d);let y=table_y(&d);let snap=d.save_snapshot_native();
 let triplet=serde_json::to_vec(&d.document().sections[0].paragraphs[43..46]).unwrap();
 let (pi,n)=d.document().sections[0].paragraphs.iter().enumerate().rev().find(|(i,p)|*i>45&&!p.text.trim().is_empty()&&p.controls.is_empty()).map(|(i,p)|(i,p.text.chars().count())).unwrap();
 d.insert_text_native(0,pi,n,"Z").unwrap();let edited=state(&d);let edited_y=table_y(&d);let triplet_unchanged=triplet==serde_json::to_vec(&d.document().sections[0].paragraphs[43..46]).unwrap();let redo=d.save_snapshot_native();
 let mut outputs=vec![];for hwpx in [false,true] {let report=if hwpx {d.export_hwpx_native_with_report().unwrap()}else{d.export_hwp_with_adapter_snapshot_with_report().unwrap()};let loss=report.content_loss().is_empty();let reopened=DocumentCore::from_bytes(&report.into_bytes()).unwrap();let mut delta=vec![];diff(&edited,&state(&reopened),"pages",&mut delta);outputs.push(json!({"hwpx":hwpx,"contentLossEmpty":loss,"differences":delta.len(),"firstDifferences":delta.iter().take(4).collect::<Vec<_>>() }));}
 d.restore_snapshot_native(snap).unwrap();let mut ud=vec![];diff(&before,&state(&d),"pages",&mut ud);d.restore_snapshot_native(redo).unwrap();let mut rd=vec![];diff(&edited,&state(&d),"pages",&mut rd);
 let out=PathBuf::from(std::env::var("JUEONY_REPO").unwrap()).join("build/mcst-leading-gap83");std::fs::write(out.join("candidate-unrelated-edit-hwp.json"),serde_json::to_vec_pretty(&json!({"editedParagraph":pi,"sourceY":y,"editedY":edited_y,"tripletUnchanged":triplet_unchanged,"undoDifferences":ud.len(),"redoDifferences":rd.len(),"outputs":outputs})).unwrap()).unwrap();
 assert!(triplet_unchanged);assert!((y-edited_y).abs()<=0.2,"unrelated edit must not move source-owned table");assert!(ud.is_empty());assert!(rd.is_empty());assert!(outputs.iter().all(|r|r["contentLossEmpty"]==true&&r["differences"]==0),"unrelated edited save {outputs:?}");
}

#[test]fn exact_xml_origin_edit_lifetime_rejects_legacy_unknown_and_conflicts(){
 use rhwp::model::document::{HWPX_ORIGIN_STREAM_PATH as XML,HWP3_ORIGIN_STREAM_PATH as H3,HWP3_ORIGIN_HWPX_MARKER_PATH as H3X,HWP5_ORIGIN_HWPX_MARKER_PATH as H5X};
 let source=input("mcst-bid-2026-hwpx-hancom.hwpx");let report=source.export_hwp_with_adapter_snapshot_with_report().unwrap();let reopened=DocumentCore::from_bytes(&report.into_bytes()).unwrap();let original=reopened.document();
 assert!(original.sections[0].raw_provenance.is_some());
 for case in ["exact","missing","legacy1","opaque","suffix","nul","duplicate","mixed-opaque","hwp3-stream","hwp3-aux","hwp5-aux","hwp3-lineage","hwp3-variant","missing-lineage","missing-variant"] {
 let mut m=original.clone();for sec in &mut m.sections {sec.raw_stream=None;}
 match case {
 "exact"=>{},"missing"=>m.extra_streams.retain(|(p,_)|p!=XML),
 "legacy1"|"opaque"|"suffix"|"nul"=>{let bytes=match case{"legacy1"=>b"1".as_slice(),"opaque"=>b"opaque".as_slice(),"suffix"=>b"2:xml-import-v1x".as_slice(),_=>b"2:xml-import-v1\0".as_slice()};for (p,v) in &mut m.extra_streams {if p==XML {*v=bytes.to_vec();}}},
 "duplicate"=>m.extra_streams.push((XML.into(),b"2:xml-import-v1".to_vec())),
 "mixed-opaque"=>m.extra_streams.push((XML.into(),b"opaque".to_vec())),
 "hwp3-stream"=>m.extra_streams.push((H3.into(),b"1".to_vec())),
 "hwp3-aux"=>m.hwpx_aux_entries.push((H3X.into(),b"1".to_vec())),
 "hwp5-aux"=>m.hwpx_aux_entries.push((H5X.into(),b"unknown".to_vec())),
 "hwp3-lineage"=>m.provenance.hwp3_lineage=true,"hwp3-variant"=>m.is_hwp3_variant=true,
 "missing-lineage"=>m.provenance.hwpx_lineage=false,"missing-variant"=>m.is_hwpx_variant=false,_=>unreachable!()};
 assert_eq!(m.layout_profile().session_edited(),case!="exact","origin policy {case}");println!("EDIT_LIFETIME {case} edited={}",m.layout_profile().session_edited());
 }
 let native=input("source-mcst-bid-2026.hwp");assert!(!native.document().layout_profile().session_edited());let mut n=native.document().clone();n.sections[0].raw_stream=None;assert!(n.layout_profile().session_edited(),"native edit lifetime must remain unchanged");
}
