use rhwp::DocumentCore;
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
fn sha256(bytes:&[u8])->String{Sha256::digest(bytes).iter().map(|b|format!("{b:02x}")).collect()}
fn state(d:&DocumentCore)->Value{json!({"controls":serde_json::from_str::<Value>(&d.get_page_control_layout_native(0).unwrap()).unwrap(),"text":serde_json::from_str::<Value>(&d.get_page_text_layout_native(0).unwrap()).unwrap()})}
fn diff(a:&Value,b:&Value,path:&str,out:&mut Vec<Value>){match(a,b){(Value::Number(a),Value::Number(b))=>{let(x,y)=(a.as_f64().unwrap(),b.as_f64().unwrap());if !x.is_finite()||!y.is_finite()||(x-y).abs()>0.2{out.push(json!({"path":path,"before":a,"after":b}));}},(Value::Array(a),Value::Array(b))=>{for i in 0..a.len().max(b.len()){diff(a.get(i).unwrap_or(&Value::Null),b.get(i).unwrap_or(&Value::Null),&format!("{path}/{i}"),out);}},(Value::Object(a),Value::Object(b))=>{let keys:std::collections::BTreeSet<_>=a.keys().chain(b.keys()).collect();for k in keys{diff(a.get(k).unwrap_or(&Value::Null),b.get(k).unwrap_or(&Value::Null),&format!("{path}/{k}"),out);}},_=>if a!=b{out.push(json!({"path":path,"before":a,"after":b}));}}}
fn repo()->std::path::PathBuf{std::path::PathBuf::from(std::env::var("JUEONY_REPO").unwrap()).join("build/file-closure69-overlap")}
fn compare(mode:&str){let dir=repo().join("support");let bytes=std::fs::read(dir.join(format!("{mode}.hwp"))).unwrap();let d=DocumentCore::from_bytes(&bytes).unwrap();let before=state(&d);let saved=checked_export(&d,true);let reopened=DocumentCore::from_bytes(&saved).unwrap();let after=state(&reopened);let mut delta=vec![];diff(&before,&after,"",&mut delta);eprintln!("CASE {mode}: before={} after={} difference={} first={}",before["controls"]["controls"],after["controls"]["controls"],delta.len(),serde_json::to_string(&delta.iter().take(8).collect::<Vec<_>>()).unwrap());assert!(delta.is_empty(),"{mode} cross-format {} full geometry differences",delta.len());}
#[test]fn closure_column_two(){compare("column2");}
#[test]fn closure_column_three(){compare("column3");}
#[test]fn closure_negative_offset(){compare("negative");}
fn actual(name:&str){
 let file=format!("{name}.hwp");let original_path=if ["negative","column2"].contains(&name){format!("../support/{file}")}else if name.ends_with("-prepared"){format!("../{}",file.replace("-prepared.","-original-prepared."))}else{format!("../final-inputs/{file}")};
 let original=std::fs::read(repo().join(original_path.strip_prefix("../").unwrap())).unwrap();let independent=std::fs::read(repo().join(format!("hancom-current/{file}"))).unwrap();let d=DocumentCore::from_bytes(&original).unwrap();let reference=DocumentCore::from_bytes(&independent).unwrap();let before=state(&d);
 let frozen:Value=serde_json::from_slice(&std::fs::read(repo().join("independent-oracle68.json")).unwrap()).unwrap();let record=frozen["observations"].as_array().unwrap().iter().find(|r|r["name"]==file).unwrap();
 assert_eq!(record["original"]["sha256"].as_str(),Some(sha256(&original).as_str()),"immutable original SHA");assert_eq!(record["hancom"]["sha256"].as_str(),Some(sha256(&independent).as_str()),"immutable independent actual SHA");assert_eq!(d.page_count(),1);assert_eq!(reference.page_count(),1);
 let expected=json!({"controls":{"controls":record["afterLayout"][0]["controls"]},"text":{"runs":record["afterLayout"][0]["runs"]}});
 let mut delta=vec![];diff(&before,&expected,"",&mut delta);let mut reference_delta=vec![];diff(&state(&reference),&expected,"",&mut reference_delta);
assert!(reference_delta.is_empty(),"actual saved source {name} moved away from frozen independent oracle: {:?}",reference_delta.iter().take(3).collect::<Vec<_>>());assert!(delta.is_empty(),"actual {name} {} full geometry differences; {:?}",delta.len(),delta.iter().take(3).collect::<Vec<_>>());let a:Value=serde_json::from_str(&d.get_document_metadata_native()).unwrap();let b:Value=serde_json::from_str(&reference.get_document_metadata_native()).unwrap();assert_eq!(a["values"],b["values"],"independent known5");
 let mut artifacts=Vec::new();for (label,source) in [("original",&d),("hancom",&reference)] {let source_before=state(source);for hwpx in[false,true]{let bytes=if hwpx{checked_export(source,true)}else{checked_export(source,false)};let reopened=DocumentCore::from_bytes(&bytes).unwrap();assert_eq!(reopened.page_count(),1);let mut difference=vec![];diff(&source_before,&state(&reopened),"",&mut difference);assert!(difference.is_empty(),"actual {name} {label} export {hwpx} {} geometry differences; {:?}",difference.len(),difference.iter().take(3).collect::<Vec<_>>());let second=if hwpx{checked_export(&reopened,true)}else{checked_export(&reopened,false)};let twice=DocumentCore::from_bytes(&second).unwrap();let mut second_delta=vec![];diff(&source_before,&state(&twice),"",&mut second_delta);assert!(second_delta.is_empty(),"{name}/{label}/{hwpx} consecutive second reopen {:?}",second_delta);if name=="negative"{artifacts.push((label,hwpx,bytes));}}}


}
#[test]fn actual_two(){actual("two");}
#[test]fn actual_three(){actual("three");}
#[test]fn actual_positive_offset(){actual("offset");}
#[test]fn actual_plain(){actual("plain");}
#[test]fn actual_unicode(){actual("unicode");}
#[test]fn actual_superscript(){actual("superscript");}
#[test]fn actual_column_two(){actual("column2");}
#[test]fn actual_negative(){actual("negative");}
#[test]fn actual_multiline(){actual("multiline-prepared");}
#[test]fn actual_caption(){actual("caption-prepared");}
#[test]fn actual_positive(){actual("positive-prepared");}


fn checked_export(d:&DocumentCore,hwpx:bool)->Vec<u8>{
 let before=serde_json::to_vec(&d.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>()).unwrap();
 let report=if hwpx{d.export_hwpx_native_with_report().unwrap()}else{d.export_hwp_with_adapter_snapshot_with_report().unwrap()};
 assert!(report.content_loss().is_empty(),"genuine content loss must not be ignored: {}",report.content_loss().to_json());
 let bytes=report.into_bytes();let reopened=DocumentCore::from_bytes(&bytes).unwrap();
 let a:Value=serde_json::from_str(&d.get_document_metadata_native()).unwrap();let b:Value=serde_json::from_str(&reopened.get_document_metadata_native()).unwrap();assert_eq!(a["values"],b["values"],"all five metadata fields preserved");
 assert_eq!(before,serde_json::to_vec(&d.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>()).unwrap(),"export cannot mutate the original paragraph/control tree");bytes
}
