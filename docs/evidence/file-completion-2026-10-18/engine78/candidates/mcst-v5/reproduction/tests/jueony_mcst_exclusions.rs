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
fn retained_source_origin_exclusions_match_formal76_full_geometry() {
 let root=PathBuf::from(std::env::var("JUEONY_REPO").unwrap());let out=root.join("build/file-closure75-public-readonly");let baseline=std::env::var("JUEONY_BASELINE").is_ok();let original=std::fs::read(root.join("build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx")).unwrap();let core=DocumentCore::from_bytes(&original).unwrap();let mut results=vec![];let mut failed=0;
 for mode in ["missing","count","negative","zero","nonmonotone","dirty","cell-dirty","synthetic","control-owner"] {
  let mut doc=core.document().clone();
  for para in &mut doc.sections[0].paragraphs {
   match mode {
    "missing"=>para.source_line_seg_vertical_pos=None,
    "count"=>if para.source_line_seg_vertical_pos.is_some(){para.source_line_seg_vertical_pos=Some(vec![]);},
    "negative"=>if let Some(v)=para.source_line_seg_vertical_pos.as_mut(){if !v.is_empty(){v[0]=-1;}},
    "zero"=>if let Some(v)=para.source_line_seg_vertical_pos.as_mut(){v.fill(0);},
    "nonmonotone"=>if let Some(v)=para.source_line_seg_vertical_pos.as_mut(){if v.len()>1{v[0]=1;v[1]=0;}else if !v.is_empty(){v[0]=-1;}},
    "dirty"=>para.stored_text_partition_dirty=true,
    "cell-dirty"=>para.cell_format_vpos_dirty=true,
    "synthetic"=>for line in &mut para.line_segs{line.tag|=rhwp::model::paragraph::LineSeg::TAG_IMPLEMENTATION_PROPERTY;},
    "control-owner"=>if para.controls.is_empty(){para.controls.push(rhwp::model::control::Control::Unknown(rhwp::model::control::UnknownControl{ctrl_id:0x11223344}));},
    _=>unreachable!()
   }
  }
  let mut d=DocumentCore::from_bytes(&original).unwrap();d.set_document(doc);let before=model(&d);let raw_hash=sha(&serde_json::to_vec(&before).unwrap());let actual=state(&d);let unmutated=before==model(&d);let target=out.join(format!("formal76-exclusion-{mode}.json"));
  if baseline {std::fs::write(&target,serde_json::to_vec(&json!({"geometry":actual,"modelSHA":raw_hash})).unwrap()).unwrap();results.push(json!({"mode":mode,"baseline":true,"pages":d.page_count(),"readOnly":unmutated,"modelSHA":raw_hash}));}
  else {let expected:Value=serde_json::from_slice(&std::fs::read(target).unwrap()).unwrap();let mut delta=vec![];diff(&expected["geometry"],&actual,"$",&mut delta);let model_same=expected["modelSHA"]==raw_hash;let passed=delta.is_empty()&&model_same&&unmutated;if !passed{failed+=1;}results.push(json!({"mode":mode,"passed":passed,"pages":d.page_count(),"readOnly":unmutated,"modelSHA":raw_hash,"matchesBaselineModel":model_same,"geometryDifferences":delta.len(),"firstDifferences":delta.iter().take(10).collect::<Vec<_>>()}));}
 }
 let name=if baseline{"formal76-exclusion-baseline.json"}else{"metrics-plan76-v5-exclusion-result.json"};std::fs::write(out.join(name),serde_json::to_vec_pretty(&results).unwrap()).unwrap();assert_eq!(failed,0,"exclusion changed formal76 behavior");
}
