
use rhwp::{DocumentCore, model::control::Control};
use serde_json::{Value,json};
fn root()->std::path::PathBuf{std::env::var("JUEONY_REPO").unwrap().into()}
fn parse(s:&str)->Value{serde_json::from_str(s).unwrap()}
fn table(d:&DocumentCore)->&rhwp::model::table::Table{d.document().sections[0].paragraphs.iter().flat_map(|p|p.controls.iter()).find_map(|c|if let Control::Table(t)=c{Some(t)}else{None}).unwrap()}
fn geometry(d:&DocumentCore)->Value{json!((0..d.page_count()).map(|p|json!({"controls":parse(&d.get_page_control_layout_native(p).unwrap()),"text":parse(&d.get_page_text_layout_native(p).unwrap())})).collect::<Vec<_>>())}
fn diff(a:&Value,b:&Value,p:&str,out:&mut Vec<Value>){match(a,b){(Value::Number(a),Value::Number(b))=>{let measured=p.ends_with("/x")||p.ends_with("/y")||p.ends_with("/w")||p.ends_with("/h")||p.contains("/charX/");if if measured{(a.as_f64().unwrap()-b.as_f64().unwrap()).abs()>0.2}else{a!=b}{out.push(json!({"path":p,"before":a,"after":b}));}},(Value::Array(a),Value::Array(b))=>{if a.len()!=b.len(){out.push(json!({"path":p,"beforeLength":a.len(),"afterLength":b.len()}));}for(i,(a,b))in a.iter().zip(b).enumerate(){diff(a,b,&format!("{p}/{i}"),out)}},(Value::Object(a),Value::Object(b))=>{if a.keys().collect::<Vec<_>>()!=b.keys().collect::<Vec<_>>(){out.push(json!({"path":p,"keysChanged":true}));}for(k,a)in a{diff(a,&b[k],&format!("{p}/{k}"),out)}},_=>if a!=b{out.push(json!({"path":p,"before":a,"after":b}));}}}
fn shape(d:&DocumentCore)->Value{let t=table(d);json!({"rows":t.row_count,"cols":t.col_count,"cells":t.cells.iter().map(|c|json!({"row":c.row,"col":c.col,"rs":c.row_span,"cs":c.col_span,"width":c.width,"height":c.height,"paragraphs":c.paragraphs.iter().map(|p|json!({"text":p.text,"shape":p.para_shape_id,"runs":p.char_shapes})).collect::<Vec<_>>()})).collect::<Vec<_>>()})}
fn exports(d:&DocumentCore,format:&str)->Vec<u8>{let a=if format=="hwp"{d.export_hwp_with_adapter_snapshot_with_report().unwrap()}else{d.export_hwpx_native_with_report().unwrap()};assert!(a.content_loss().is_empty(),"{}",a.content_loss().to_json());a.bytes().to_vec()}
fn roundtrip(d:&DocumentCore,name:&str){let before=geometry(d);let sem=shape(d);for format in ["hwp","hwpx"]{let bytes=exports(d,format);let r=DocumentCore::from_bytes(&bytes).unwrap();let mut differences=vec![];diff(&before,&geometry(&r),"",&mut differences);let p=root().join(format!("build/transpose-closure77/{}-{name}-{format}.json",std::env::var("JUEONY_TRANSPOSE_MODE").unwrap()));std::fs::write(p,serde_json::to_vec_pretty(&json!({"differences":differences,"sourceGeometry":before,"reopenedGeometry":geometry(&r),"sourceShape":sem,"reopenedShape":shape(&r)})).unwrap()).unwrap();assert!(differences.is_empty(),"{name} {format}:{}",serde_json::to_string(&differences).unwrap());assert_eq!(sem,shape(&r),"{name} {format} semantic");let twice=DocumentCore::from_bytes(&exports(&r,format)).unwrap();let mut twice_diff=vec![];diff(&before,&geometry(&twice),"",&mut twice_diff);assert!(twice_diff.is_empty(),"{name} second {format}:{}",serde_json::to_string(&twice_diff).unwrap());}}
fn fresh(merged:bool)->DocumentCore{let mut d=DocumentCore::new_empty();d.create_blank_document_native().unwrap();let t=parse(&d.create_table_native(0,0,0,3,3).unwrap());let p=t["paraIdx"].as_u64().unwrap()as usize;let ci=t["controlIdx"].as_u64().unwrap()as usize;assert_eq!(p,0);for i in 0..9{d.insert_text_in_cell_native(0,p,ci,i,0,0,&format!("셀{i}😀")).unwrap();d.apply_char_format_in_cell_native(0,p,ci,i,0,2,3,r##"{"bold":true}"##).unwrap();}if merged{d.merge_table_cells_native(0,p,ci,0,0,0,1).unwrap();d.merge_table_cells_native(0,p,ci,1,2,2,2).unwrap();d.set_cell_properties_native(0,p,ci,0,r##"{"fillType":"solid","fillColor":"#ddffaa","paddingLeft":350}"##).unwrap();}d}
#[test]fn compiled_source_proof(){let source=include_str!("../src/document_core/commands/table_ops.rs");let expected=std::env::var("JUEONY_TABLE_OPS_SHA").unwrap();use sha2::{Digest,Sha256};assert_eq!(Sha256::digest(source.as_bytes()).iter().map(|b|format!("{b:02x}")).collect::<String>(),expected);println!("COMPILED_TABLE_OPS_SHA {expected}");}
#[test]fn fresh_merged_transpose(){let mut d=fresh(true);{let ci=d.document().sections[0].paragraphs[0].controls.iter().position(|c|matches!(c,Control::Table(_))).unwrap();d.transpose_table_cells_in_place_native(0,0,ci)}.unwrap();roundtrip(&d,"fresh-merged");}
#[test]fn loaded_hwp_merged_transpose(){let mut d=DocumentCore::from_bytes(&std::fs::read(root().join("build/document-save-transpose77/properties.hwp")).unwrap()).unwrap();{let ci=d.document().sections[0].paragraphs[0].controls.iter().position(|c|matches!(c,Control::Table(_))).unwrap();d.transpose_table_cells_in_place_native(0,0,ci)}.unwrap();roundtrip(&d,"loaded-hwp");}
#[test]fn loaded_hwpx_merged_transpose(){let mut d=DocumentCore::from_bytes(&std::fs::read(root().join("build/document-save-transpose77/properties.hwpx")).unwrap()).unwrap();{let ci=d.document().sections[0].paragraphs[0].controls.iter().position(|c|matches!(c,Control::Table(_))).unwrap();d.transpose_table_cells_in_place_native(0,0,ci)}.unwrap();roundtrip(&d,"loaded-hwpx");}
#[test]fn unmerged_transpose(){let mut d=fresh(false);{let ci=d.document().sections[0].paragraphs[0].controls.iter().position(|c|matches!(c,Control::Table(_))).unwrap();d.transpose_table_cells_in_place_native(0,0,ci)}.unwrap();roundtrip(&d,"unmerged");}
#[test]fn unchanged_merged(){let d=fresh(true);roundtrip(&d,"unchanged");}
#[test]fn repeat_transpose(){let mut d=fresh(true);let before=shape(&d);{let ci=d.document().sections[0].paragraphs[0].controls.iter().position(|c|matches!(c,Control::Table(_))).unwrap();d.transpose_table_cells_in_place_native(0,0,ci)}.unwrap();{let ci=d.document().sections[0].paragraphs[0].controls.iter().position(|c|matches!(c,Control::Table(_))).unwrap();d.transpose_table_cells_in_place_native(0,0,ci)}.unwrap();let after=shape(&d);let a=&before["cells"];let b=&after["cells"];for(i,a)in a.as_array().unwrap().iter().enumerate(){for k in ["row","col","rs","cs","paragraphs"]{assert_eq!(a[k],b[i][k]);}}roundtrip(&d,"twice-transposed");}
#[test]fn batch_transpose(){let mut d=fresh(true);d.begin_batch_native().unwrap();{let ci=d.document().sections[0].paragraphs[0].controls.iter().position(|c|matches!(c,Control::Table(_))).unwrap();d.transpose_table_cells_in_place_native(0,0,ci)}.unwrap();d.end_batch_native().unwrap();roundtrip(&d,"batch");}
#[test]fn protected_rejection_unchanged(){let mut d=fresh(true);d.set_cell_properties_native(0,0,2,0,r##"{"cellProtect":true}"##).unwrap();let before=serde_json::to_value(table(&d)).unwrap();let g=geometry(&d);assert!({let ci=d.document().sections[0].paragraphs[0].controls.iter().position(|c|matches!(c,Control::Table(_))).unwrap();d.transpose_table_cells_in_place_native(0,0,ci)}.is_err());assert_eq!(before,serde_json::to_value(table(&d)).unwrap());assert_eq!(g,geometry(&d));}

#[test]
fn snapshot_undo_redo_transpose() {
    let mut d=fresh(true);
    let before=geometry(&d);
    let undo=d.save_snapshot_native();
    d.transpose_table_cells_in_place_native(0,0,2).unwrap();
    let after=geometry(&d);
    let redo=d.save_snapshot_native();
    d.restore_snapshot_native(undo).unwrap();
    let mut changes=vec![];
    diff(&before,&geometry(&d),"",&mut changes);
    assert!(changes.is_empty(),"undo:{}",json!(changes));
    d.restore_snapshot_native(redo).unwrap();
    changes.clear();diff(&after,&geometry(&d),"",&mut changes);
    assert!(changes.is_empty(),"redo:{}",json!(changes));
    roundtrip(&d,"snapshot-redo");
}

fn raw_trace(d:&DocumentCore)->Value {
    json!({"profile":format!("{:?}",d.document().layout_profile()),
        "info":parse(&d.get_document_info()),
        "sections":d.document().sections.iter().map(|s|json!({
            "rawStreamPresent":s.raw_stream.is_some(),
            "paragraphs":s.paragraphs.iter().enumerate().map(|(i,p)|json!({
                "index":i,"text":p.text,"lineSegs":p.line_segs,
                "tables":p.controls.iter().filter_map(|c|if let Control::Table(t)=c{
                    Some(json!({"common":t.common,"attr":t.attr,"pageBreak":format!("{:?}",t.page_break),
                        "rawCtrlData":t.raw_ctrl_data,"rows":t.row_count,"cols":t.col_count,
                        "rawRowHeights":t.get_raw_row_heights()}))
                }else{None}).collect::<Vec<_>>()
            })).collect::<Vec<_>>()
        })).collect::<Vec<_>>()})
}

#[test]
fn known_table_y_trace_is_not_a_transpose_fix() {
    let mut d=DocumentCore::new_empty();d.create_blank_document_native().unwrap();
    d.insert_text_native(0,0,0,"표 앞 본문 😀").unwrap();
    d.split_paragraph_native(0,0,d.get_paragraph_length_native(0,0).unwrap(),None).unwrap();
    let first=parse(&d.create_table_native(0,1,0,3,2).unwrap());
    let ci=first["controlIdx"].as_u64().unwrap()as usize;
    for cell in 0..6 {d.insert_text_in_cell_native(0,1,ci,cell,0,0,&format!("업무 {cell}")).unwrap();}
    d.apply_char_format_in_cell_native(0,1,ci,2,0,0,4,r##"{"bold":true,"fontSize":1200}"##).unwrap();
    d.set_cell_properties_native(0,1,ci,3,r##"{"fillType":"solid","fillColor":"#ffeeaa"}"##).unwrap();
    d.split_paragraph_native(0,1,d.get_paragraph_length_native(0,1).unwrap(),None).unwrap();
    d.create_table_native(0,2,0,2,2).unwrap();
    let mut d=DocumentCore::from_bytes(&exports(&d,"hwp")).unwrap();
    let initial=raw_trace(&d);
    for cell in 0..2 {d.set_cell_properties_native(0,1,ci,cell,r##"{"isHeader":true}"##).unwrap();}
    d.set_table_properties_native(0,1,ci,r##"{"pageBreak":1,"repeatHeader":true}"##).unwrap();
    let source_raw=raw_trace(&d);let before=geometry(&d);let bytes=exports(&d,"hwp");
    let after_export_raw=raw_trace(&d);let r=DocumentCore::from_bytes(&bytes).unwrap();
    let mut changes=vec![];diff(&before,&geometry(&r),"",&mut changes);
    let result=json!({"status":"KNOWN_UNRESOLVED_DIFFERENCE","initial":initial,
        "sourceBeforeExport":source_raw,"sourceAfterExport":after_export_raw,
        "reopened":raw_trace(&r),"sourceLayout":before,"reopenedLayout":geometry(&r),"differences":changes});
    std::fs::write(root().join("build/transpose-closure77/table-y-readonly-trace.json"),serde_json::to_vec_pretty(&result).unwrap()).unwrap();
    assert_eq!(source_raw,after_export_raw,"export must not change source IR");
    assert_eq!(changes.len(),12,"known tableY12 must remain visible; not fixed by transpose patch");
}
