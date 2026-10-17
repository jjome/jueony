use rhwp::DocumentCore;
use rhwp::model::control::Control;
use serde_json::{json,Value};
use std::path::PathBuf;

fn blank()->DocumentCore{let mut d=DocumentCore::new_empty();d.create_blank_document_native().unwrap();d}
fn create(d:&mut DocumentCore,kind:&str)->(usize,usize){let r:Value=serde_json::from_str(&d.create_shape_control_native(0,0,0,9000,4000,0,0,true,"Square",kind,false,false,&[]).unwrap()).unwrap();(r["paraIdx"].as_u64().unwrap()as usize,r["controlIdx"].as_u64().unwrap()as usize)}
fn numbers(d:&DocumentCore)->Vec<u16>{d.document().sections.iter().flat_map(|s|s.paragraphs.iter()).flat_map(|p|p.controls.iter()).filter_map(|c|match c{Control::Shape(s)=>s.drawing().and_then(|d|d.caption.as_ref()),_=>None}).flat_map(|c|c.paragraphs.iter()).flat_map(|p|p.controls.iter()).filter_map(|c|match c{Control::AutoNumber(a)=>Some(a.assigned_number),_=>None}).collect()}
fn state(d:&DocumentCore)->Value{json!((0..d.page_count()).map(|p|json!({"page":p,"controls":serde_json::from_str::<Value>(&d.get_page_control_layout_native(p).unwrap()).unwrap(),"text":serde_json::from_str::<Value>(&d.get_page_text_layout_native(p).unwrap()).unwrap()})).collect::<Vec<_>>())}
fn difference(a:&Value,b:&Value,p:&str,out:&mut Vec<Value>){match(a,b){(Value::Number(a),Value::Number(b))=>{let(x,y)=(a.as_f64().unwrap(),b.as_f64().unwrap());if !x.is_finite()||!y.is_finite()||(x-y).abs()>0.2{out.push(json!({"path":p,"before":a,"after":b}));}},(Value::Array(a),Value::Array(b))=>{if a.len()!=b.len(){out.push(json!({"path":format!("{p}.length"),"before":a.len(),"after":b.len()}));}for i in 0..a.len().max(b.len()){difference(a.get(i).unwrap_or(&Value::Null),b.get(i).unwrap_or(&Value::Null),&format!("{p}/{i}"),out);}},(Value::Object(a),Value::Object(b))=>{let keys:std::collections::BTreeSet<_>=a.keys().chain(b.keys()).collect();for k in keys{difference(a.get(k).unwrap_or(&Value::Null),b.get(k).unwrap_or(&Value::Null),&format!("{p}/{k}"),out);}},_=>if a!=b{out.push(json!({"path":p,"before":a,"after":b}));}}}
fn model(d:&DocumentCore)->Vec<u8>{serde_json::to_vec(&d.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>()).unwrap()}
fn equal(a:&Value,b:&Value){let mut diff=vec![];difference(a,b,"$",&mut diff);assert!(diff.is_empty(),"full geometry mismatch {:?}",diff.iter().take(5).collect::<Vec<_>>());}
fn cycles(d:&DocumentCore,label:&str){let root=PathBuf::from(std::env::var("JUEONY_REPO").unwrap());let out=root.join("build/table-origin-closure77").join(std::env::var("JUEONY_ORIGIN_PHASE").unwrap_or("candidate".into()));let before=state(d);let raw=model(d);let metadata:Value=serde_json::from_str(&d.get_document_metadata_native()).unwrap();let mut results=vec![];
 for format in ["hwp","hwpx"]{let mut current=None;for index in 1..=2{let source=current.as_ref().unwrap_or(d);let r=if format=="hwp"{source.export_hwp_with_adapter_snapshot_with_report().unwrap()}else{source.export_hwpx_native_with_report().unwrap()};assert!(r.content_loss().is_empty(),"genuine loss {}",r.content_loss().to_json());let b=r.into_bytes();let reopened=DocumentCore::from_bytes(&b).unwrap();let mut delta=vec![];difference(&before,&state(&reopened),"$",&mut delta);let m:Value=serde_json::from_str(&reopened.get_document_metadata_native()).unwrap();let unchanged=raw==model(d);let values_equal=metadata["values"]==m["values"];let artifact=format!("{label}-{index}.{format}");std::fs::write(out.join(&artifact),b).unwrap();results.push(json!({"format":format,"cycle":index,"artifact":artifact,"geometryDifferences":delta.len(),"firstDifferences":delta.iter().take(5).collect::<Vec<_>>(),"metadata5Equal":values_equal,"sourceUnchanged":unchanged}));std::fs::write(out.join(format!("{label}-result.json")),serde_json::to_vec_pretty(&results).unwrap()).unwrap();assert!(delta.is_empty()&&values_equal&&unchanged,"strict save failed: {:?}",results.last());current=Some(reopened);}}
}

fn fixture(policy:i32)->DocumentCore{
 let mut d=blank();d.insert_text_native(0,0,0,"표 앞 본문 😀").unwrap();
 let len=d.document().sections[0].paragraphs[0].text.chars().count();d.split_paragraph_native(0,0,len,None).unwrap();
 let t:Value=serde_json::from_str(&d.create_table_native(0,1,0,3,2).unwrap()).unwrap();let c=t["controlIdx"].as_u64().unwrap()as usize;
 for cell in 0..6{d.insert_text_in_cell_native(0,1,c,cell,0,0,&format!("업무 {cell}")).unwrap();}
 d.apply_char_format_in_cell_native(0,1,c,2,0,0,4,r#"{"bold":true,"fontSize":1200}"#).unwrap();
 d.set_cell_properties_native(0,1,c,3,r##"{"fillType":"solid","fillColor":"#ffeeaa"}"##).unwrap();
 let len=d.document().sections[0].paragraphs[1].text.chars().count();d.split_paragraph_native(0,1,len,None).unwrap();d.create_table_native(0,2,0,2,2).unwrap();
 let mut d=DocumentCore::from_bytes(&d.export_hwp_with_adapter_snapshot_with_report().unwrap().into_bytes()).unwrap();
 if policy>=0{for cell in 0..2{d.set_cell_properties_native(0,1,c,cell,r#"{"isHeader":true}"#).unwrap();}d.set_table_properties_native(0,1,c,&format!(r#"{{"pageBreak":{policy},"repeatHeader":true}}"#)).unwrap();}d
}
fn variant(name:&str)->DocumentCore{
 let d=fixture(1);let mut doc=d.document().clone();
 match name{
 "nested-wrapper-large-after"=>{let nested=doc.sections[0].paragraphs[2].controls[0].clone();let Control::Table(t)=&mut doc.sections[0].paragraphs[1].controls[0]else{panic!()};t.row_count=1;t.col_count=1;t.cells.truncate(1);t.cells[0].row=0;t.cells[0].col=0;t.cells[0].height=9000;t.cells[0].paragraphs.truncate(1);t.cells[0].paragraphs[0].text.clear();t.cells[0].paragraphs[0].controls=vec![nested];t.outer_margin_bottom=9000;},
 "previous-protected"=>{let Control::Table(t)=&mut doc.sections[0].paragraphs[1].controls[0]else{panic!()};t.common.size_protect=true;},
 "previous-locked"=>{let Control::Table(t)=&mut doc.sections[0].paragraphs[1].controls[0]else{panic!()};t.common.locked=true;},
 "previous-overlap"=>{let Control::Table(t)=&mut doc.sections[0].paragraphs[1].controls[0]else{panic!()};t.common.allow_overlap=true;},
 "previous-span"=>{let Control::Table(t)=&mut doc.sections[0].paragraphs[1].controls[0]else{panic!()};t.cells[0].row_span=2;},
 "previous-zero-height"=>{let Control::Table(t)=&mut doc.sections[0].paragraphs[1].controls[0]else{panic!()};for c in &mut t.cells{c.height=0;}},
 "successor-overlap"=>{let Control::Table(t)=&mut doc.sections[0].paragraphs[2].controls[0]else{panic!()};t.common.allow_overlap=true;},
 "successor-positive"=>{let Control::Table(t)=&mut doc.sections[0].paragraphs[2].controls[0]else{panic!()};t.common.vertical_offset=1000;},
 "successor-negative"=>{let Control::Table(t)=&mut doc.sections[0].paragraphs[2].controls[0]else{panic!()};t.common.vertical_offset=(-50i32)as u32;},
 "positive-stored-gap"=>{doc.sections[0].paragraphs[2].line_segs[0].vertical_pos=9000;},
 "ambiguous-address"=>{let Control::Table(t)=&mut doc.sections[0].paragraphs[1].controls[0]else{panic!()};t.cells[1].col=0;},
 _=>panic!("unknown variant")}
 let mut d=DocumentCore::new_empty();d.set_document(doc);let bytes=d.export_hwp_with_adapter_snapshot_with_report().unwrap().into_bytes();DocumentCore::from_bytes(&bytes).unwrap()
}
const EXCLUSIONS:[&str;11]=["nested-wrapper-large-after","previous-protected","previous-locked","previous-overlap","previous-span","previous-zero-height","successor-overlap","successor-positive","successor-negative","positive-stored-gap","ambiguous-address"];
fn out()->PathBuf{PathBuf::from(std::env::var("JUEONY_REPO").unwrap()).join("build/table-origin-closure77")}
#[test]fn baseline_observations(){
 let phase=std::env::var("JUEONY_ORIGIN_PHASE").unwrap_or("candidate".into());std::fs::create_dir_all(out().join(&phase)).unwrap();let mut records=vec![];
 for p in [-1,0,1,2]{let d=fixture(p);let source=model(&d);let before=state(&d);let r=DocumentCore::from_bytes(&d.export_hwp_with_adapter_snapshot_with_report().unwrap().into_bytes()).unwrap();let after=state(&r);let mut delta=vec![];difference(&before,&after,"$",&mut delta);records.push(json!({"policy":p,"before":before,"after":after,"differences":delta,"sourceUnchanged":source==model(&d)}));}
 std::fs::write(out().join(&phase).join("observations.json"),serde_json::to_vec_pretty(&records).unwrap()).unwrap();
 let cases:Vec<_>=EXCLUSIONS.iter().map(|n|{let d=variant(n);json!({"name":n,"geometry":state(&d),"model":model(&d)})}).collect();std::fs::write(out().join(&phase).join("exclusions.json"),serde_json::to_vec_pretty(&cases).unwrap()).unwrap();
}
#[test]fn cell_break_whole_frame_strict_reopens(){cycles(&fixture(1),"cell-break-whole");}
#[test]fn row_break_whole_frame_strict_reopens(){cycles(&fixture(2),"row-break-whole");}
#[test]fn none_contract_unchanged_strict_reopens(){cycles(&fixture(0),"none-whole");}
#[test]fn default_contract_unchanged_strict_reopens(){cycles(&fixture(-1),"default-whole");}
#[test]fn policy_history_restores_exact_layout(){let mut d=fixture(0);let before=state(&d);let undo=d.save_snapshot_native();d.set_table_properties_native(0,1,0,r#"{"pageBreak":1,"repeatHeader":true}"#).unwrap();let current=state(&d);let redo=d.save_snapshot_native();d.restore_snapshot_native(undo).unwrap();equal(&before,&state(&d));d.restore_snapshot_native(redo).unwrap();equal(&current,&state(&d));cycles(&d,"history-cell-break");}
#[test]fn exclusions_preserve_baseline_full_geometry_and_model(){let baseline:Value=serde_json::from_slice(&std::fs::read(out().join("baseline/exclusions.json")).unwrap()).unwrap();let mut records=vec![];for n in EXCLUSIONS{let expected=baseline.as_array().unwrap().iter().find(|r|r["name"]==n).unwrap();let d=variant(n);let mut delta=vec![];difference(&expected["geometry"],&state(&d),"$",&mut delta);let same_model=expected["model"]==json!(model(&d));records.push(json!({"name":n,"geometryDifferences":delta.len(),"firstDifferences":delta.iter().take(6).collect::<Vec<_>>(),"modelSame":same_model}));std::fs::write(out().join("candidate/exclusion-results.json"),serde_json::to_vec_pretty(&records).unwrap()).unwrap();assert!(delta.is_empty()&&same_model,"excluded case changed {:?}",records.last());}}
#[test]fn actual_partial_table_preserves_formal77_every_published_field(){use sha2::{Digest,Sha256};let expected:Value=serde_json::from_slice(&std::fs::read(out().join("partial-negative-baseline77.json")).unwrap()).unwrap();let bytes=std::fs::read(out().join("partial-negative.hwp")).unwrap();let sha:String=Sha256::digest(&bytes).iter().map(|b|format!("{b:02x}")).collect();assert_eq!(expected["sourceSHA256"],sha);let d=DocumentCore::from_bytes(&bytes).unwrap();assert_eq!(d.page_count(),2);let before=model(&d);let layout=state(&d);let fragments:Vec<_>=layout.as_array().unwrap().iter().map(|p|p["controls"]["controls"].as_array().unwrap().iter().filter(|c|c["type"]=="table"&&c["paraIdx"]==1).map(|c|c["cells"].as_array().unwrap().len()).sum::<usize>()).collect();assert_eq!(fragments,vec![98,82],"same table owner has distinct real cell fragments");let mut delta=vec![];difference(&expected["layout"],&layout,"$",&mut delta);assert_eq!(before,model(&d));std::fs::write(out().join("candidate/partial-negative-result.json"),serde_json::to_vec_pretty(&json!({"sourceSHA256":sha,"pages":d.page_count(),"fragmentCellCounts":fragments,"fullGeometryDifferences":delta,"sourceModelUnchanged":true})).unwrap()).unwrap();assert!(delta.is_empty(),"real partial-table geometry changed {:?}",delta.iter().take(6).collect::<Vec<_>>());}
