use rhwp::DocumentCore;
use rhwp::model::{document::Document,control::Control};
use serde_json::{Value,json};use sha2::{Digest,Sha256};use std::path::PathBuf;
fn sha(b:&[u8])->String{Sha256::digest(b).iter().map(|b|format!("{b:02x}")).collect()}
fn state(d:&DocumentCore)->Value{json!((0..d.page_count()).map(|p|json!({"page":p,"controls":serde_json::from_str::<Value>(&d.get_page_control_layout_native(p).unwrap()).unwrap(),"text":serde_json::from_str::<Value>(&d.get_page_text_layout_native(p).unwrap()).unwrap()})).collect::<Vec<_>>())}
fn safe(v:&Value)->Value{match v{Value::Number(_)|Value::Null|Value::Bool(_)=>v.clone(),Value::String(s)=>json!({"kind":"string","characters":s.chars().count(),"sha256":sha(s.as_bytes())}),_=>json!({"kind":if v.is_array(){"array"}else{"object"},"sha256":sha(&serde_json::to_vec(v).unwrap())})}}
fn diff(a:&Value,b:&Value,p:&str,out:&mut Vec<Value>){match(a,b){(Value::Number(a),Value::Number(b))=>{let(x,y)=(a.as_f64().unwrap(),b.as_f64().unwrap());if !x.is_finite()||!y.is_finite()||(x-y).abs()>0.2{out.push(json!({"path":p,"before":a,"after":b}));}},(Value::Array(a),Value::Array(b))=>{if a.len()!=b.len(){out.push(json!({"path":format!("{p}/length"),"before":a.len(),"after":b.len()}));}for i in 0..a.len().max(b.len()){diff(a.get(i).unwrap_or(&Value::Null),b.get(i).unwrap_or(&Value::Null),&format!("{p}/{i}"),out);}},(Value::Object(a),Value::Object(b))=>{let keys:std::collections::BTreeSet<_>=a.keys().chain(b.keys()).collect();for k in keys{diff(a.get(k).unwrap_or(&Value::Null),b.get(k).unwrap_or(&Value::Null),&format!("{p}/{k}"),out);}},_=>if a!=b{out.push(json!({"path":p,"before":safe(a),"after":safe(b)}));}}}
fn raw(d:&Document)->Value{json!({"profile":format!("{:?}",d.layout_profile()),"provenance":format!("{:?}",d.provenance),"selected":(0..d.sections[0].paragraphs.len()).filter(|p|[25,26,27,28,29,30,31,42,43,44,45,46,47,48,49,50,54,55,56,57].contains(p)).map(|p|{let v=&d.sections[0].paragraphs[p];let shape=&d.doc_info.para_shapes[v.para_shape_id as usize];json!({"p":p,"characters":v.text.chars().count(),"paraShapeId":v.para_shape_id,"styleId":v.style_id,"lineSegs":v.line_segs,"sourceLineSegVpos":v.source_line_seg_vertical_pos,"storedPartitionDirty":v.stored_text_partition_is_dirty(),"cellFormatDirty":v.cell_format_vpos_dirty,"paraShape":{"spacingBefore":shape.spacing_before,"spacingAfter":shape.spacing_after,"hwpxPlainMargin":shape.hwpx_plain_para_margin,"hwpxPlainPhysical":shape.hwpx_plain_para_margin_physical},"tables":v.controls.iter().filter_map(|c|match c{Control::Table(t)=>Some(json!({"rows":t.row_count,"columns":t.col_count,"width":t.common.width,"height":t.common.height,"treatAsChar":t.common.treat_as_char,"verticalOffset":t.common.vertical_offset,"verticalAlign":format!("{:?}",t.common.vert_align),"pageBreak":format!("{:?}",t.page_break),"cellCount":t.cells.len()})),_=>None}).collect::<Vec<_>>()})}).collect::<Vec<_>>()})}
fn run(label:&str,file:&str){let repo=PathBuf::from(std::env::var("JUEONY_REPO").unwrap());let out=repo.join("build/mcst-cross-closure77");let bytes=std::fs::read(repo.join(file)).unwrap();let d=DocumentCore::from_bytes(&bytes).unwrap();let before=state(&d);let source=sha(&serde_json::to_vec(&d.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>()).unwrap());let lowered=d.prepare_hwp_export_snapshot();let exported=d.export_hwp_with_adapter_snapshot_with_report().unwrap();let loss=serde_json::from_str::<Value>(&exported.content_loss().to_json()).unwrap();let b=exported.into_bytes();let r=DocumentCore::from_bytes(&b).unwrap();let after=state(&r);let mut delta=vec![];diff(&before,&after,"pages",&mut delta);let original_unchanged=source==sha(&serde_json::to_vec(&d.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>()).unwrap());let result=json!({"case":label,"inputSHA":sha(&bytes),"outputSHA":sha(&b),"pages":{"before":d.page_count(),"after":r.page_count()},"sourceRaw":raw(d.document()),"loweredRaw":raw(lowered.document()),"reopenedRaw":raw(r.document()),"sourceUnchanged":original_unchanged,"loss":loss,"geometryDifferences":delta.len(),"differences":delta});std::fs::write(out.join(format!("native-import-v7compact80-{label}.json")),serde_json::to_vec_pretty(&result).unwrap()).unwrap();assert!(original_unchanged);assert!(loss["count"]==0);assert!(delta.is_empty(),"{label}: pages{}->{}, complete layout differences{}",d.page_count(),r.page_count(),delta.len());}
#[test]fn actual_mcst_hwp_cross_full_layout(){run("actual","build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx");}
#[test]fn historical_mcst_hwp_cross_full_layout(){run("historical","build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx.hwpx");}

#[test]
fn actual_mcst_alternating_codecs_strict_full_layout() {
    let repo=PathBuf::from(std::env::var("JUEONY_REPO").unwrap());
    let input=std::fs::read(repo.join("build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx")).unwrap();
    let original=DocumentCore::from_bytes(&input).unwrap(); let before=state(&original);
    let mut current=DocumentCore::from_bytes(&input).unwrap(); let mut stages=vec![]; let mut failures=0;
    for (index,codec) in ["hwp","hwp","hwpx","hwp","hwpx","hwp"].iter().enumerate() {
        let source=sha(&serde_json::to_vec(&(format!("{:?}",current.document().doc_info),
            current.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>())).unwrap());
        let artifact=if *codec=="hwp" { current.export_hwp_with_adapter_snapshot_with_report().unwrap() }
            else { current.export_hwpx_native_with_report().unwrap() };
        let loss=artifact.content_loss().is_empty();let bytes=artifact.into_bytes();
        let reopened=DocumentCore::from_bytes(&bytes).unwrap(); let after=state(&reopened);let mut delta=vec![];
        diff(&before,&after,"pages",&mut delta);
        let unchanged=source==sha(&serde_json::to_vec(&(format!("{:?}",current.document().doc_info),
            current.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>())).unwrap());
        if !delta.is_empty() || !loss || !unchanged {failures+=1;}
        stages.push(json!({"index":index,"codec":codec,"outputSHA":sha(&bytes),"pages":reopened.page_count(),
            "differences":delta.len(),"firstDifferences":delta.iter().take(4).collect::<Vec<_>>(),
            "lossEmpty":loss,"sourceUnchanged":unchanged}));
        current=reopened;
    }
    std::fs::write(repo.join("build/mcst-cross-closure77/native-import-v7compact80-alternating.json"),
        serde_json::to_vec_pretty(&json!({"inputSHA":sha(&input),"beforePages":original.page_count(),"stages":stages,"failures":failures})).unwrap()).unwrap();
    assert_eq!(failures,0,"all alternating codec exports must preserve complete published layout");
}
#[test]
fn compiled_minimal80_source_matches_private_disk() {
    let root=PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    for (path,bytes) in [("src/document_core/commands/document.rs",include_bytes!("../src/document_core/commands/document.rs").as_slice()),
        ("src/serializer/body_text.rs",include_bytes!("../src/serializer/body_text.rs").as_slice())] {
        assert_eq!(bytes,std::fs::read(root.join(path)).unwrap()); println!("COMPILED_SOURCE {} {}",path,sha(bytes));
    }
}

include!("../../xml-import-contract-tests.rs");
