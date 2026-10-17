use rhwp::model::{document::{HWPX_ORIGIN_STREAM_PATH,HWP3_ORIGIN_STREAM_PATH,HWP3_ORIGIN_HWPX_MARKER_PATH,HWP5_ORIGIN_HWPX_MARKER_PATH},paragraph::Paragraph,provenance::SourceFormat};
fn own_pure_xml_model(text:&str)->Document {
    let mut core=DocumentCore::new_empty(); core.create_blank_document_native().unwrap(); let mut model=core.document().clone();
    model.provenance.format=SourceFormat::Hwpx;model.provenance.hwp3_lineage=false;model.provenance.hwpx_lineage=false;
    model.is_hwpx_variant=false;model.is_hwp3_variant=false;model.hwpx_aux_entries.clear();model.extra_streams.clear();
    let mut para=Paragraph::new_empty_like(&model.sections[0].paragraphs[0]);
    para.insert_text_at(0,text);para.line_segs.clear();para.stored_text_partition_dirty=false;
    model.sections[0].paragraphs.push(para);model.sections[0].raw_stream=None;model
}
fn own_pure_xml()->DocumentCore {let model=own_pure_xml_model("SELF generated document body 😀 with original spaces and words. ".repeat(12).as_str());
    let bytes=rhwp::serializer::hwpx::serialize_hwpx(&model).unwrap();DocumentCore::from_bytes(&bytes).unwrap()}
fn own_marker(bytes:Vec<u8>,value:Option<&[u8]>,hwp3:bool)->Vec<u8>{use std::io::{Cursor,Write};let mut c=cfb::CompoundFile::open(Cursor::new(bytes)).unwrap();
    if let Some(value)=value{c.create_stream(HWPX_ORIGIN_STREAM_PATH).unwrap().write_all(value).unwrap();}else{c.remove_stream(HWPX_ORIGIN_STREAM_PATH).unwrap();}
    if hwp3{c.create_stream(HWP3_ORIGIN_STREAM_PATH).unwrap().write_all(b"1").unwrap();}c.into_inner().into_inner()}
#[test]fn own_versioned_export_omits_only_generated_cache_and_reconstructs_it(){let d=own_pure_xml();let p=&d.document().sections[0].paragraphs[1];assert!(!p.line_segs.is_empty());assert!(p.source_line_seg_vertical_pos.is_none());
    let source=serde_json::to_vec(&d.document().sections[0].paragraphs).unwrap();let snapshot=d.prepare_hwp_export_snapshot();assert!(snapshot.document().sections[0].paragraphs[1].line_segs.is_empty());
    assert_eq!(snapshot.document().extra_streams.iter().filter(|(path,_)|path==HWPX_ORIGIN_STREAM_PATH).count(),1);
    assert_eq!(snapshot.document().extra_streams.iter().find(|(path,_)|path==HWPX_ORIGIN_STREAM_PATH).unwrap().1,b"2:xml-import-v1");
    let artifact=d.export_hwp_with_adapter_snapshot_with_report().unwrap();assert!(artifact.content_loss().is_empty());let r=DocumentCore::from_bytes(artifact.bytes()).unwrap();assert!(!r.document().sections[0].paragraphs[1].line_segs.is_empty());
    assert_eq!(source,serde_json::to_vec(&d.document().sections[0].paragraphs).unwrap());let mut delta=vec![];diff(&state(&d),&state(&r),"pages",&mut delta);assert!(delta.is_empty(),"full own geometry: {:?}",delta.iter().take(4).collect::<Vec<_>>());}
#[test]fn native_legacy_unknown_and_conflicting_hwp3_markers_grant_no_new_cache_authority(){let d=own_pure_xml();let artifact=d.export_hwp_with_adapter_snapshot_with_report().unwrap();let bytes=artifact.into_bytes();
    for(value,hwp3)in[(None,false),(Some(b"1".as_slice()),false),(Some(b"2:xml-import-v1x".as_slice()),false),(Some(b"2:xml-import-v1\0".as_slice()),false),(Some(b"2:xml-import-v1".as_slice()),true)]{
        let r=DocumentCore::from_bytes(&own_marker(bytes.clone(),value,hwp3)).unwrap();assert!(r.document().sections[0].paragraphs[1].line_segs.is_empty(),"value={:?}/hwp3={hwp3}",value);
    }}
#[test]fn original_marker_and_conflicting_source_origin_payloads_are_not_rewritten(){for mode in["legacy","unknown","hwp3-stream","hwp3-aux","hwp5-aux"]{let mut d=own_pure_xml();let mut m=d.document().clone();match mode{
    "legacy"=>m.extra_streams.push((HWPX_ORIGIN_STREAM_PATH.into(),b"1".to_vec())),"unknown"=>m.extra_streams.push((HWPX_ORIGIN_STREAM_PATH.into(),b"opaque".to_vec())),
    "hwp3-stream"=>m.extra_streams.push((HWP3_ORIGIN_STREAM_PATH.into(),b"1".to_vec())),"hwp3-aux"=>m.hwpx_aux_entries.push((HWP3_ORIGIN_HWPX_MARKER_PATH.into(),b"1".to_vec())),
    "hwp5-aux"=>m.hwpx_aux_entries.push((HWP5_ORIGIN_HWPX_MARKER_PATH.into(),b"unknown".to_vec())),_=>unreachable!()};let original=m.extra_streams.clone();let aux=m.hwpx_aux_entries.clone();d.set_document(m);let snap=d.prepare_hwp_export_snapshot();
    assert!(!snap.document().extra_streams.iter().any(|(path,b)|path==HWPX_ORIGIN_STREAM_PATH&&b==b"2:xml-import-v1"),"mode={mode}");
    for entry in original.iter().filter(|(path,_)|path==HWPX_ORIGIN_STREAM_PATH||path==HWP3_ORIGIN_STREAM_PATH){assert!(snap.document().extra_streams.contains(entry),"original marker mode={mode}");}assert_eq!(d.document().extra_streams,original);assert_eq!(d.document().hwpx_aux_entries,aux);
    assert_eq!(snap.document().sections[0].paragraphs[1].line_segs,d.document().sections[0].paragraphs[1].line_segs,"excluded cache {mode}");}}
#[test]fn origin_controls_soft_hyphen_fixed_space_and_literals_remain_distinct(){for control_origin in[false,true]{let mut model=own_pure_xml_model("SELF A\u{00ad}B\u{2007}C 😀");model.provenance.format=SourceFormat::Hwp5;model.provenance.hwpx_lineage=true;model.is_hwpx_variant=true;model.extra_streams.push((HWPX_ORIGIN_STREAM_PATH.into(),b"2:xml-import-v1".to_vec()));
    let bits=(1u32<<24)|(1u32<<31);if control_origin{model.sections[0].paragraphs[1].control_mask|=bits;}else{model.sections[0].paragraphs[1].control_mask&=!bits;}
    let bytes=rhwp::serializer::serialize_document(&model).unwrap();let d=DocumentCore::from_bytes(&bytes).unwrap();assert_eq!(d.document().sections[0].paragraphs[1].control_mask&bits,if control_origin{bits}else{0});let text=d.document().sections[0].paragraphs[1].text.clone();
    let out=d.export_hwp_with_adapter_snapshot_with_report().unwrap();assert!(out.content_loss().is_empty());let r=DocumentCore::from_bytes(out.bytes()).unwrap();assert_eq!(r.document().sections[0].paragraphs[1].text,text);assert_eq!(r.document().sections[0].paragraphs[1].control_mask&bits,if control_origin{bits}else{0});}}

#[test]fn unsafe_generated_body_cache_owners_are_not_omitted(){for mode in["dirty","source-map","unknown-control","field-range","layout-fill","stored-tag","negative-spacing","empty","page-break"]{let mut d=own_pure_xml();let mut m=d.document().clone();let p=&mut m.sections[0].paragraphs[1];match mode{
"dirty"=>p.stored_text_partition_dirty=true,"source-map"=>p.source_line_seg_vertical_pos=Some(p.line_segs.iter().map(|l|l.vertical_pos).collect()),
"unknown-control"=>p.controls.push(Control::Unknown(rhwp::model::control::UnknownControl{ctrl_id:0x11223344})),"field-range"=>p.field_ranges.push(Default::default()),"layout-fill"=>p.layout_only_fill_lines=1,
"stored-tag"=>p.line_segs[0].tag &= !rhwp::model::paragraph::LineSeg::TAG_IMPLEMENTATION_PROPERTY,"negative-spacing"=>p.line_segs[0].line_spacing=-1,"empty"=>p.text.clear(),"page-break"=>p.column_type=rhwp::model::paragraph::ColumnBreakType::Page,_=>unreachable!()};d.set_document(m);
let before=d.document().sections[0].paragraphs[1].line_segs.clone();let snapshot=d.prepare_hwp_export_snapshot();assert_eq!(snapshot.document().sections[0].paragraphs[1].line_segs,before,"mode={mode}");}}
#[test]fn own_edit_snapshot_undo_redo_and_stale_source_cache_storage(){let mut d=own_pure_xml();let initial=state(&d);let before=d.save_snapshot_native();d.insert_text_native(0,1,0,"EDIT 😀 ").unwrap();let changed=state(&d);assert_ne!(initial,changed);let after=d.save_snapshot_native();
let source=serde_json::to_vec(&d.document().sections[0].paragraphs).unwrap();let artifact=d.export_hwp_with_adapter_snapshot_with_report().unwrap();assert!(artifact.content_loss().is_empty());let r=DocumentCore::from_bytes(artifact.bytes()).unwrap();let mut delta=vec![];diff(&changed,&state(&r),"pages",&mut delta);assert!(delta.is_empty(),"edited geometry {:?}",delta.iter().take(4).collect::<Vec<_>>());assert_eq!(source,serde_json::to_vec(&d.document().sections[0].paragraphs).unwrap());d.restore_snapshot_native(before).unwrap();assert_eq!(state(&d),initial);d.restore_snapshot_native(after).unwrap();assert_eq!(state(&d),changed);
}

#[test]fn retained_source_map_cannot_override_dirty_or_unresolved_tab_omission(){use rhwp::parser::{record::Record,tags};for mode in["clean","dirty","unresolved-tab"]{let d=own_pure_xml();let mut section=d.document().sections[0].clone();let mut p=section.paragraphs[1].clone();p.line_segs[0].vertical_pos=3456;p.source_line_seg_vertical_pos=Some(p.line_segs.iter().map(|_|1234).collect());
if mode=="dirty"{p.stored_text_partition_dirty=true;}if mode=="unresolved-tab"{p.insert_text_at(0,"\t");p.tab_extended.clear();p.stored_text_partition_dirty=false;}section.paragraphs=vec![p];section.raw_stream=None;
let records=Record::read_all(&rhwp::serializer::body_text::serialize_section(&section)).unwrap();let lines:Vec<_>=records.iter().filter(|r|r.tag_id==tags::HWPTAG_PARA_LINE_SEG).collect();
if mode=="clean"{assert_eq!(lines.len(),1);assert_eq!(i32::from_le_bytes(lines[0].data[4..8].try_into().unwrap()),1234);}else{assert!(lines.is_empty(),"stale map resurrected rows for {mode}");}
}}
