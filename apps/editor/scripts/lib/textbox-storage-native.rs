use rhwp::{DocumentCore, model::{control::Control, shape::ShapeObject, table::VerticalAlign, style::HeadType}};
use serde_json::Value;
fn fixture(kind: &str) -> (DocumentCore, usize, usize) {
    let mut d = DocumentCore::new_empty();
    d.create_blank_document_native().unwrap();
    d.insert_text_native(0, 0, 0, "본문 그대로").unwrap();
    d.split_paragraph_native(0, 0, 6, None).unwrap();
    let response: Value = serde_json::from_str(&d.create_shape_control_native(
        0, 1, 0, 18000, 10000, 20000, 24000, false, "Square", kind, false, false, &[]).unwrap()).unwrap();
    assert_eq!(response["ok"], true);
    (d, response["paraIdx"].as_u64().unwrap() as usize, response["controlIdx"].as_u64().unwrap() as usize)
}
fn check_alignment(name: &str, expected: VerticalAlign, bits: u32) {
    let (mut d, p, c) = fixture("textbox");
    d.insert_text_in_cell_native(0,p,c,0,0,0,"가😀나 글상자 내용").unwrap();
    let initial = d.export_hwp_with_adapter_snapshot().unwrap();
    let token = d.save_snapshot_native();
    d.set_shape_properties_native(0,p,c,&format!(r#"{{"tbVerticalAlign":"{}"}}"#, name)).unwrap();
    let bytes = d.export_hwp_with_adapter_snapshot().unwrap();
    let parsed = rhwp::parser::parse_hwp(&bytes).unwrap();
    let Control::Shape(shape) = &parsed.sections[0].paragraphs[p].controls[c] else { panic!("shape") };
    let ShapeObject::Rectangle(rect) = shape.as_ref() else { panic!("rectangle") };
    assert_eq!(rect.drawing.shape_attr.flip, 0x0100_0000, "Hancom-open verified native textbox storage discriminator");
    assert!(!rect.drawing.shape_attr.horz_flip && !rect.drawing.shape_attr.vert_flip);
    let tb = rect.drawing.text_box.as_ref().unwrap();
    assert_eq!(tb.vertical_align, expected);
    assert_eq!((tb.list_attr >> 5) & 3, bits);
    assert_eq!(tb.paragraphs[0].text, "가😀나 글상자 내용");
    assert_eq!(rect.common.description, "글상자입니다.");
    assert!(rect.common.raw_extra.is_empty(), "this fix does not append global common-string padding");
    let reopened = DocumentCore::from_bytes(&bytes).unwrap();
    let props: Value = serde_json::from_str(&reopened.get_shape_properties_native(0,p,c).unwrap()).unwrap();
    assert_eq!(props["tbVerticalAlign"], name);
    let hwpx = reopened.export_hwpx_native().unwrap();
    let again = DocumentCore::from_bytes(&hwpx).unwrap();
    let props: Value = serde_json::from_str(&again.get_shape_properties_native(0,p,c).unwrap()).unwrap();
    assert_eq!(props["tbVerticalAlign"], name);
    d.restore_snapshot_native(token).unwrap();
    assert_eq!(d.export_hwp_with_adapter_snapshot().unwrap(), initial);
}
#[test] fn new_textbox_top_hancom_storage_and_roundtrip() { check_alignment("Top", VerticalAlign::Top, 0); }
#[test] fn new_textbox_center_hancom_storage_and_roundtrip() { check_alignment("Center", VerticalAlign::Center, 1); }
#[test] fn new_textbox_bottom_hancom_storage_and_roundtrip() { check_alignment("Bottom", VerticalAlign::Bottom, 2); }
#[test] fn existing_loaded_shape_unknown_flags_are_not_normalized() {
    for expected in [0x8102_0003u32, 0x0008_0000u32] {
    let (d,p,c) = fixture("textbox");
    // Change the physical input record, not just the parsed model while leaving
    // its raw record cache intact: this is an original-file preservation test.
    use std::io::{Read, Write};
    let initial = d.export_hwp_with_adapter_snapshot().unwrap();
    let mut cfb = cfb::CompoundFile::open(std::io::Cursor::new(initial)).unwrap();
    let mut compressed = Vec::new();
    cfb.open_stream("/BodyText/Section0").unwrap().read_to_end(&mut compressed).unwrap();
    let mut raw = Vec::new();
    flate2::read::DeflateDecoder::new(compressed.as_slice()).read_to_end(&mut raw).unwrap();
    let (mut at, mut changed) = (0,0);
    while at < raw.len() {
        let header = u32::from_le_bytes(raw[at..at+4].try_into().unwrap()); at += 4;
        let mut size = (header >> 20) as usize;
        if size == 4095 { size = u32::from_le_bytes(raw[at..at+4].try_into().unwrap()) as usize; at += 4; }
        if header & 1023 == 76 { raw[at+36..at+40].copy_from_slice(&expected.to_le_bytes()); changed += 1; }
        at += size;
    }
    assert_eq!(changed, 1);
    let mut encoder = flate2::write::DeflateEncoder::new(Vec::new(), flate2::Compression::default());
    encoder.write_all(&raw).unwrap();
    cfb.create_stream("/BodyText/Section0").unwrap().write_all(&encoder.finish().unwrap()).unwrap();
    let bytes = cfb.into_inner().into_inner();
    let input = rhwp::parser::parse_hwp(&bytes).unwrap();
    let Control::Shape(input_shape) = &input.sections[0].paragraphs[p].controls[c] else { panic!("input shape") };
    let ShapeObject::Rectangle(input_rect) = input_shape.as_ref() else { panic!("input rectangle") };
    assert_eq!(input_rect.drawing.shape_attr.flip, expected, "physical input mutation is independently parsed before editing");
    let mut reopened = DocumentCore::from_bytes(&bytes).unwrap();
    reopened.set_shape_properties_native(0,p,c,r#"{"tbVerticalAlign":"Bottom"}"#).unwrap();
    let second = rhwp::parser::parse_hwp(&reopened.export_hwp_with_adapter_snapshot().unwrap()).unwrap();
    let Control::Shape(shape) = &second.sections[0].paragraphs[p].controls[c] else { panic!("shape") };
    let ShapeObject::Rectangle(rect) = shape.as_ref() else { panic!("rectangle") };
    assert_eq!(rect.drawing.shape_attr.flip, expected);
    }
}
#[test] fn unrelated_rectangle_creation_keeps_its_existing_storage_contract() {
    let (d,p,c) = fixture("rectangle");
    let model = rhwp::parser::parse_hwp(&d.export_hwp_with_adapter_snapshot().unwrap()).unwrap();
    let Control::Shape(shape) = &model.sections[0].paragraphs[p].controls[c] else { panic!("shape") };
    let ShapeObject::Rectangle(rect) = shape.as_ref() else { panic!("rectangle") };
    assert_eq!(rect.drawing.shape_attr.flip, 0x0008_0000);
    assert!(rect.drawing.text_box.is_none());
}
#[test] fn actual_hancom_heading_case_preserves_all_three_extended_style_levels() {
    let root = std::env::var("JUEONY_TEXTBOX_REVIEW").expect("absolute owned review fixture directory");
    let bytes = std::fs::read(std::path::Path::new(&root).join("textbox-Top-hancom.hwpx")).unwrap();
    let doc = rhwp::parser::parse_document(&bytes).unwrap();
    for (style_id, level) in [(9,7),(10,8),(11,9)] {
        let style = &doc.doc_info.styles[style_id];
        let ps = &doc.doc_info.para_shapes[style.para_shape_id as usize];
        assert_eq!(ps.head_type, HeadType::Outline);
        assert_eq!(ps.para_level, level);
    }
}
