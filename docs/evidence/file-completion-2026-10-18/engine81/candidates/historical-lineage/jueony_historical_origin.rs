use rhwp::{DocumentCore, model::{document::{Document,HWP3_ORIGIN_HWPX_MARKER_PATH,HWP3_ORIGIN_STREAM_PATH,HWP5_ORIGIN_HWPX_MARKER_PATH,HWP5_ORIGIN_HWPX_PARAGRAPH_AXIS,HWPX_ORIGIN_STREAM_PATH},provenance::SourceFormat}, parser::{FileFormat,parse_document}, document_core::converters::hwpx_to_hwp::convert_if_hwpx_source};
use serde_json::{Value,json};
use sha2::{Digest,Sha256};
use std::{path::PathBuf,sync::OnceLock};

const HISTORICAL:&str="build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx.hwpx";
const EXPECTED_SHA:&str="cef8a3b80d6732be5f850c28923b27a09e2f0ff9df9a2835bc3b84c512266452";
fn sha(b:&[u8])->String{Sha256::digest(b).iter().map(|b|format!("{b:02x}")).collect()}
fn repo()->PathBuf{PathBuf::from(std::env::var("JUEONY_REPO").unwrap())}
fn write(name:&str,value:Value){let out=repo().join("build/mcst-historical-closure80").join(std::env::var("JUEONY_PHASE").unwrap_or("candidate".into()));std::fs::create_dir_all(&out).unwrap();std::fs::write(out.join(format!("{name}.json")),serde_json::to_vec_pretty(&value).unwrap()).unwrap();}
fn input()->Vec<u8>{let b=std::fs::read(repo().join(HISTORICAL)).unwrap();assert_eq!(sha(&b),EXPECTED_SHA);b}
fn source()->Document{static DOC:OnceLock<Document>=OnceLock::new();DOC.get_or_init(||parse_document(&input()).unwrap()).clone()}
fn state(d:&DocumentCore)->Value{json!((0..d.page_count()).map(|p|json!({"page":p,"controls":serde_json::from_str::<Value>(&d.get_page_control_layout_native(p).unwrap()).unwrap(),"text":serde_json::from_str::<Value>(&d.get_page_text_layout_native(p).unwrap()).unwrap()})).collect::<Vec<_>>())}
fn safe(v:&Value)->Value{match v{Value::Number(_)|Value::Null|Value::Bool(_)=>v.clone(),Value::String(s)=>json!({"characters":s.chars().count(),"sha256":sha(s.as_bytes())}),_=>json!({"sha256":sha(&serde_json::to_vec(v).unwrap())})}}
fn diff(a:&Value,b:&Value,p:&str,out:&mut Vec<Value>){match(a,b){(Value::Number(a),Value::Number(b))=>{let(x,y)=(a.as_f64().unwrap(),b.as_f64().unwrap());if !x.is_finite()||!y.is_finite()||(x-y).abs()>0.2{out.push(json!({"path":p,"before":a,"after":b}));}},(Value::Array(a),Value::Array(b))=>{for i in 0..a.len().max(b.len()){diff(a.get(i).unwrap_or(&Value::Null),b.get(i).unwrap_or(&Value::Null),&format!("{p}/{i}"),out);}},(Value::Object(a),Value::Object(b))=>{let keys:std::collections::BTreeSet<_>=a.keys().chain(b.keys()).collect();for k in keys{diff(a.get(k).unwrap_or(&Value::Null),b.get(k).unwrap_or(&Value::Null),&format!("{p}/{k}"),out);}},_=>if a!=b{out.push(json!({"path":p,"before":safe(a),"after":safe(b)}));}}}
fn body(d:&DocumentCore)->String{sha(&serde_json::to_vec(&d.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>()).unwrap())}
fn metadata(d:&DocumentCore)->Value{serde_json::from_str::<Value>(&d.get_document_metadata_native()).unwrap()["values"].clone()}
fn checked(d:&DocumentCore,hwpx:bool)->Vec<u8>{let original=body(d);let r=if hwpx{d.export_hwpx_native_with_report().unwrap()}else{d.export_hwp_with_adapter_snapshot_with_report().unwrap()};assert!(r.content_loss().is_empty(),"genuine loss: {}",r.content_loss().to_json());assert_eq!(body(d),original,"export mutated source paragraphs");let bytes=r.into_bytes();assert_eq!(metadata(d),metadata(&DocumentCore::from_bytes(&bytes).unwrap()),"known5 metadata");bytes}
fn assert_layout(label:&str,a:&DocumentCore,b:&DocumentCore)->usize{let mut delta=vec![];diff(&state(a),&state(b),"pages",&mut delta);write(label,json!({"inputSHA":EXPECTED_SHA,"pages":{"before":a.page_count(),"after":b.page_count()},"differences":delta,"geometryDifferenceCount":delta.len(),"tolerance":0.2}));assert!(delta.is_empty(),"{label}: {} complete-layout differences; {:?}",delta.len(),delta.iter().take(4).collect::<Vec<_>>());delta.len()}

#[test]fn historical_exact_origin_full_layout_and_two_cycles(){
 let d=DocumentCore::from_bytes(&input()).unwrap();assert_eq!(d.page_count(),15);let before=body(&d);let mut exports=vec![];
 assert_eq!(d.document().extra_streams.len(),6,"parser standard contract streams");
 assert_eq!(d.document().hwpx_aux_entry(HWP5_ORIGIN_HWPX_MARKER_PATH),Some(HWP5_ORIGIN_HWPX_PARAGRAPH_AXIS));
 for hwpx in [false,true]{let bytes=checked(&d,hwpx);let r=DocumentCore::from_bytes(&bytes).unwrap();assert_eq!(r.page_count(),15);assert_layout(&format!("historical-first-{hwpx}"),&d,&r);let second=checked(&r,hwpx);let twice=DocumentCore::from_bytes(&second).unwrap();assert_layout(&format!("historical-second-{hwpx}"),&d,&twice);exports.push(json!({"hwpx":hwpx,"firstSHA":sha(&bytes),"secondSHA":sha(&second),"firstProfile":format!("{:?}",r.document().layout_profile()),"secondProfile":format!("{:?}",twice.document().layout_profile())}));}
 assert_eq!(before,body(&d));write("historical-cycles",json!({"inputSHA":EXPECTED_SHA,"sourceUnchanged":true,"strictReopens":4,"exports":exports}));
}

#[test]fn historical_edit_snapshot_undo_redo_preserves_origin_owner(){
 let mut d=DocumentCore::from_bytes(&input()).unwrap();let original=state(&d);let original_body=body(&d);let undo=d.save_snapshot_native();
 let p=d.document().sections[0].paragraphs.iter().position(|p|p.controls.is_empty()&&!p.text.is_empty()).unwrap();
 let at=d.document().sections[0].paragraphs[p].text.encode_utf16().count();d.insert_text_native(0,p,at," X").unwrap();let edited=state(&d);let edited_body=body(&d);assert_ne!(original_body,edited_body);let redo=d.save_snapshot_native();
 d.restore_snapshot_native(undo).unwrap();assert_eq!(body(&d),original_body);let mut delta=vec![];diff(&original,&state(&d),"pages",&mut delta);assert!(delta.is_empty());
 d.restore_snapshot_native(redo).unwrap();assert_eq!(body(&d),edited_body);let mut delta=vec![];diff(&edited,&state(&d),"pages",&mut delta);assert!(delta.is_empty());
 for hwpx in [false,true]{let bytes=checked(&d,hwpx);let r=DocumentCore::from_bytes(&bytes).unwrap();assert_layout(&format!("historical-edited-{hwpx}"),&d,&r);let second=checked(&r,hwpx);let twice=DocumentCore::from_bytes(&second).unwrap();assert_layout(&format!("historical-edited-second-{hwpx}"),&d,&twice);}
 write("historical-history",json!({"sourceOriginalSHA":EXPECTED_SHA,"bodyBefore":original_body,"bodyEdited":edited_body,"snapshotUndo":true,"snapshotRedo":true,"strictReopens":4,"note":"Real insertText plus snapshot restore; no source flag mutation"}));
}

fn marker_cases()->Vec<(&'static str,Document,FileFormat,bool)>{
 let d=source();let mut cases=vec![("exact-owner",d.clone(),FileFormat::Hwpx,false)];
 let mut no=d.clone();no.hwpx_aux_entries.retain(|(p,_)|p!=HWP5_ORIGIN_HWPX_MARKER_PATH);cases.push(("pure-hwpx",no,FileFormat::Hwpx,true));
 for (label,payload) in [("legacy-one",b"1".to_vec()),("unknown-payload",b"3:opaque".to_vec()),("empty-payload",vec![])]{let mut v=d.clone();v.hwpx_aux_entries.iter_mut().find(|(p,_)|p==HWP5_ORIGIN_HWPX_MARKER_PATH).unwrap().1=payload;cases.push((label,v,FileFormat::Hwpx,true));}
 let mut duplicate=d.clone();duplicate.hwpx_aux_entries.push((HWP5_ORIGIN_HWPX_MARKER_PATH.into(),HWP5_ORIGIN_HWPX_PARAGRAPH_AXIS.to_vec()));cases.push(("duplicate-native-owner",duplicate,FileFormat::Hwpx,true));
 let mut hwp3=d.clone();hwp3.hwpx_aux_entries.push((HWP3_ORIGIN_HWPX_MARKER_PATH.into(),b"1".to_vec()));cases.push(("hwp3-aux-conflict",hwp3,FileFormat::Hwpx,true));
 let mut unknown=d.clone();unknown.extra_streams.push(("/OpaqueOwner".into(),vec![0,255,0,42]));cases.push(("opaque-extra-owner",unknown,FileFormat::Hwpx,true));
 for (label,payload) in [("existing-lineage-one",b"1".to_vec()),("existing-lineage-opaque",vec![0,255,7])]{let mut v=d.clone();v.extra_streams.push((HWPX_ORIGIN_STREAM_PATH.into(),payload));cases.push((label,v,FileFormat::Hwpx,true));}
 let mut hwp3stream=d.clone();hwp3stream.extra_streams.push((HWP3_ORIGIN_STREAM_PATH.into(),b"1".to_vec()));cases.push(("existing-hwp3-stream",hwp3stream,FileFormat::Hwpx,true));
 let mut line=d.clone();line.provenance.hwpx_lineage=true;cases.push(("hwpx-lineage-conflict",line,FileFormat::Hwpx,true));
 let mut line=d.clone();line.provenance.hwp3_lineage=true;cases.push(("hwp3-lineage-conflict",line,FileFormat::Hwpx,true));
 for (label,format,source) in [("hwp5-noop",FileFormat::Hwp,SourceFormat::Hwp5),("hwp3-owner",FileFormat::Hwp3,SourceFormat::Hwp3),("hml-owner",FileFormat::Hml,SourceFormat::Hml)]{let mut v=d.clone();v.provenance.format=source;cases.push((label,v,format,false));}
 let mut mismatched=d.clone();mismatched.provenance.format=SourceFormat::Hwp5;cases.push(("inconsistent-container",mismatched,FileFormat::Hwpx,true));cases
}

#[test]fn provenance_boundaries_and_opaque_payload_preservation(){
 let mut observations=vec![];
 for (label,mut d,format,expect_marker) in marker_cases(){
  let source_before=sha(format!("{d:?}").as_bytes());let old_streams=d.extra_streams.clone();let old_aux=d.hwpx_aux_entries.clone();
  convert_if_hwpx_source(&mut d,format);
  let marker=d.extra_streams.iter().any(|(p,_)|p==HWPX_ORIGIN_STREAM_PATH);
  let baseline=std::env::var("JUEONY_BASELINE").as_deref()==Ok("1");
  assert_eq!(marker,expect_marker||(baseline&&label=="exact-owner"),"{label} origin ownership");
  assert_eq!(d.hwpx_aux_entries,old_aux,"{label} aux payload cannot be rewritten");
  for pair in old_streams{assert!(d.extra_streams.contains(&pair),"{label}: existing stream payload preserved");}
  let once=sha(format!("{d:?}").as_bytes());convert_if_hwpx_source(&mut d,format);let twice=sha(format!("{d:?}").as_bytes());assert_eq!(once,twice,"{label} converter idempotence");
  observations.push(json!({"case":label,"sourceIRSHA":source_before,"outputIRSHA":once,"markerPresent":marker,"streamSHA":sha(&serde_json::to_vec(&d.extra_streams).unwrap()),"auxSHA":sha(&serde_json::to_vec(&d.hwpx_aux_entries).unwrap())}));
 }
 write("provenance-boundaries",json!({"cases":observations,"scenarioCount":17,"sourcePath":HISTORICAL,"inputSHA":EXPECTED_SHA,"publishedGeometryToleranceUnchanged":0.2}));
}
