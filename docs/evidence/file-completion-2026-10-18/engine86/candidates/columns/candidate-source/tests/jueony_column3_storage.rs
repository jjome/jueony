use rhwp::DocumentCore;
use rhwp::model::control::Control;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::PathBuf;

fn repo() -> PathBuf { PathBuf::from(std::env::var("JUEONY_REPO").unwrap()) }
fn out() -> PathBuf { repo().join("build/column3-closure83") }
fn sha(bytes: &[u8]) -> String { Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect() }
fn parsed(s: String) -> Value { serde_json::from_str(&s).unwrap() }
fn source(name: &str) -> DocumentCore {
    DocumentCore::from_bytes(&std::fs::read(repo().join("build/file-closure69-overlap/support").join(name)).unwrap()).unwrap()
}
fn layout(d: &DocumentCore) -> Value {
    json!((0..d.page_count()).map(|p| json!({"page":p,"controls":parsed(d.get_page_control_layout_native(p).unwrap()),"text":parsed(d.get_page_text_layout_native(p).unwrap())})).collect::<Vec<_>>())
}
fn differences(a: &Value, b: &Value, path: &str, output: &mut Vec<Value>, tolerance: f64) {
    match (a,b) {
        (Value::Number(a),Value::Number(b)) => {
            let (a,b)=(a.as_f64().unwrap(),b.as_f64().unwrap());
            if !a.is_finite() || !b.is_finite() || (a-b).abs()>tolerance {output.push(json!({"path":path,"before":a,"after":b}));}
        },
        (Value::Array(a),Value::Array(b)) => {
            if a.len()!=b.len(){output.push(json!({"path":path,"beforeLength":a.len(),"afterLength":b.len()}));}
            for i in 0..a.len().max(b.len()){differences(a.get(i).unwrap_or(&Value::Null),b.get(i).unwrap_or(&Value::Null),&format!("{path}/{i}"),output,tolerance);}
        },
        (Value::Object(a),Value::Object(b)) => {
            let keys:std::collections::BTreeSet<_>=a.keys().chain(b.keys()).collect();
            for k in keys {differences(a.get(k).unwrap_or(&Value::Null),b.get(k).unwrap_or(&Value::Null),&format!("{path}/{k}"),output,tolerance);}
        },
        _ => if a!=b {output.push(json!({"path":path,"before":a,"after":b}));}
    }
}
fn equal(a:&Value,b:&Value,tolerance:f64,label:&str){let mut ds=vec![];differences(a,b,"",&mut ds,tolerance);assert!(ds.is_empty(),"{label}: {}",serde_json::to_string(&ds).unwrap());}
// This Native layer checks every published layout field, all body/cell text,
// every character's published properties, and paragraph properties without
// dropping IDs. The unchanged production whole-document guard is an additional
// mandatory WASM integration step; this does not impersonate that guard.
fn semantic(d:&DocumentCore)->Value {
    let mut sections=vec![];
    for (si,s) in d.document().sections.iter().enumerate(){
        let mut paragraphs=vec![];
        for (pi,p) in s.paragraphs.iter().enumerate(){
            let mut cells=vec![];
            for (ci,c) in p.controls.iter().enumerate(){if let Control::Table(t)=c {
                for (cell_i,cell) in t.cells.iter().enumerate(){
                    cells.push(json!({"row":cell.row,"col":cell.col,"rowSpan":cell.row_span,"colSpan":cell.col_span,"width":cell.width,"height":cell.height,"paragraphs":cell.paragraphs.iter().enumerate().map(|(cp,p)|json!({"text":p.text,"paragraph":parsed(d.get_cell_para_properties_at_native(si,pi,ci,cell_i,cp).unwrap()),"chars":(0..p.text.chars().count().max(1)).map(|ch|parsed(d.get_cell_char_properties_at_native(si,pi,ci,cell_i,cp,ch).unwrap())).collect::<Vec<_>>()})).collect::<Vec<_>>()}));
                }
            }}
            paragraphs.push(json!({"text":p.text,"paragraph":parsed(d.get_para_properties_at_native(si,pi).unwrap()),"chars":(0..p.text.chars().count().max(1)).map(|ch|parsed(d.get_char_properties_at_native(si,pi,ch).unwrap())).collect::<Vec<_>>(),"cells":cells}));
        }
        sections.push(json!({"columns":s.paragraphs.iter().flat_map(|p|p.controls.iter().filter_map(|c|if let Control::ColumnDef(c)=c{Some(json!({"count":c.column_count,"type":format!("{:?}",c.column_type),"sameWidth":c.same_width,"spacing":c.spacing,"direction":format!("{:?}",c.direction),"widths":c.widths,"gaps":c.gaps}))}else{None})).collect::<Vec<_>>(),"definition":parsed(d.get_section_def_native(si).unwrap()),"page":parsed(d.get_page_def_native(si).unwrap()),"paragraphs":paragraphs}));
    }
    normalized_inactive_fill(json!(sections))
}
fn normalized_inactive_fill(v:Value)->Value { match v { Value::Array(a)=>Value::Array(a.into_iter().map(normalized_inactive_fill).collect()), Value::Object(a)=> { let inactive=a.get("fillType")==Some(&json!("none")); let solid=a.get("fillType")==Some(&json!("solid")); Value::Object(a.into_iter().filter(|(k,_)| !inactive || !["fillColor","patternColor","patternType"].contains(&k.as_str())).map(|(k,v)| { let v=if solid && k=="patternType" && v.as_f64().is_some_and(|x|x<=0.0) {json!(-1)}else{normalized_inactive_fill(v)}; (k,v)}).collect()) }, _=>v }}
fn raw(d:&DocumentCore)->String {sha(&serde_json::to_vec(&d.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>()).unwrap())}
fn export(d:&DocumentCore,format:&str)->Vec<u8>{let a=if format=="hwp"{d.export_hwp_with_adapter_snapshot_with_report().unwrap()}else{d.export_hwpx_native_with_report().unwrap()};assert!(a.content_loss().is_empty(),"{}",a.content_loss().to_json());a.into_bytes()}
fn repeated(d:&DocumentCore,label:&str){
    let before=layout(d);let meaning=semantic(d);let raw_before=raw(d);let mut results=vec![];
    for codec in ["hwp","hwpx"] {
        let mut bytes=export(d,codec);
        for cycle in 1..=2 {
            let r=DocumentCore::from_bytes(&bytes).unwrap();
            let mut gd=vec![];differences(&before,&layout(&r),"",&mut gd,0.2);
            let mut sd=vec![];differences(&meaning,&semantic(&r),"",&mut sd,0.0);
            results.push(json!({"codec":codec,"cycle":cycle,"pages":r.page_count(),"geometryDifferences":gd.len(),"semanticDifferences":sd.len(),"firstGeometry":gd.iter().take(5).collect::<Vec<_>>(),"firstSemantic":sd.iter().take(2).collect::<Vec<_>>(),"outputSHA":sha(&bytes)}));
            // These are self-authored fixtures only, never public document bytes.
            std::fs::write(out().join(format!("{label}-{codec}-{cycle}.{codec}")),&bytes).unwrap();
            bytes=export(&r,codec);
        }
    }
    std::fs::write(out().join(format!("{label}.json")),serde_json::to_vec_pretty(&results).unwrap()).unwrap();
    assert_eq!(raw_before,raw(d),"export must not mutate live source");
    assert!(results.iter().all(|x|x["geometryDifferences"]==0&&x["semanticDifferences"]==0),"{label}: {}",serde_json::to_string(&results).unwrap());
}
fn history(mut d:DocumentCore,label:&str){
    let original=layout(&d);let original_sem=semantic(&d);let undo=d.save_snapshot_native();
    let tail=d.document().sections[0].paragraphs.len()-1;
    d.insert_text_native(0,tail,0,"COLUMN3-HISTORY").unwrap();
    let edited=layout(&d);let edited_sem=semantic(&d);assert_ne!(original_sem,edited_sem);
    equal(&original[0]["controls"],&edited[0]["controls"],0.0,"tail edit keeps table geometry");
    let redo=d.save_snapshot_native();
    d.restore_snapshot_native(undo).unwrap();equal(&original,&layout(&d),0.0,"undo layout");equal(&original_sem,&semantic(&d),0.0,"undo semantic");
    d.restore_snapshot_native(redo).unwrap();equal(&edited,&layout(&d),0.0,"redo layout");equal(&edited_sem,&semantic(&d),0.0,"redo semantic");
    repeated(&d,label);
}
#[test]fn fresh_three_column_both_codecs_two_cycles(){repeated(&source("column3.hwp"),"fresh-three");}
#[test]fn fresh_three_column_real_edit_undo_redo(){history(source("column3.hwp"),"history-three");}
#[test]fn actual_api_set_columns_three_and_undo_redo(){
    let mut d=source("column2.hwp");let before=layout(&d);let sem=semantic(&d);let undo=d.save_snapshot_native();
    d.set_column_def_native(0,3,0,true,1000).unwrap();
    let edited=layout(&d);let edited_sem=semantic(&d);assert_ne!(sem,edited_sem,"actual ColumnDef mutation required; full-body-width table geometry may remain the same");
    let column=d.document().sections[0].paragraphs[0].controls.iter().find_map(|c|if let Control::ColumnDef(c)=c{Some(c)}else{None}).unwrap();assert_eq!(column.column_count,3);
    let widths:Vec<_>=d.document().sections[0].paragraphs.iter().flat_map(|p|p.line_segs.iter().map(|l|l.segment_width)).collect();
    std::fs::write(out().join("api-three-widths.json"),serde_json::to_vec_pretty(&widths).unwrap()).unwrap();
    assert!(widths.iter().all(|w|*w==13504),"actual API must generate declared width: {widths:?}");
    let redo=d.save_snapshot_native();d.restore_snapshot_native(undo).unwrap();equal(&before,&layout(&d),0.0,"column API undo");equal(&sem,&semantic(&d),0.0,"column API semantic undo");d.restore_snapshot_native(redo).unwrap();equal(&edited,&layout(&d),0.0,"column API redo");
    repeated(&d,"api-three");history(d,"api-three-history");
}
#[test]fn existing_two_column_contract_unchanged(){repeated(&source("column2.hwp"),"existing-two");}
#[test]fn declared_three_with_stale_two_width_and_five_other_negatives_unchanged(){
    let baseline:Value=serde_json::from_slice(&std::fs::read(out().join("six-negative-formal83.json")).unwrap()).unwrap();
    for item in baseline["observations"].as_array().unwrap(){
        let name=item["name"].as_str().unwrap();let bytes=std::fs::read(repo().join("build/file-closure69-public/column2-candidate74/valid-negative-disk").join(format!("baseline-{name}.hwp"))).unwrap();assert_eq!(item["inputSHA"],sha(&bytes));
        let d=DocumentCore::from_bytes(&bytes).unwrap();equal(&item["before"],&layout(&d),0.0,name);
        for entry in item["exports"].as_array().unwrap(){
            let codec=entry["format"].as_str().unwrap();let a=if codec=="hwp"{d.export_hwp_with_adapter_snapshot_with_report().unwrap()}else{d.export_hwpx_native_with_report().unwrap()};
            equal(&entry["loss"],&serde_json::from_str(a.content_loss().to_json().as_str()).unwrap(),0.0,"negative loss unchanged");let r=DocumentCore::from_bytes(&a.into_bytes()).unwrap();equal(&entry["layout"],&layout(&r),0.0,&format!("{name}/{codec}"));
        }
    }
}
#[test]fn compiled_source_proof(){
    for (name,compiled) in [("src/renderer/generated_column_stack.rs",include_bytes!("../src/renderer/generated_column_stack.rs").as_slice()),("src/renderer/layout.rs",include_bytes!("../src/renderer/layout.rs").as_slice()),("src/model/document.rs",include_bytes!("../src/model/document.rs").as_slice())]{assert_eq!(compiled,std::fs::read(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(name)).unwrap());println!("COMPILED_SOURCE {name} {}",sha(compiled));}
}
