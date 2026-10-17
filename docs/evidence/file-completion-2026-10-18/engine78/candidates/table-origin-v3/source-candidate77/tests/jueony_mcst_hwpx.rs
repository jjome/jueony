use rhwp::DocumentCore;
use serde_json::{json,Value};
use std::path::PathBuf;
use sha2::{Digest,Sha256};

fn sha(b:&[u8])->String{Sha256::digest(b).iter().map(|b|format!("{b:02x}")).collect()}
fn state(d:&DocumentCore)->Value{json!((0..d.page_count()).map(|p|json!({"page":p,"controls":serde_json::from_str::<Value>(&d.get_page_control_layout_native(p).unwrap()).unwrap(),"text":serde_json::from_str::<Value>(&d.get_page_text_layout_native(p).unwrap()).unwrap()})).collect::<Vec<_>>())}
fn diff(a:&Value,b:&Value,p:&str,out:&mut Vec<Value>){match(a,b){(Value::Number(a),Value::Number(b))=>{let(x,y)=(a.as_f64().unwrap(),b.as_f64().unwrap());
if !x.is_finite()||!y.is_finite()||(x-y).abs()>0.2{out.push(json!({"path":p,"before":a,"after":b}));
}},(Value::Array(a),Value::Array(b))=>{if a.len()!=b.len(){out.push(json!({"path":format!("{p}.length"),"before":a.len(),"after":b.len()}));
}for i in 0..a.len().max(b.len()){diff(a.get(i).unwrap_or(&Value::Null),b.get(i).unwrap_or(&Value::Null),&format!("{p}/{i}"),out);
}},(Value::Object(a),Value::Object(b))=>{let keys:std::collections::BTreeSet<_>=a.keys().chain(b.keys()).collect();
for k in keys{diff(a.get(k).unwrap_or(&Value::Null),b.get(k).unwrap_or(&Value::Null),&format!("{p}/{k}"),out);
}},_=>if a!=b{out.push(json!({"path":p,"before":a,"after":b}));
}}}
fn cycle(d:&DocumentCore,root:&PathBuf,label:&str,hwpx:bool)->Value{
 let before=state(d);
let raw=serde_json::to_vec(&d.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>()).unwrap();
let metadata:Value=serde_json::from_str(&d.get_document_metadata_native()).unwrap();
let mut records=vec![];
let mut current=None;

 for index in 1..=2{let s=current.as_ref().unwrap_or(d);
let report=if hwpx{s.export_hwpx_native_with_report()}else{s.export_hwp_with_adapter_snapshot_with_report()}.unwrap();
let loss:Value=serde_json::from_str(&report.content_loss().to_json()).unwrap();
let loss_empty=report.content_loss().is_empty();
let bytes=report.into_bytes();
let r=DocumentCore::from_bytes(&bytes).unwrap();
let mut delta=vec![];
diff(&before,&state(&r),"$",&mut delta);
let meta:Value=serde_json::from_str(&r.get_document_metadata_native()).unwrap();
let raw_unchanged=raw==serde_json::to_vec(&d.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>()).unwrap();
let artifact=format!("build/table-origin-closure77/candidate/mcst-{label}-{index}.{}",if hwpx{"hwpx"}else{"hwp"});
std::fs::write(root.join(&artifact),&bytes).unwrap();
records.push(json!({"cycle":index,"format":if hwpx{"hwpx"}else{"hwp"},"artifact":artifact,"sha256":sha(&bytes),"pages":r.page_count(),"geometryDifferences":delta.len(),"firstDifferences":delta.iter().take(20).collect::<Vec<_>>(),"metadataSame":meta["values"]==metadata["values"],"sourceDocumentUnchanged":raw_unchanged,"lossEmpty":loss_empty,"loss":loss,"passed":delta.is_empty()&&meta["values"]==metadata["values"]&&raw_unchanged&&loss_empty}));
current=Some(r);
}
 json!({"case":label,"beforePages":d.page_count(),"rawSourceSHA":sha(&raw),"results":records})
}
#[test]fn mcst_actual_hwpx_sixteen_pages_and_strict_two_reopens(){let root=PathBuf::from(std::env::var("JUEONY_REPO").unwrap());let bytes=std::fs::read(root.join("build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx")).unwrap();let d=DocumentCore::from_bytes(&bytes).unwrap();assert_eq!(d.page_count(),16,"Independent actual Hancom status shows16; source flags unchanged");let result=cycle(&d,&root,"actual-hwpx-only",true);std::fs::write(root.join("build/table-origin-closure77/candidate/mcst-hwpx-positive.json"),serde_json::to_vec_pretty(&result).unwrap()).unwrap();assert!(result["results"].as_array().unwrap().iter().all(|r|r["passed"]==true));}
#[test]fn mcst_actual_hwpx_api_edit_snapshot_undo_redo(){let root=PathBuf::from(std::env::var("JUEONY_REPO").unwrap());
let bytes=std::fs::read(root.join("build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx")).unwrap();
let mut d=DocumentCore::from_bytes(&bytes).unwrap();
let original=state(&d);
let undo=d.save_snapshot_native();
let n=d.document().sections[0].paragraphs[55].text.chars().count();
d.insert_text_native(0,55,n," CHECK").unwrap();
let edited=state(&d);
let redo=d.save_snapshot_native();
d.restore_snapshot_native(undo).unwrap();
let mut u=vec![];
diff(&original,&state(&d),"$",&mut u);
d.restore_snapshot_native(redo).unwrap();
let mut r=vec![];
diff(&edited,&state(&d),"$",&mut r);
let mut cases=vec![];
for hwpx in[true]{cases.push(cycle(&d,&root,"history",hwpx));
}let result=json!({"undoDifferences":u,"redoDifferences":r,"cycles":cases});
std::fs::write(root.join("build/table-origin-closure77/candidate/mcst-history.json"),serde_json::to_vec_pretty(&result).unwrap()).unwrap();
assert_eq!(result["undoDifferences"].as_array().unwrap().len(),0);
assert_eq!(result["redoDifferences"].as_array().unwrap().len(),0);
assert!(result["cycles"].as_array().unwrap().iter().flat_map(|c|c["results"].as_array().unwrap()).all(|r|r["passed"]==true),"strict history cycles failed");
}
