use rhwp::parser::{doc_info::parse_doc_info, hwpx::header::parse_hwpx_header, record::Record};
use rhwp::serializer::{doc_info::serialize_doc_info, serialize_hwp_with_report};
use rhwp::{
    model::document::{Document, HwpVersion},
    DocumentCore,
};
fn raw_xml(checked: bool) -> String {
    let mut s = String::new();
    for i in 1..=10 {
        let tail = if i >= 8 {
            format!("^{} &amp; 한", i)
        } else {
            format!("^{}", i)
        };
        s.push_str(&format!(r#"<hh:paraHead level="{i}" start="{}" align="{}" useInstWidth="1" autoIndent="1" widthAdjust="{}" textOffsetType="HWPUNIT" textOffset="{}" numFormat="{}" charPrIDRef="0" checkable="{}">{tail}</hh:paraHead>"#,i+3,if i==9{"CENTER"}else{"LEFT"},if i>=8{-25}else{0},i*11,if i==8{if checked{"CIRCLED_HANGUL_SYLLABLE"}else{"HANGUL_SYLLABLE"}}else{"DIGIT"},if checked&&i==8{1}else{0}));
    }
    s
}
fn info(
    raw: &str,
) -> (
    rhwp::model::document::DocInfo,
    rhwp::model::document::DocProperties,
) {
    parse_hwpx_header(&format!(r#"<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"><hh:refList><hh:numberings itemCnt="1"><hh:numbering id="1" start="4">{raw}</hh:numbering></hh:numberings></hh:refList></hh:head>"#)).unwrap()
}
fn doc(raw: &str) -> Document {
    let mut core = DocumentCore::new_empty();
    core.create_blank_document_native().unwrap();
    let mut d = rhwp::parser::parse_hwp(&core.export_hwp_native().unwrap()).unwrap();
    d.doc_info.numberings = info(raw).0.numberings;
    d.doc_info.raw_stream_dirty = true;
    d.header.version = HwpVersion {
        major: 5,
        minor: 1,
        build: 0,
        revision: 0,
    };
    d
}
fn number_data(raw: &[u8]) -> Vec<u8> {
    Record::read_all(raw)
        .unwrap()
        .into_iter()
        .find(|r| r.tag_id == 23)
        .unwrap()
        .data
}
#[test]
fn stored_ten_levels_survive_actual_docinfo_binary_without_private_stream() {
    let (i, p) = info(&raw_xml(false));
    let bytes = serialize_doc_info(&i, &p);
    let (j, q) = parse_doc_info(&bytes).unwrap();
    let xml = j.numberings[0]
        .raw_para_heads
        .as_ref()
        .expect("binary extension was not parsed");
    assert_eq!(xml.matches("<hh:paraHead ").count(), 10);
    assert!(xml.contains("HANGUL_SYLLABLE"));
    assert!(xml.contains("^8 &amp; 한"));
    assert!(xml.contains("level=\"10\""));
    let info2 = info(xml).0;
    assert_eq!(
        serde_json::to_value(&info2.numberings[0].heads).unwrap(),
        serde_json::to_value(&i.numberings[0].heads).unwrap()
    );
    assert_eq!(
        info2.numberings[0].level_start_numbers,
        i.numberings[0].level_start_numbers
    );
    let mut rebuilt = j.clone();
    rebuilt.raw_stream_dirty = true;
    assert_eq!(
        number_data(&serialize_doc_info(&rebuilt, &q)),
        number_data(&bytes),
        "unknown lexical differences must not alter actual native record"
    );
}
#[test]
fn hwp_to_hwpx_reopen_preserves_real_extension_and_raw_hwp_source() {
    let d = doc(&raw_xml(false));
    let out = serialize_hwp_with_report(&d).unwrap();
    assert!(
        out.content_loss().is_empty(),
        "{}",
        out.content_loss().to_json()
    );
    let parsed = rhwp::parser::parse_hwp(out.bytes()).unwrap();
    let raw = parsed.doc_info.numberings[0]
        .raw_data
        .as_ref()
        .unwrap()
        .clone();
    let second = serialize_hwp_with_report(&parsed).unwrap();
    assert!(second.content_loss().is_empty());
    let p2 = rhwp::parser::parse_hwp(second.bytes()).unwrap();
    assert_eq!(p2.doc_info.numberings[0].raw_data.as_ref().unwrap(), &raw);
    let x = rhwp::serializer::hwpx::serialize_hwpx_with_report(&parsed).unwrap();
    assert!(x.content_loss().is_empty());
    let p3 = rhwp::parser::hwpx::parse_hwpx(x.bytes()).unwrap();
    let stored = p3.doc_info.numberings[0].raw_para_heads.as_ref().unwrap();
    assert!(stored.contains("level=\"8\""));
    assert!(stored.contains("HANGUL_SYLLABLE"));
    assert!(stored.contains("^10 &amp; 한"));
}
#[test]
fn unsupported_checkbox_cannot_report_zero_loss() {
    let d = doc(&raw_xml(true).replace("CIRCLED_HANGUL_SYLLABLE", "DIGIT"));
    let a = serialize_hwp_with_report(&d).unwrap();
    assert!(a
        .content_loss()
        .losses()
        .iter()
        .any(|l| l.path == "docInfo/numbering/0/extendedLevels8To10"));
}
#[test]
fn duplicate_partial_and_unknown_extension_report_loss() {
    let raw = raw_xml(false);
    for bad in [
        raw.replace("level=\"10\"", "level=\"9\""),
        raw.replace("level=\"10\"", "level=\"11\""),
        raw.replace("level=\"8\"", "mystery=\"1\" level=\"8\""),
        raw.replace("HANGUL_SYLLABLE", "UNKNOWN_EXTENSION_FORMAT"),
        raw.replace("^8 &amp; 한", "^8 &#xFFFF;"),
        raw.replace("^8 &amp; 한", "^8 &undefined;"),
    ] {
        let a = serialize_hwp_with_report(&doc(&bad)).unwrap();
        assert!(a
            .content_loss()
            .losses()
            .iter()
            .any(|l| l.path.ends_with("extendedLevels8To10")));
    }
}
#[test]
fn seven_level_agent_boundary_remains_closed() {
    let a = serialize_hwp_with_report(&doc(&raw_xml(false))).unwrap();
    let core = DocumentCore::from_bytes(a.bytes()).unwrap();
    let defs: serde_json::Value =
        serde_json::from_str(&core.get_agent_numbering_definitions_native()).unwrap();
    assert_eq!(defs[0]["editable"], false);
}
#[test]
fn public_python3_extension_is_emitted_and_unsupported_checkable_is_honest() {
    let root = std::path::PathBuf::from(std::env::var("JUEONY_REPO").unwrap());
    let input = root.join("build/hancom-final-file-review-20261017/source-python-hwpx-3.hwpx");
    let d = rhwp::parser::hwpx::parse_hwpx(&std::fs::read(input).unwrap()).unwrap();
    let bytes = serialize_doc_info(&d.doc_info, &d.doc_properties);
    let (p, _) = parse_doc_info(&bytes).unwrap();
    assert!(p.numberings[1]
        .raw_para_heads
        .as_ref()
        .unwrap()
        .contains("^8"));
    let artifact = serialize_hwp_with_report(&d).unwrap();
    assert!(
        artifact.content_loss().is_empty(),
        "{}",
        artifact.content_loss().to_json()
    );
    let out =
        root.join("build/file-closure69-public/numbering-canonical-candidate71/native-public");
    std::fs::create_dir_all(&out).unwrap();
    std::fs::write(out.join("python3-numbering-DocInfo.bin"), bytes).unwrap();
    std::fs::write(
        out.join("python3-loss.json"),
        artifact.content_loss().to_json(),
    )
    .unwrap();
    std::fs::write(
        out.join("python3-hwp-uncommitted-loss-reported.hwp"),
        artifact.bytes(),
    )
    .unwrap();
}

#[test]
fn older_target_version_reports_unrepresentable_extension() {
    let mut d = doc(&raw_xml(false));
    d.header.version = HwpVersion {
        major: 5,
        minor: 0,
        build: 3,
        revision: 3,
    };
    let a = serialize_hwp_with_report(&d).unwrap();
    assert!(a
        .content_loss()
        .losses()
        .iter()
        .any(|l| l.path == "docInfo/numbering/0/extendedLevels8To10"
            && l.reason
                == rhwp::serializer::content_loss::ContentLossReason::UnsupportedByOutputFormat));
}
#[test]
fn actual_direct_hancom_binary_keeps_extensions_without_private_contracts() {
    let root = std::path::PathBuf::from(std::env::var("JUEONY_REPO").unwrap());
    let bytes =
        std::fs::read(root.join("build/file-closure69-public/hancom-direct/python3-direct.hwp"))
            .unwrap();
    let d = rhwp::parser::parse_hwp(&bytes).unwrap();
    assert!(
        !d.extra_streams
            .iter()
            .any(|(p, _)| p.to_ascii_lowercase().contains("rhwp")),
        "Direct Hancom oracle must not have engine-only streams"
    );
    let n = &d.doc_info.numberings[1];
    let view = n
        .raw_para_heads
        .as_ref()
        .expect("Actual native extension not parsed");
    assert!(view.contains("^8"));
    assert!(view.contains("CIRCLED_HANGUL_SYLLABLE"));
    assert!(view.contains("textOffset=\"50\""));
    let old = n.raw_data.clone();
    let hwpx = rhwp::serializer::hwpx::serialize_hwpx_with_report(&d).unwrap();
    assert!(
        hwpx.content_loss().is_empty(),
        "{}",
        hwpx.content_loss().to_json()
    );
    let p = rhwp::parser::hwpx::parse_hwpx(hwpx.bytes()).unwrap();
    let raw = serialize_doc_info(&p.doc_info, &p.doc_properties);
    let new = parse_doc_info(&raw).unwrap().0.numberings[1]
        .raw_data
        .clone();
    assert_eq!(new,old,"Entire native NUMBERING record must survive HWP→HWPX→DocInfo, including first7, exact8..10 and starts");
}
#[test]
fn xml_bounds_controls_and_duplicate_attributes_report_loss() {
    let raw = raw_xml(false);
    let cases = [
        raw.replace("widthAdjust=\"-25\"", "widthAdjust=\"-32769\""),
        raw.replace("start=\"11\"", "start=\"4294967296\""),
        raw.replace(
            "charPrIDRef=\"0\" checkable=\"0\">^8",
            "charPrIDRef=\"4294967296\" checkable=\"0\">^8",
        ),
        raw.replace("level=\"8\"", "level=\"8\" level=\"8\""),
        raw.replace("^8 &amp; 한", "^8 &#0;"),
        raw.replace("^8 &amp; 한", "^8 \u{1}"),
        raw.replace("^8 &amp; 한", &"a".repeat(65536)),
        raw.replace("^8 &amp; 한", &"a".repeat(512 * 1024)),
    ];
    for (index, bad) in cases.iter().enumerate() {
        let output = serialize_hwp_with_report(&doc(bad)).unwrap();
        assert!(
            output
                .content_loss()
                .losses()
                .iter()
                .any(|loss| loss.path.ends_with("extendedLevels8To10")),
            "Boundary case {index} incorrectly reported no loss"
        );
    }
}

#[test]
fn unknown_or_truncated_native_tail_cannot_silently_export_hwpx() {
    let mut baseline = doc(&raw_xml(false));
    let source = serialize_doc_info(&baseline.doc_info, &baseline.doc_properties);
    let raw = number_data(&source);
    let mut position = 0;
    for _ in 0..7 {
        position += 12;
        let units = u16::from_le_bytes(raw[position..position + 2].try_into().unwrap()) as usize;
        position += 2 + 2 * units;
    }
    position += 30;
    let mut unknown = raw.clone();
    let attr = u32::from_le_bytes(unknown[position..position + 4].try_into().unwrap()) | 0x200;
    unknown[position..position + 4].copy_from_slice(&attr.to_le_bytes());
    let mut truncated = raw.clone();
    truncated.pop();
    let mut unexplained = raw.clone();
    unexplained.push(0);
    for bytes in [unknown, truncated, unexplained] {
        baseline.doc_info.numberings[0].raw_para_heads = None;
        baseline.doc_info.numberings[0].raw_data = Some(bytes);
        let output = rhwp::serializer::hwpx::serialize_hwpx_with_report(&baseline).unwrap();
        assert!(output
            .content_loss()
            .losses()
            .iter()
            .any(|loss| loss.path.ends_with("extendedLevels8To10")));
    }
}

#[test]
fn zero_checkable_circled_normalization_reports_loss_both_directions() {
    let raw = raw_xml(false).replace(
        "numFormat=\"HANGUL_SYLLABLE\"",
        "numFormat=\"CIRCLED_HANGUL_SYLLABLE\"",
    );
    let output = serialize_hwp_with_report(&doc(&raw)).unwrap();
    assert!(
        output
            .content_loss()
            .losses()
            .iter()
            .any(|loss| loss.path.ends_with("extendedLevels8To10")),
        "The actual external0→1 normalization must not report loss0"
    );
    let native = rhwp::parser::parse_hwp(output.bytes()).unwrap();
    let reverse = rhwp::serializer::hwpx::serialize_hwpx_with_report(&native).unwrap();
    assert!(
        reverse.content_loss().is_empty(),
        "{}",
        reverse.content_loss().to_json()
    );
    let parsed = rhwp::parser::hwpx::parse_hwpx(reverse.bytes()).unwrap();
    assert!(parsed.doc_info.numberings[0]
        .raw_para_heads
        .as_ref()
        .unwrap()
        .contains("numFormat=\"CIRCLED_HANGUL_SYLLABLE\" charPrIDRef=\"0\" checkable=\"1\""));
}

#[test]
fn observed_circled_formats_preserve_canonical1_but_reject_explicit0() {
    for name in ["CIRCLED_DIGIT", "CIRCLED_HANGUL_SYLLABLE"] {
        let canonical = raw_xml(true).replace("CIRCLED_HANGUL_SYLLABLE", name);
        let output = serialize_hwp_with_report(&doc(&canonical)).unwrap();
        assert!(
            output.content_loss().is_empty(),
            "{name}:{}",
            output.content_loss().to_json()
        );
        let native = rhwp::parser::parse_hwp(output.bytes()).unwrap();
        let reverse = rhwp::serializer::hwpx::serialize_hwpx_with_report(&native).unwrap();
        assert!(reverse.content_loss().is_empty());
        let decoded = rhwp::parser::hwpx::parse_hwpx(reverse.bytes()).unwrap();
        let view = decoded.doc_info.numberings[0]
            .raw_para_heads
            .as_ref()
            .unwrap();
        assert!(view.contains(&format!(
            "numFormat=\"{name}\" charPrIDRef=\"0\" checkable=\"1\""
        )));
        let explicit0 = raw_xml(false).replace("HANGUL_SYLLABLE", name);
        assert!(
            !serialize_hwp_with_report(&doc(&explicit0))
                .unwrap()
                .content_loss()
                .is_empty(),
            "Actual0→1 loss must remain {name}"
        );
    }
}
#[test]
fn every_observed_format_keeps_canonical_values_and_reports_explicit_mismatch() {
    let names = [
        "DIGIT",
        "CIRCLED_DIGIT",
        "ROMAN_CAPITAL",
        "ROMAN_SMALL",
        "LATIN_CAPITAL",
        "LATIN_SMALL",
        "CIRCLED_LATIN_CAPITAL",
        "CIRCLED_LATIN_SMALL",
        "HANGUL_SYLLABLE",
        "CIRCLED_HANGUL_SYLLABLE",
        "HANGUL_JAMO",
        "CIRCLED_HANGUL_JAMO",
        "HANGUL_PHONETIC",
        "IDEOGRAPH",
        "CIRCLED_IDEOGRAPH",
    ];
    for (code, name) in names.iter().enumerate() {
        let raw = raw_xml(false).replace("HANGUL_SYLLABLE", name);
        let expected = code % 2;
        let canonical = if expected == 1 {
            raw.replace(
                &format!("numFormat=\"{name}\" charPrIDRef=\"0\" checkable=\"0\""),
                &format!("numFormat=\"{name}\" charPrIDRef=\"0\" checkable=\"1\""),
            )
        } else {
            raw
        };
        let output = serialize_hwp_with_report(&doc(&canonical)).unwrap();
        assert!(
            output.content_loss().is_empty(),
            "{name}:{}",
            output.content_loss().to_json()
        );
        let native = rhwp::parser::parse_hwp(output.bytes()).unwrap();
        assert!(rhwp::serializer::hwpx::serialize_hwpx_with_report(&native)
            .unwrap()
            .content_loss()
            .is_empty());
        let mismatch = canonical.replace(
            &format!("numFormat=\"{name}\" charPrIDRef=\"0\" checkable=\"{expected}\""),
            &format!(
                "numFormat=\"{name}\" charPrIDRef=\"0\" checkable=\"{}\"",
                1 - expected
            ),
        );
        assert!(
            !serialize_hwp_with_report(&doc(&mismatch))
                .unwrap()
                .content_loss()
                .is_empty(),
            "Explicit mismatch must remain reported:{name}"
        );
    }
}
#[test]
fn default_native_numbering_does_not_block_real_body_and_textbox_repeated_saves() {
    let mut core = DocumentCore::new_empty();
    core.create_blank_document_native().unwrap();
    core.insert_text_native(0, 0, 0, "기본 번호와 본문 보존")
        .unwrap();
    let response: serde_json::Value = serde_json::from_str(
        &core
            .create_shape_control_native(
                0,
                0,
                0,
                18000,
                10000,
                20000,
                24000,
                false,
                "Square",
                "textbox",
                false,
                false,
                &[],
            )
            .unwrap(),
    )
    .unwrap();
    let ci = response["controlIdx"].as_u64().unwrap() as usize;
    core.insert_text_in_cell_native(0, 0, ci, 0, 0, 0, "기본 글상자 보존")
        .unwrap();
    let layout = |d: &DocumentCore| {
        (0..d.page_count())
            .map(|i| {
                (
                    d.get_page_control_layout_native(i).unwrap(),
                    d.get_page_text_layout_native(i).unwrap(),
                )
            })
            .collect::<Vec<_>>()
    };
    let live = layout(&core);
    for _ in 0..3 {
        let native = core.export_hwp_with_adapter_snapshot_with_report().unwrap();
        assert!(
            native.content_loss().is_empty(),
            "{}",
            native.content_loss().to_json()
        );
        assert_eq!(
            layout(&core),
            live,
            "Export must not mutate live control/text/paragraph evidence"
        );
        let reopened = DocumentCore::from_bytes(native.bytes()).unwrap();
        let xml = reopened.export_hwpx_native_with_report().unwrap();
        assert!(
            xml.content_loss().is_empty(),
            "{}",
            xml.content_loss().to_json()
        );
        let x = DocumentCore::from_bytes(xml.bytes()).unwrap();
        let second = x.export_hwp_with_adapter_snapshot_with_report().unwrap();
        assert!(
            second.content_loss().is_empty(),
            "{}",
            second.content_loss().to_json()
        );
        assert_eq!(
            core.document().sections[0].paragraphs[0].text,
            reopened.document().sections[0].paragraphs[0].text
        );
    }
}

#[test]
fn actual_matrix30_disk_oracle_controls_all_native_canonical_values_and_mismatches() {
    let root = std::path::PathBuf::from(std::env::var("JUEONY_REPO").unwrap());
    let oracle: serde_json::Value = serde_json::from_slice(
        &std::fs::read(
            root.join("build/file-closure69-public/hancom-direct/matrix30-complete-observed.json"),
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(oracle["status"], "ACTUAL_MATRIX30_COMPLETE");
    let native =
        std::fs::read(root.join(oracle["nativeFile"].as_str().unwrap().replace('\\', "/")))
            .unwrap();
    let doc = rhwp::parser::parse_hwp(&native).unwrap();
    let mut mismatch = vec![];
    for case in oracle["cases"].as_array().unwrap() {
        let token = case["input"]["nativeIdentityToken"].as_str().unwrap();
        let expected = case["reverse"]["checkable"].as_str().unwrap();
        let view = doc
            .doc_info
            .numberings
            .iter()
            .filter_map(|n| n.raw_para_heads.as_ref())
            .find(|v| v.contains(token))
            .unwrap();
        let row = view
            .split("level=\"8\"")
            .nth(1)
            .unwrap()
            .split("</hh:paraHead>")
            .next()
            .unwrap();
        if !row.contains(&format!("checkable=\"{expected}\"")) {
            mismatch.push(serde_json::json!({"code":case["input"]["code"],"inputCheckable":case["input"]["level8Checkable"],"expected":expected}));
        }
    }
    assert!(
        mismatch.is_empty(),
        "Native canonical values differ from actual Hancom disk oracle:{mismatch:?}"
    );
    let xml = rhwp::serializer::hwpx::serialize_hwpx_with_report(&doc).unwrap();
    assert!(
        xml.content_loss().is_empty(),
        "{}",
        xml.content_loss().to_json()
    );
    let source = std::fs::read(root.join(
        "build/file-closure69-public/hancom-direct/numbering-format-checkable-matrix30-used.hwpx",
    ))
    .unwrap();
    let input = rhwp::parser::hwpx::parse_hwpx(&source).unwrap();
    let output = serialize_hwp_with_report(&input).unwrap();
    let loss_paths: std::collections::BTreeSet<_> = output.content_loss().losses().iter()
        .filter(|loss| loss.path.ends_with("extendedLevels8To10"))
        .map(|loss| loss.path.clone()).collect();
    let expected_controlled: std::collections::BTreeSet<_> = oracle["cases"].as_array().unwrap().iter()
        .filter(|case| case["input"]["level8Checkable"].as_u64().unwrap().to_string()
            != case["reverse"]["checkable"].as_str().unwrap())
        .map(|case| format!("docInfo/numbering/{}/extendedLevels8To10",case["input"]["id"].as_u64().unwrap()-1))
        .collect();
    assert_eq!(expected_controlled.len(),15);
    let controlled_actual: std::collections::BTreeSet<_> = loss_paths.iter()
        .filter(|path| path.as_str() != "docInfo/numbering/0/extendedLevels8To10").cloned().collect();
    assert_eq!(controlled_actual,expected_controlled,"All15 controlled explicit mismatches must remain real loss");
    // The immutable old70 blank-document base is not one of the30 controlled
    // definitions. Its old producer emitted CIRCLED_DIGIT/checkable0 at8..10.
    // Independently retain this genuine extra loss; never relabel it success.
    let base=input.doc_info.numberings[0].raw_para_heads.as_ref().unwrap();
    for level in 8..=10 {
        let row=base.split(&format!("level=\"{level}\"")).nth(1).unwrap().split("</hh:paraHead>").next().unwrap();
        assert!(row.contains("numFormat=\"CIRCLED_DIGIT\""));
        assert!(row.contains("checkable=\"0\""));
    }
    assert!(loss_paths.contains("docInfo/numbering/0/extendedLevels8To10"));
    assert_eq!(loss_paths.len(),16);

}

#[test]
fn all_public_python_sources_preserve_reported_exports_live_state_and_reopen_geometry() {
    let root = std::path::PathBuf::from(std::env::var("JUEONY_REPO").unwrap());
    let records: serde_json::Value = serde_json::from_slice(
        &std::fs::read(root.join(".tools/public-documents/manifest.json")).unwrap(),
    )
    .unwrap();
    let snapshot = |d: &DocumentCore| {
        serde_json::Value::Array((0..d.page_count()).map(|page|serde_json::json!({"page":page,"controls":serde_json::from_str::<serde_json::Value>(&d.get_page_control_layout_native(page).unwrap()).unwrap(),"text":serde_json::from_str::<serde_json::Value>(&d.get_page_text_layout_native(page).unwrap()).unwrap()})).collect())
    };
    fn diff(a: &serde_json::Value, b: &serde_json::Value) -> usize {
        match (a, b) {
            (serde_json::Value::Number(a), serde_json::Value::Number(b)) => {
                usize::from((a.as_f64().unwrap() - b.as_f64().unwrap()).abs() > 0.2)
            }
            (serde_json::Value::Array(a), serde_json::Value::Array(b)) => {
                usize::from(a.len() != b.len())
                    + (0..a.len().max(b.len()))
                        .map(|i| match (a.get(i), b.get(i)) {
                            (Some(a), Some(b)) => diff(a, b),
                            _ => 1,
                        })
                        .sum::<usize>()
            }
            (serde_json::Value::Object(a), serde_json::Value::Object(b)) => {
                let keys: std::collections::BTreeSet<_> = a.keys().chain(b.keys()).collect();
                keys.into_iter()
                    .map(|k| match (a.get(k), b.get(k)) {
                        (Some(a), Some(b)) => diff(a, b),
                        _ => 1,
                    })
                    .sum()
            }
            _ => usize::from(a != b),
        }
    }
    let mut tested = 0;
    for record in records.as_array().unwrap() {
        let id = record["id"].as_str().unwrap();
        if !id.starts_with("python-hwpx-") {
            continue;
        }
        let bytes = std::fs::read(
            root.join(".tools/public-documents")
                .join(record["file"].as_str().unwrap()),
        )
        .unwrap();
        let core = DocumentCore::from_bytes(&bytes).unwrap();
        let before = snapshot(&core);
        for format in ["hwp", "hwpx"] {
            let artifact = if format == "hwp" {
                core.export_hwp_with_adapter_snapshot_with_report().unwrap()
            } else {
                core.export_hwpx_native_with_report().unwrap()
            };
            assert!(
                artifact.content_loss().is_empty(),
                "{id} {format}:{}",
                artifact.content_loss().to_json()
            );
            assert_eq!(
                snapshot(&core),
                before,
                "Live state changed during export:{id} {format}"
            );
            let reopened = DocumentCore::from_bytes(artifact.bytes()).unwrap();
            let changes = diff(&before, &snapshot(&reopened));
            assert_eq!(
                changes, 0,
                "All published control/text/para fields with unchanged0.2 tolerance:{id} {format}"
            );
            tested += 1;
        }
    }
    assert_eq!(tested, 8);
}

#[test]
fn new_numbering_producer_uses_observed_canonical_without_rewriting_original_xml() {
    let mut core=DocumentCore::new_empty();
    core.create_blank_document_native().unwrap();
    let mut native=rhwp::parser::parse_hwp(&core.export_hwp_native().unwrap()).unwrap();
    for n in &mut native.doc_info.numberings {
        n.raw_para_heads=None;
    }
    assert!(!native.doc_info.numberings.is_empty());
    let xml=rhwp::serializer::hwpx::serialize_hwpx_with_report(&native).unwrap();
    assert!(xml.content_loss().is_empty(),"{}",xml.content_loss().to_json());
    let parsed=rhwp::parser::hwpx::parse_hwpx(xml.bytes()).unwrap();
    for (generated,original) in parsed.doc_info.numberings.iter().zip(&native.doc_info.numberings) {
        let raw=generated.raw_para_heads.as_ref().unwrap();
        for level in 1..=10usize {
            let row=raw.split(&format!("level=\"{level}\"")).nth(1).unwrap().split("</hh:paraHead>").next().unwrap();
            let checked=original.heads[(level-1).min(6)].number_format%2;
            assert!(row.contains(&format!("checkable=\"{checked}\"")),"new producer level{level}:{row}");
        }
    }
    let roundtrip=serialize_hwp_with_report(&parsed).unwrap();
    assert!(roundtrip.content_loss().is_empty(),"{}",roundtrip.content_loss().to_json());
    // Explicit incompatible source XML is a separate preservation contract.
    let raw=raw_xml(true).replace("CIRCLED_HANGUL_SYLLABLE","CIRCLED_DIGIT").replace("checkable=\"1\"","checkable=\"0\"");
    let explicit=doc(&raw);
    let emitted=rhwp::serializer::hwpx::serialize_hwpx_with_report(&explicit).unwrap();
    let original=rhwp::parser::hwpx::parse_hwpx(emitted.bytes()).unwrap();
    assert_eq!(original.doc_info.numberings[0].raw_para_heads.as_deref(),Some(raw.as_str()));
    assert!(!serialize_hwp_with_report(&explicit).unwrap().content_loss().is_empty());
}
