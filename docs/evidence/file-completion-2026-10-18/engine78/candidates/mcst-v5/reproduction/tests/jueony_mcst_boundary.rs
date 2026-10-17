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

fn model(d:&DocumentCore)->Value {json!({"paragraphs":d.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>(),"retainedSourcePositions":d.document().sections.iter().map(|s|s.paragraphs.iter().map(|p|&p.source_line_seg_vertical_pos).collect::<Vec<_>>()).collect::<Vec<_>>()})}

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
