use rhwp::{DocumentCore,model::control::Control};
use serde_json::Value;
fn fixture(name:&str)->DocumentCore {let root=std::env::var("JUEONY_TABLE_HEIGHT_CONTROLS").unwrap();DocumentCore::from_bytes(&std::fs::read(std::path::Path::new(&root).join(format!("{name}.hwpx"))).unwrap()).unwrap()}
fn plan(d:&DocumentCore)->Value {serde_json::from_str(&d.get_table_content_height_plan_native(0,1,0).unwrap()).unwrap()}
fn model(d:&DocumentCore)->rhwp::model::document::Document {rhwp::parser::parse_hwp(&d.export_hwp_with_adapter_snapshot().unwrap()).unwrap()}
fn cells(d:&DocumentCore)->Value {let doc=model(d);let Control::Table(t)=&doc.sections[0].paragraphs[1].controls[0]else{panic!("table")};serde_json::to_value(&t.cells).unwrap()}
fn check(name:&str,before:u32,after:u32,rows:&[u32]) {
 let mut d=fixture(name);let initial=d.export_hwp_with_adapter_snapshot().unwrap();let events=d.serialize_event_log();let source_cells=cells(&d);let p=plan(&d);
 assert_eq!(p["beforeHeight"],before);assert_eq!(p["afterHeight"],after);assert_eq!(p["rowHeightsHu"],serde_json::json!(rows));assert_eq!(d.export_hwp_with_adapter_snapshot().unwrap(),initial);assert_eq!(d.serialize_event_log(),events,"read-only planner cannot create events");
 let token=d.save_snapshot_native();let r:Value=serde_json::from_str(&d.apply_table_content_height_plan_native(0,1,0,before,after).unwrap()).unwrap();assert_eq!(r["changed"],before!=after);assert_eq!(cells(&d),source_cells,"all cell declarations/contents/raw metadata stay exact");
 let doc=model(&d);let Control::Table(t)=&doc.sections[0].paragraphs[1].controls[0]else{panic!("table")};assert_eq!(t.common.height,after);assert_eq!(u32::from_le_bytes(t.raw_ctrl_data[16..20].try_into().unwrap()),after);
 if before!=after {assert!(d.serialize_event_log().contains("TableContentHeightSynchronized"));}
 for bytes in [d.export_hwp_with_adapter_snapshot().unwrap(),d.export_hwpx_native().unwrap()] {let r=DocumentCore::from_bytes(&bytes).unwrap();assert_eq!(plan(&r)["beforeHeight"],after);assert_eq!(plan(&r)["afterHeight"],after);assert_eq!(cells(&r),source_cells);}
 let noop_before=d.export_hwp_with_adapter_snapshot().unwrap();let noop_events=d.serialize_event_log();let n:Value=serde_json::from_str(&d.apply_table_content_height_plan_native(0,1,0,after,after).unwrap()).unwrap();assert_eq!(n["changed"],false);assert_eq!(d.export_hwp_with_adapter_snapshot().unwrap(),noop_before);assert_eq!(d.serialize_event_log(),noop_events);
 d.restore_snapshot_native(token).unwrap();assert_eq!(d.export_hwp_with_adapter_snapshot().unwrap(),initial);
}
#[test]fn auto_zero_content_matches_independent_hancom5181(){check("auto-zero",0,5181,&[2417,1482,1282]);}
#[test]fn stale_large_box_is_not_a_user_row_minimum(){check("large",9000,5181,&[2417,1482,1282]);}
#[test]fn actual_row3000_minima_stay9000(){check("explicit-rows-9000",9000,9000,&[3000,3000,3000]);}
#[test]fn actual_hancom_cached5181_is_noop(){check("large-hancom",5181,5181,&[2417,1482,1282]);}
fn reject(mut d:DocumentCore){let bytes=d.export_hwp_with_adapter_snapshot().unwrap();let events=d.serialize_event_log();assert!(d.get_table_content_height_plan_native(0,1,0).is_err());assert!(d.apply_table_content_height_plan_native(0,1,0,0,5181).is_err());assert_eq!(d.export_hwp_with_adapter_snapshot().unwrap(),bytes);assert_eq!(d.serialize_event_log(),events);}
#[test]fn protected_small_frame_is_untouched(){reject(fixture("small-protected"));}
#[test]fn protected_large_frame_is_untouched(){reject(fixture("large-protected"));}
#[test]fn stale_before_is_atomic(){let mut d=fixture("large");let b=d.export_hwp_with_adapter_snapshot().unwrap();let e=d.serialize_event_log();assert!(d.apply_table_content_height_plan_native(0,1,0,9001,5181).is_err());assert_eq!(d.export_hwp_with_adapter_snapshot().unwrap(),b);assert_eq!(d.serialize_event_log(),e);}
#[test]fn stale_after_is_atomic(){let mut d=fixture("large");let b=d.export_hwp_with_adapter_snapshot().unwrap();assert!(d.apply_table_content_height_plan_native(0,1,0,9000,5182).is_err());assert_eq!(d.export_hwp_with_adapter_snapshot().unwrap(),b);}
#[test]fn protected_cell_is_untouched(){let mut d=fixture("large");d.set_cell_properties_native(0,1,0,0,r#"{"cellProtect":true}"#).unwrap();reject(d);}
#[test]fn locked_object_is_untouched(){let mut d=fixture("large");d.set_control_lock(Some(1),Some(0),true).unwrap();reject(d);}
#[test]fn merged_cell_is_unsupported(){let mut d=fixture("large");d.merge_table_cells_native(0,1,0,0,0,1,0).unwrap();reject(d);}
#[test]fn form_field_cell_is_unsupported(){let mut d=fixture("large");d.set_cell_properties_native(0,1,0,0,r#"{"fieldName":"source"}"#).unwrap();reject(d);}
#[test]fn rowbreak_or_split_owner_is_unsupported(){let mut d=fixture("large");d.set_table_properties_native(0,1,0,r#"{"pageBreak":2}"#).unwrap();reject(d);}
#[test]fn content_padding_grow_and_shrink_keep_real_row_minima(){let mut d=fixture("auto-zero");d.apply_table_content_height_plan_native(0,1,0,0,5181).unwrap();for c in [0,1] {d.set_cell_properties_native(0,1,0,c,r#"{"paddingTop":141,"paddingBottom":141}"#).unwrap();}assert_eq!(plan(&d)["afterHeight"],4046);d.apply_table_content_height_plan_native(0,1,0,5181,4046).unwrap();for c in [0,1]{d.set_cell_properties_native(0,1,0,c,r#"{"paddingTop":283,"paddingBottom":1134}"#).unwrap();}assert_eq!(plan(&d)["afterHeight"],5181);}
