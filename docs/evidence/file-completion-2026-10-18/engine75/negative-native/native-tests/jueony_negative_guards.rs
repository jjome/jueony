use rhwp::{DocumentCore,model::{control::{Control,UnknownControl,Field},shape::{VertRelTo,Caption},table::{Table,TableZone,TablePageBreak}}};
use serde_json::{json,Value};use sha2::{Digest,Sha256};
fn hash(b:&[u8])->String{Sha256::digest(b).iter().map(|x|format!("{x:02x}")).collect()}
fn table(d:&mut rhwp::model::document::Document,p:usize)->&mut Table{let Control::Table(t)=&mut d.sections[0].paragraphs[p].controls[0]else{panic!()};t}
fn geometry(d:&DocumentCore)->Value{json!((0..d.page_count()).map(|p|json!({"controls":serde_json::from_str::<Value>(&d.get_page_control_layout_native(p).unwrap()).unwrap(),"text":serde_json::from_str::<Value>(&d.get_page_text_layout_native(p).unwrap()).unwrap()})).collect::<Vec<_>>())}
fn same(a:&Value,b:&Value,path:&str){match(a,b){(Value::Number(a),Value::Number(b))=>assert!((a.as_f64().unwrap()-b.as_f64().unwrap()).abs()<=0.2,"{path}: {a} !={b}"),(Value::Array(a),Value::Array(b))=>{assert_eq!(a.len(),b.len(),"{path}");for(i,(a,b))in a.iter().zip(b).enumerate(){same(a,b,&format!("{path}/{i}"));}},(Value::Object(a),Value::Object(b))=>{assert_eq!(a.keys().collect::<Vec<_>>(),b.keys().collect::<Vec<_>>(),"{path}");for(k,a)in a{same(a,&b[k],&format!("{path}/{k}"));}},_=>assert_eq!(a,b,"{path}")}}
fn run(name:&str){let bytes=std::fs::read("../support/negative.hwp").unwrap();assert_eq!(hash(&bytes),"a5c62e0b6cff7a9ba3445517bfc2f47494f841d75694f45400911fb115c3eec8");let source=DocumentCore::from_bytes(&bytes).unwrap();let mut doc=source.document().clone();match name{
"positive_control"=>{},
"two_columns"=>{for c in &mut doc.sections[0].paragraphs[0].controls{if let Control::ColumnDef(col)=c{col.column_count=2;}}},
"missing_section"=>doc.sections[0].paragraphs[0].controls.retain(|c|!matches!(c,Control::SectionDef(_))),
"missing_column"=>doc.sections[0].paragraphs[0].controls.retain(|c|!matches!(c,Control::ColumnDef(_))),
"positive_offset"=>table(&mut doc,2).common.vertical_offset=1000,
"partial_margin"=>table(&mut doc,2).common.vertical_offset=(-100i32)as u32,
"huge_negative"=>table(&mut doc,2).common.vertical_offset=i32::MIN as u32,
"horizontal_offset"=>table(&mut doc,2).common.horizontal_offset=75,
"zero_width"=>table(&mut doc,2).common.width=0,
"relative_height"=>table(&mut doc,2).common.height_criterion=rhwp::model::shape::SizeCriterion::Para,
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
assert!(!rhwp::jueony_private_negative_contract(&doc),"unsafe source must not acquire the new frame owner: {name}");let before=hash(&serde_json::to_vec(&doc.sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>()).unwrap());let mut d=DocumentCore::from_bytes(&bytes).unwrap();d.set_document(doc);let _=geometry(&d);let report=d.export_hwpx_native_with_report().unwrap();if name=="unknownctrl"{assert!(!report.content_loss().is_empty(),"genuine opaque control loss stays reported");}assert_eq!(before,hash(&serde_json::to_vec(&d.document().sections.iter().map(|s|&s.paragraphs).collect::<Vec<_>>()).unwrap()),"planning/render/export cannot rewrite source IR");}
macro_rules! case{($name:ident)=>{#[test]fn $name(){run(stringify!($name));}}}
case!(protected);case!(locked);case!(rowspan);case!(colspan);case!(dirtyrow);case!(dirtycell);case!(leading_dirty);case!(synthetic);case!(unknownctrl);case!(field);case!(absolute);case!(positive_offset);case!(partial_margin);case!(huge_negative);case!(horizontal_offset);case!(zero_width);case!(relative_height);case!(caption);case!(zone);case!(cellfield);case!(pagebreak);case!(emptyhead);case!(shiftedhead);case!(width_relative);case!(duplicate_grid);case!(zero_cell_height);
#[test]fn actual_column_exclusion(){let frozen:Value=serde_json::from_slice(&std::fs::read("../independent-oracle68.json").unwrap()).unwrap();let record=frozen["observations"].as_array().unwrap().iter().find(|r|r["name"]=="column2.hwp").unwrap();for(label,path,key)in[("original","../support/column2.hwp","beforeLayout"),("actual","../hancom-current/column2.hwp","afterLayout")]{let bytes=std::fs::read(path).unwrap();let d=DocumentCore::from_bytes(&bytes).unwrap();assert!(!rhwp::jueony_private_negative_contract(d.document()));let expected=json!([{ "controls":{"controls":record[key][0]["controls"]},"text":{"runs":record[key][0]["runs"]}}]);same(&expected,&geometry(&d),label);}}

case!(two_columns);case!(missing_section);case!(missing_column);
