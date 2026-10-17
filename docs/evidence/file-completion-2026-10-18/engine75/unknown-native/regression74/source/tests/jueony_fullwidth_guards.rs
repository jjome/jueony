use rhwp::{DocumentCore,model::{control::{Control,UnknownControl,Field},shape::{VertRelTo,Caption},table::{Table,TableZone,TablePageBreak}}};
use serde_json::{json,Value};use sha2::{Digest,Sha256};
fn hash(b:&[u8])->String{Sha256::digest(b).iter().map(|x|format!("{x:02x}")).collect()}
fn table(d:&mut rhwp::model::document::Document,p:usize)->&mut Table{let Control::Table(t)=&mut d.sections[0].paragraphs[p].controls[0]else{panic!()};t}
fn geometry(d:&DocumentCore)->Value{json!((0..d.page_count()).map(|p|json!({"controls":serde_json::from_str::<Value>(&d.get_page_control_layout_native(p).unwrap()).unwrap(),"text":serde_json::from_str::<Value>(&d.get_page_text_layout_native(p).unwrap()).unwrap()})).collect::<Vec<_>>())}
fn same(a:&Value,b:&Value,path:&str){match(a,b){(Value::Number(a),Value::Number(b))=>assert!((a.as_f64().unwrap()-b.as_f64().unwrap()).abs()<=0.2,"{path}: {a} !={b}"),(Value::Array(a),Value::Array(b))=>{assert_eq!(a.len(),b.len(),"{path}");for(i,(a,b))in a.iter().zip(b).enumerate(){same(a,b,&format!("{path}/{i}"));}},(Value::Object(a),Value::Object(b))=>{assert_eq!(a.keys().collect::<Vec<_>>(),b.keys().collect::<Vec<_>>(),"{path}");for(k,a)in a{same(a,&b[k],&format!("{path}/{k}"));}},_=>assert_eq!(a,b,"{path}")}}
fn run(name:&str){let bytes=std::fs::read(if name=="mixed_earlier_negative"{"../final-inputs/three.hwp"}else{"../hancom-current/offset.hwp"}).unwrap();let frozen:Value=serde_json::from_slice(&std::fs::read("../independent-oracle68.json").unwrap()).unwrap();let pinned=frozen["observations"].as_array().unwrap().iter().find(|r|r["name"]==if name=="mixed_earlier_negative"{"three.hwp"}else{"offset.hwp"}).unwrap();let expected_hash=if name=="mixed_earlier_negative"{&pinned["original"]["sha256"]}else{&pinned["hancom"]["sha256"]};assert_eq!(expected_hash.as_str(),Some(hash(&bytes).as_str()),"immutable independent source");let source=DocumentCore::from_bytes(&bytes).unwrap();let mut doc=source.document().clone();match name{
"positive_control"=>{},
"zero_target_width"=>doc.sections[0].paragraphs[2].line_segs[0].segment_width=0,
"first_full_width"=>doc.sections[0].paragraphs[1].line_segs[0].segment_width=doc.sections[0].paragraphs[0].line_segs[0].segment_width,
"leading_dirty"=>doc.sections[0].paragraphs[0].stored_text_partition_dirty=true,
"closed_gap_drift"=>doc.sections[0].paragraphs[2].line_segs[0].vertical_pos+=1,
"full_width_drift"=>doc.sections[0].paragraphs[2].line_segs[0].segment_width-=1,
"first_height_drift"=>table(&mut doc,1).common.height+=1,
"first_positive_offset"=>table(&mut doc,1).common.vertical_offset=75,
"width_relative"=>table(&mut doc,1).common.width_criterion=rhwp::model::shape::SizeCriterion::Para,
"duplicate_grid"=>{table(&mut doc,2).cells[1].row=0;table(&mut doc,2).cells[1].col=0;},
"zero_cell_height"=>table(&mut doc,2).cells[0].height=0,
"protected"=>table(&mut doc,2).common.size_protect=true,"locked"=>table(&mut doc,2).common.locked=true,
"rowspan"=>table(&mut doc,2).cells[0].row_span=2,"colspan"=>table(&mut doc,2).cells[0].col_span=2,
"dirtyrow"=>doc.sections[0].paragraphs[2].stored_text_partition_dirty=true,
"dirtycell"=>doc.sections[0].paragraphs[2].cell_format_vpos_dirty=true,
"synthetic"=>doc.sections[0].paragraphs[2].line_segs[0].tag|=0x8000_0000,
"unknownctrl"=>doc.sections[0].paragraphs[2].controls.push(Control::Unknown(UnknownControl{ctrl_id:0x11223344})),
"field"=>doc.sections[0].paragraphs[0].controls.push(Control::Field(Field::default())),
"absolute"=>table(&mut doc,2).common.vert_rel_to=VertRelTo::Paper,
"negative"=>table(&mut doc,2).common.vertical_offset=(-600i32)as u32,
"mixed_earlier_negative"=>{table(&mut doc,1).common.vertical_offset=(-600i32)as u32;table(&mut doc,3).common.vertical_offset=1000;},
"mixed_previous_negative"=>table(&mut doc,1).common.vertical_offset=(-600i32)as u32,
"huge_offset"=>table(&mut doc,2).common.vertical_offset=i32::MAX as u32,
"column"=>{let mut found=false;for c in &mut doc.sections[0].paragraphs[0].controls{if let Control::ColumnDef(col)=c{col.column_count=2;found=true;}}assert!(found);},
"caption"=>table(&mut doc,2).caption=Some(Caption::default()),
"zone"=>table(&mut doc,2).zones.push(TableZone::default()),
"cellfield"=>table(&mut doc,2).cells[0].field_name=Some("opaque-owner".into()),
"pagebreak"=>table(&mut doc,2).page_break=TablePageBreak::RowBreak,
"emptyhead"=>doc.sections[0].paragraphs[0].text.clear(),
"shiftedhead"=>doc.sections[0].paragraphs[0].line_segs[0].vertical_pos=75,
_=>panic!("unknown {name}")}
let mut d=DocumentCore::from_bytes(&bytes).unwrap();d.set_document(doc);let before=hash(&serde_json::to_vec(&d.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>()).unwrap());let hwpbefore=d.export_hwp_with_adapter_snapshot().unwrap();let hwpxbefore=d.export_hwpx_native().unwrap();let hwp_reopen=DocumentCore::from_bytes(&hwpbefore).unwrap();let hwpx_reopen=DocumentCore::from_bytes(&hwpxbefore).unwrap();let result=json!({"hwpReopen":geometry(&hwp_reopen),"hwpxReopen":geometry(&hwpx_reopen),"name":name,"pageCount":d.page_count(),"layout":geometry(&d),"paragraphTreeSha256":before,"hwpSha256":hash(&hwpbefore),"hwpxSha256":hash(&hwpxbefore)});assert_eq!(before,hash(&serde_json::to_vec(&d.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>()).unwrap()),"render must not mutate IR");assert_eq!(hwpbefore,d.export_hwp_with_adapter_snapshot().unwrap(),"render must not mutate HWP bytes");assert_eq!(hwpxbefore,d.export_hwpx_native().unwrap(),"render must not mutate HWPX bytes");let comparable=std::env::var_os("JUEONY_COMPARABLE_BASELINE73").is_some();let directory=if comparable{"../fullwidth-guard-baseline73"}else{"../fullwidth-guard-baseline"};let path=format!("{directory}/{name}.json");if std::env::var_os("JUEONY_WRITE_BASELINE").is_some(){std::fs::create_dir_all(directory).unwrap();assert!(!std::path::Path::new(&path).exists());std::fs::write(path,serde_json::to_vec_pretty(&result).unwrap()).unwrap();}else{let expected:Value=serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();if comparable {same(&expected,&result,"same-codec full published geometry and exact bytes");let report=d.export_hwpx_native_with_report().unwrap();if name=="unknownctrl"{assert!(!report.content_loss().is_empty(),"genuine unknown-control omission remains an independent report failure until its dedicated fix");}} else if name=="positive_control"{assert_ne!(expected["hwpxReopen"],result["hwpxReopen"],"actual-source conversion control must exercise the marker regression");let frozen:Value=serde_json::from_slice(&std::fs::read("../independent-oracle68.json").unwrap()).unwrap();let record=frozen["observations"].as_array().unwrap().iter().find(|r|r["name"]=="offset.hwp").unwrap();let expected_layout=json!([{ "controls":{"controls":record["afterLayout"][0]["controls"]},"text":{"runs":record["afterLayout"][0]["runs"]}}]);same(&expected_layout,&result["layout"],"independent positive control");same(&expected_layout,&result["hwpReopen"],"independent HWP reopen");same(&expected_layout,&result["hwpxReopen"],"independent HWPX reopen");}else if ["dirtycell","unknownctrl"].contains(&name){
// Both cases already failed old70 strict conversion (240.9 -> 244.7).
// Do not freeze that serializer-reparse bug as a valid exclusion oracle.
let mut independently_corrected=expected.clone();
same(&expected["layout"],&result["layout"],"excluded live complete geometry unchanged");
same(&expected["hwpReopen"],&result["hwpReopen"],"excluded HWP complete geometry unchanged");
assert_eq!(expected["paragraphTreeSha256"],result["paragraphTreeSha256"],"exact original IR unchanged");assert_eq!(expected["hwpSha256"],result["hwpSha256"],"exact HWP bytes unchanged");assert_eq!(expected["hwpxSha256"],result["hwpxSha256"],"exact HWPX bytes unchanged");
let frozen:Value=serde_json::from_slice(&std::fs::read("../independent-oracle68.json").unwrap()).unwrap();let record=frozen["observations"].as_array().unwrap().iter().find(|r|r["name"]=="offset.hwp").unwrap();let actual=json!([{ "controls":{"controls":record["afterLayout"][0]["controls"]},"text":{"runs":record["afterLayout"][0]["runs"]}}]);
same(&actual,&result["hwpxReopen"],"complete independent reopened owner geometry");independently_corrected["hwpxReopen"]=actual;same(&independently_corrected,&result,name);
let report=d.export_hwpx_native_with_report().unwrap();if name=="unknownctrl"{assert!(!report.content_loss().is_empty(),"genuine unknown-owner omission must remain rejected by the unchanged application guard");}else{assert!(report.content_loss().is_empty(),"transient internal dirty bit is not user content loss");}
std::fs::write(format!("../fullwidth-{name}-correction-v3.json"),serde_json::to_vec_pretty(&json!({"baseline":expected,"candidate":result,"lossReport":serde_json::from_str::<Value>(&report.content_loss().to_json()).unwrap(),"guardRelaxed":false})).unwrap()).unwrap();
}else{same(&expected,&result,name);}let out=if comparable{"../fullwidth-guard-candidate73"}else{"../fullwidth-guard-candidate"};std::fs::create_dir_all(out).unwrap();std::fs::write(format!("{out}/{name}.json"),serde_json::to_vec_pretty(&result).unwrap()).unwrap();}}
macro_rules! case{($name:ident)=>{#[test]fn $name(){run(stringify!($name));}}}
case!(protected);case!(locked);case!(rowspan);case!(colspan);case!(dirtyrow);case!(dirtycell);case!(synthetic);case!(unknownctrl);case!(field);case!(absolute);case!(negative);case!(mixed_previous_negative);case!(huge_offset);case!(column);case!(caption);case!(zone);case!(cellfield);case!(pagebreak);case!(emptyhead);case!(shiftedhead);

case!(positive_control);

case!(mixed_earlier_negative);


case!(leading_dirty);case!(closed_gap_drift);case!(full_width_drift);case!(first_height_drift);case!(first_positive_offset);case!(width_relative);case!(duplicate_grid);case!(zero_cell_height);

case!(zero_target_width);case!(first_full_width);
