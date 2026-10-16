use rhwp::{DocumentCore,model::control::Control};
use serde_json::Value;
fn properties(d:&DocumentCore)->Value {
 let doc=rhwp::parser::parse_hwp(&d.export_hwp_with_adapter_snapshot().unwrap()).unwrap();
 let Control::Table(t)=&doc.sections[0].paragraphs[1].controls[0] else {panic!("table")};
 let mut v=serde_json::to_value(&t.common).unwrap();
 v.as_object_mut().unwrap().remove("width");
 v["tableWidth"]=t.common.width.into();v["tableHeight"]=t.common.height.into();v
}
fn cell(d:&DocumentCore)->Value {
 let doc=rhwp::parser::parse_hwp(&d.export_hwp_with_adapter_snapshot().unwrap()).unwrap();
 let Control::Table(t)=&doc.sections[0].paragraphs[1].controls[0] else {panic!("table")};
 serde_json::json!({"width":t.cells[0].width,"height":t.cells[0].height})
}
fn fixture(name:&str,as_hwp:bool)->DocumentCore {
 let base=std::env::var("JUEONY_TABLE_HEIGHT_CONTROLS").unwrap();
 let bytes=std::fs::read(std::path::Path::new(&base).join(format!("{name}.hwpx"))).unwrap();
 let d=DocumentCore::from_bytes(&bytes).unwrap();
 if as_hwp { DocumentCore::from_bytes(&d.export_hwp_with_adapter_snapshot().unwrap()).unwrap() } else {d}
}
fn check(name:&str,expected:u32,protected:bool,as_hwp:bool) {
 let mut d=fixture(name,as_hwp);let initial=d.export_hwp_with_adapter_snapshot().unwrap();let token=d.save_snapshot_native();let mut before=properties(&d);let old_cell=cell(&d);assert_eq!(before["tableHeight"],expected);
 d.set_cell_properties_native(0,1,0,0,&format!(r#"{{"width":{}}}"#,old_cell["width"].as_u64().unwrap()+300)).unwrap();
 let after=properties(&d);assert_eq!(after["tableHeight"],expected);before["tableWidth"]=after["tableWidth"].clone();assert_eq!(before,after,"unrequested table properties stay identical");assert_eq!(cell(&d)["height"],old_cell["height"]);
 for bytes in [d.export_hwp_with_adapter_snapshot().unwrap(),d.export_hwpx_native().unwrap()] {
  let parsed=rhwp::parser::parse_document(&bytes).unwrap();let Control::Table(t)=&parsed.sections[0].paragraphs[1].controls[0] else {panic!("table")};
  assert_eq!(t.common.height,expected);assert_eq!(t.common.size_protect,protected);
  if !t.raw_ctrl_data.is_empty(){assert_eq!(u32::from_le_bytes(t.raw_ctrl_data[16..20].try_into().unwrap()),expected);}
  let again=DocumentCore::from_bytes(&bytes).unwrap();assert_eq!(properties(&again)["tableHeight"],expected);
 }
 d.restore_snapshot_native(token).unwrap();assert_eq!(d.export_hwp_with_adapter_snapshot().unwrap(),initial);
}
#[test]fn zero_hwpx(){check("auto-zero",0,false,false)}
#[test]fn zero_hwp(){check("auto-zero",0,false,true)}
#[test]fn small_protected_hwpx(){check("small-protected",1400,true,false)}
#[test]fn small_protected_hwp(){check("small-protected",1400,true,true)}
#[test]fn large_hwpx(){check("large",9000,false,false)}
#[test]fn large_hwp(){check("large",9000,false,true)}
#[test]fn large_protected_hwpx(){check("large-protected",9000,true,false)}
#[test]fn large_protected_hwp(){check("large-protected",9000,true,true)}
#[test]fn unchanged_height_argument_preserves_declared_height(){let mut d=fixture("large",false);let c=cell(&d);d.set_cell_properties_native(0,1,0,0,&format!(r#"{{"width":{},"height":{}}}"#,c["width"].as_u64().unwrap()+300,c["height"])).unwrap();assert_eq!(properties(&d)["tableHeight"],9000);}
#[test]fn explicit_height_change_still_recalculates_rows(){let mut d=fixture("large",false);let c=cell(&d);d.set_cell_properties_native(0,1,0,0,&format!(r#"{{"height":{}}}"#,c["height"].as_u64().unwrap()+700)).unwrap();assert_eq!(properties(&d)["tableHeight"],1546);}
#[test]fn explicit_both_axes_still_change_both_dimensions(){let mut d=fixture("large",false);let c=cell(&d);d.set_cell_properties_native(0,1,0,0,&format!(r#"{{"width":{},"height":{}}}"#,c["width"].as_u64().unwrap()+300,c["height"].as_u64().unwrap()+700)).unwrap();assert_eq!(properties(&d)["tableHeight"],1546);assert_eq!(properties(&d)["tableWidth"],42254);}
#[test]fn newly_created_table_width_does_not_erase_initial_height(){let mut d=DocumentCore::new_empty();d.create_blank_document_native().unwrap();d.split_paragraph_native(0,0,0,None).unwrap();d.create_table_native(0,1,0,2,2).unwrap();let before=properties(&d);let c=cell(&d);d.set_cell_properties_native(0,1,0,0,&format!(r#"{{"width":{}}}"#,c["width"].as_u64().unwrap()+300)).unwrap();assert_eq!(properties(&d)["tableHeight"],before["tableHeight"]);}
