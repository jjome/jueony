use rhwp::DocumentCore;
use serde_json::{json, Value};
use std::io::{Cursor, Read, Write};
fn blank() -> DocumentCore {
    let mut d = DocumentCore::new_empty();
    d.create_blank_document_native().unwrap();
    d
}
fn state(d: &DocumentCore) -> Value {
    serde_json::from_str(&d.get_document_metadata_native()).unwrap()
}
fn desired() -> Value {
    json!({"title":"제목 <&> 😀","subject":"공공 업무","author":"검증 작성자","keywords":"회계, 업무 & 검증","description":"설명 첫 줄\n둘째 줄\t탭"})
}
fn set(d: &mut DocumentCore, v: &Value) -> Value {
    serde_json::from_str(
        &d.set_document_metadata_native(state(d)["fingerprint"].as_str().unwrap(), &v.to_string())
            .unwrap(),
    )
    .unwrap()
}
fn reopened(d: &DocumentCore, hwpx: bool) -> DocumentCore {
    DocumentCore::from_bytes(&if hwpx {
        d.export_hwpx_native().unwrap()
    } else {
        d.export_hwp_with_adapter_snapshot().unwrap()
    })
    .unwrap()
}
#[test]
fn metadata_unicode_roundtrips_both_formats_twice() {
    for from_hwpx in [false, true] {
        let d = blank();
        let mut d = if from_hwpx { reopened(&d, true) } else { d };
        assert_eq!(state(&d)["editable"], true);
        assert_eq!(set(&mut d, &desired())["changed"], true);
        assert_eq!(state(&d)["values"], desired());
        if !from_hwpx {
            if let Ok(path) = std::env::var("JUEONY_METADATA_OUTPUT") {
                let path = std::path::Path::new(&path);
                std::fs::create_dir_all(path).unwrap();
                std::fs::write(
                    path.join("summary.hwp"),
                    d.export_hwp_with_adapter_snapshot().unwrap(),
                )
                .unwrap();
                std::fs::write(path.join("summary.hwpx"), d.export_hwpx_native().unwrap()).unwrap();
                std::fs::write(path.join("expected-summary.json"), desired().to_string()).unwrap();
            }
        }
        for hwpx in [false, true] {
            let r = reopened(&d, hwpx);
            assert_eq!(state(&r)["values"], desired());
            let r2 = reopened(&r, hwpx);
            assert_eq!(state(&r2)["values"], desired());
            assert_eq!(r2.page_count(), d.page_count());
        }
    }
}
#[test]
fn metadata_empty_values_clear_both_storages() {
    let mut d = blank();
    set(&mut d, &desired());
    let empty = json!({"title":"","subject":"","author":"","keywords":"","description":""});
    set(&mut d, &empty);
    for hwpx in [false, true] {
        assert_eq!(state(&reopened(&d, hwpx))["values"], empty);
    }
}
#[test]
fn metadata_snapshots_restore_before_and_after() {
    let mut d = blank();
    let old = state(&d)["values"].clone();
    let before = d.save_snapshot_native();
    set(&mut d, &desired());
    let after = d.save_snapshot_native();
    d.restore_snapshot_native(before).unwrap();
    assert_eq!(state(&d)["values"], old);
    d.restore_snapshot_native(after).unwrap();
    assert_eq!(state(&d)["values"], desired());
}
#[test]
fn metadata_stale_token_is_atomic() {
    let mut d = blank();
    let old = state(&d)["fingerprint"].as_str().unwrap().to_owned();
    set(&mut d, &desired());
    let bytes = d.export_hwp_with_adapter_snapshot().unwrap();
    let events = d.serialize_event_log();
    assert!(d
        .set_document_metadata_native(&old, &desired().to_string())
        .is_err());
    assert_eq!(d.export_hwp_with_adapter_snapshot().unwrap(), bytes);
    assert_eq!(d.serialize_event_log(), events);
}
#[test]
fn metadata_noop_has_no_dirty_event() {
    let mut d = blank();
    let before = d.export_hwp_with_adapter_snapshot().unwrap();
    let events = d.serialize_event_log();
    let values = state(&d)["values"].clone();
    assert_eq!(set(&mut d, &values)["changed"], false);
    assert_eq!(d.export_hwp_with_adapter_snapshot().unwrap(), before);
    assert_eq!(d.serialize_event_log(), events);
}
#[test]
fn metadata_rejects_invalid_input_without_mutation() {
    let mut d = blank();
    let before = d.export_hwp_with_adapter_snapshot().unwrap();
    for bad in [
        json!({"title":"only"}),
        {
            let mut v = desired();
            v["title"] = json!("x".repeat(4097));
            v
        },
        {
            let mut v = desired();
            v["description"] = json!("\u{0}");
            v
        },
        {
            let mut v = desired();
            v["unknown"] = json!("no");
            v
        },
    ] {
        assert!(d
            .set_document_metadata_native(
                state(&d)["fingerprint"].as_str().unwrap(),
                &bad.to_string()
            )
            .is_err());
        assert_eq!(d.export_hwp_with_adapter_snapshot().unwrap(), before);
    }
}
#[test]
fn metadata_event_records_field_names_without_values() {
    let mut d = blank();
    set(&mut d, &desired());
    let events = d.serialize_event_log();
    assert!(events.contains("DocumentMetadataChanged"));
    assert!(!events.contains("검증 작성자"));
    assert!(!events.contains("제목"));
}
#[test]
fn metadata_untouched_native_summary_converts_to_hwpx() {
    let d = blank();
    let values = state(&d)["values"].clone();
    assert_eq!(state(&reopened(&d, true))["values"], values);
}
fn hwp_model(d: &DocumentCore) -> rhwp::model::document::Document {
    rhwp::parser::parse_hwp(&d.export_hwp_with_adapter_snapshot().unwrap()).unwrap()
}
fn summary(d: &DocumentCore) -> Vec<u8> {
    hwp_model(d)
        .extra_streams
        .into_iter()
        .find(|(p, _)| p.trim_start_matches(['/', '\u{5}']) == "HwpSummaryInformation")
        .unwrap()
        .1
}
fn word(b: &[u8], i: usize) -> usize {
    u32::from_le_bytes(b[i..i + 4].try_into().unwrap()) as usize
}
// Independent property table reader: unknown slots must match byte for byte.
fn slots(b: &[u8]) -> std::collections::BTreeMap<usize, Vec<u8>> {
    let base = word(b, 44);
    let end = word(b, base);
    let n = word(b, base + 4);
    let mut locs = (0..n)
        .map(|i| (word(b, base + 8 + i * 8), word(b, base + 12 + i * 8)))
        .collect::<Vec<_>>();
    locs.sort_by_key(|v| v.1);
    locs.iter()
        .enumerate()
        .map(|(i, (pid, at))| {
            (
                *pid,
                b[base + at..base + locs.get(i + 1).map_or(end, |v| v.1)].to_vec(),
            )
        })
        .collect()
}
fn mutate_summary(d: &DocumentCore, f: impl FnOnce(&mut Vec<u8>)) -> DocumentCore {
    let mut model = hwp_model(d);
    let s = model
        .extra_streams
        .iter_mut()
        .find(|(p, _)| p.trim_start_matches(['/', '\u{5}']) == "HwpSummaryInformation")
        .unwrap();
    f(&mut s.1);
    DocumentCore::from_bytes(&rhwp::serializer::serialize_document(&model).unwrap()).unwrap()
}
#[test]
fn metadata_unknown_ole_properties_header_and_padding_stay_exact() {
    let mut d = blank();
    let before = summary(&d);
    set(&mut d, &desired());
    let after = summary(&d);
    assert_eq!(before[..48], after[..48]);
    let a = slots(&before);
    let b = slots(&after);
    for (pid, bytes) in a {
        if !(2..=6).contains(&pid) {
            assert_eq!(b[&pid], bytes, "unknown PID{pid} including padding");
        }
    }
}
#[test]
fn metadata_corrupt_ole_section_is_readonly_and_unchanged() {
    for mode in [0, 1, 2, 3] {
        let mut d = mutate_summary(&blank(), |b| {
            let base = word(b, 44);
            match mode {
                0 => b[24..28].copy_from_slice(&2u32.to_le_bytes()),
                1 => {
                    let offset = b[base + 12..base + 16].to_vec();
                    b[base + 20..base + 24].copy_from_slice(&offset);
                }
                2 => b[28] = 0,
                3 => b[base + 8..base + 12].copy_from_slice(&99u32.to_le_bytes()),
                _ => unreachable!(),
            }
        });
        let before = d.export_hwp_with_adapter_snapshot().unwrap();
        if mode == 3 {
            assert_eq!(state(&d)["editable"], true);
            continue;
        }
        assert_eq!(state(&d)["editable"], false);
        assert!(d
            .set_document_metadata_native("bad", &desired().to_string())
            .is_err());
        assert_eq!(d.export_hwp_with_adapter_snapshot().unwrap(), before);
    }
}
fn transform_xml(bytes: &[u8], f: impl FnOnce(String) -> String) -> Vec<u8> {
    let mut input = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
    let mut items = Vec::new();
    for i in 0..input.len() {
        let mut e = input.by_index(i).unwrap();
        let name = e.name().to_owned();
        let mut b = Vec::new();
        e.read_to_end(&mut b).unwrap();
        items.push((name, b));
    }
    let mut f = Some(f);
    let mut out = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for (name, b) in items {
        out.start_file(
            &name,
            zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored),
        )
        .unwrap();
        if name == "Contents/content.hpf" {
            out.write_all(f.take().unwrap()(String::from_utf8(b).unwrap()).as_bytes())
                .unwrap();
        } else {
            out.write_all(&b).unwrap();
        }
    }
    out.finish().unwrap().into_inner()
}
fn xml(d: &DocumentCore) -> String {
    let b = d.export_hwpx_native().unwrap();
    let mut z = zip::ZipArchive::new(Cursor::new(b)).unwrap();
    let mut s = String::new();
    z.by_name("Contents/content.hpf")
        .unwrap()
        .read_to_string(&mut s)
        .unwrap();
    s
}
fn xml_fixture(f: impl FnOnce(String) -> String) -> DocumentCore {
    let b = blank().export_hwpx_native().unwrap();
    DocumentCore::from_bytes(&transform_xml(&b, f)).unwrap()
}
#[test]
fn metadata_unknown_xml_attrs_and_entries_stay_verbatim() {
    let marker =
        "<opf:meta name=\"custom-acl\" content=\"opaque\">A &amp; B &#x41;</opf:meta><!--KEEP-->";
    let mut d = xml_fixture(|s| s.replace("</opf:metadata>", &format!("{marker}</opf:metadata>")));
    set(&mut d, &desired());
    assert!(xml(&d).contains(marker));
    assert_eq!(state(&reopened(&d, true))["values"], desired());
}
#[test]
fn metadata_xml_entities_and_cdata_are_actual_values() {
    let d = xml_fixture(|s| {
        s.replace(
            "<opf:title></opf:title>",
            "<opf:title><![CDATA[A < B]]>&amp;&#x1F600;</opf:title>",
        )
    });
    assert_eq!(state(&d)["values"]["title"], "A < B&😀");
    let r = reopened(&d, false);
    assert_eq!(state(&r)["values"]["title"], "A < B&😀");
}
#[test]
fn metadata_xml_duplicate_alias_and_wrong_namespace_are_readonly() {
    for mode in [0, 1, 2] {
        let mut d = xml_fixture(|s| match mode {
            0 => s.replace(
                "</opf:metadata>",
                "<opf:meta name=\"keywords\" content=\"text\">duplicate</opf:meta></opf:metadata>",
            ),
            1 => s.replace("<opf:title>", "<opf:title xmlns:opf=\"urn:other\">"),
            _ => s
                .replace("<opf:title>", "<opf:title><opf:x>")
                .replace("</opf:title>", "</opf:x></opf:title>"),
        });
        assert_eq!(state(&d)["editable"], false, "mode{mode}");
        let before = d.export_hwpx_native().unwrap();
        assert!(d
            .set_document_metadata_native("bad", &desired().to_string())
            .is_err());
        assert_eq!(d.export_hwpx_native().unwrap(), before);
    }
}
#[test]
fn metadata_xml_selfclosing_fields_preserve_attributes() {
    let mut d = xml_fixture(|s| {
        s.replace(
            "<opf:title></opf:title>",
            "<opf:title data-owner=\"A&amp;B\"/>",
        )
    });
    set(&mut d, &desired());
    assert!(xml(&d).contains("<opf:title data-owner=\"A&amp;B\">제목 &lt;&amp;&gt; 😀</opf:title>"));
}
#[test]
fn metadata_xml_readonly_getter_does_not_rewrite_any_storage() {
    let d = xml_fixture(|s| {
        s.replace(
            "<opf:title></opf:title>",
            "<opf:title>원본 제목</opf:title>",
        )
    });
    let before = d.export_hwpx_native().unwrap();
    assert_eq!(state(&d)["values"]["title"], "원본 제목");
    assert_eq!(d.export_hwpx_native().unwrap(), before);
    assert_eq!(state(&reopened(&d, false))["values"]["title"], "원본 제목");
}
