use rhwp::DocumentCore;
use serde_json::{json, Value};
fn root() -> std::path::PathBuf {
    std::path::PathBuf::from(std::env::var("JUEONY_REPO").unwrap())
}
fn layout(d: &DocumentCore) -> Value {
    json!((0..d.page_count()).map(|p|json!({"controls":serde_json::from_str::<Value>(&d.get_page_control_layout_native(p).unwrap()).unwrap(),"text":serde_json::from_str::<Value>(&d.get_page_text_layout_native(p).unwrap()).unwrap()})).collect::<Vec<_>>())
}
fn changes(a: &Value, b: &Value, path: &str, out: &mut Vec<Value>) {
    match (a, b) {
        (Value::Number(a), Value::Number(b)) => {
            if (a.as_f64().unwrap() - b.as_f64().unwrap()).abs() > 0.2 {
                out.push(json!({"path":path,"before":a,"after":b}));
            }
        }
        (Value::Array(a), Value::Array(b)) => {
            if a.len() != b.len() {
                out.push(json!({"path":path,"beforeLength":a.len(),"afterLength":b.len()}));
            }
            for (i, (a, b)) in a.iter().zip(b).enumerate() {
                changes(a, b, &format!("{path}/{i}"), out);
            }
        }
        (Value::Object(a), Value::Object(b)) => {
            if a.keys().collect::<Vec<_>>() != b.keys().collect::<Vec<_>>() {
                out.push(json!({"path":path,"keysChanged":true}));
            }
            for (k, a) in a {
                changes(a, &b[k], &format!("{path}/{k}"), out);
            }
        }
        _ => {
            if a != b {
                out.push(json!({"path":path,"before":a,"after":b}));
            }
        }
    }
}
fn same(a: &Value, b: &Value) {
    let mut out = vec![];
    changes(a, b, "", &mut out);
    assert!(out.is_empty(), "{}", serde_json::to_string(&out).unwrap());
}
#[test]
fn actual_column2_full_geometry() {
    let folder = root().join("build/file-closure69-overlap");
    let a = DocumentCore::from_bytes(&std::fs::read(folder.join("support/column2.hwp")).unwrap())
        .unwrap();
    let b = DocumentCore::from_bytes(
        &std::fs::read(folder.join("hancom-current/column2.hwp")).unwrap(),
    )
    .unwrap();
    same(&layout(&a), &layout(&b));
}
#[test]
fn both_sources_both_formats_twice() {
    let folder = root().join("build/file-closure69-overlap");
    let oracle = DocumentCore::from_bytes(
        &std::fs::read(folder.join("hancom-current/column2.hwp")).unwrap(),
    )
    .unwrap();
    let expected = layout(&oracle);
    for name in ["support/column2.hwp", "hancom-current/column2.hwp"] {
        let source = std::fs::read(folder.join(name)).unwrap();
        for format in ["hwp", "hwpx"] {
            let mut d = DocumentCore::from_bytes(&source).unwrap();
            same(&layout(&d), &expected);
            for round in 0..2 {
                let bytes = if format == "hwp" {
                    let a = d.export_hwp_with_adapter_snapshot_with_report().unwrap();
                    assert!(
                        a.content_loss().is_empty(),
                        "{}",
                        a.content_loss().to_json()
                    );
                    a.bytes().to_vec()
                } else {
                    let a = d.export_hwpx_native_with_report().unwrap();
                    assert!(
                        a.content_loss().is_empty(),
                        "{}",
                        a.content_loss().to_json()
                    );
                    a.bytes().to_vec()
                };
                let r = DocumentCore::from_bytes(&bytes).unwrap();
                let mut diff = vec![];
                changes(&expected, &layout(&r), "", &mut diff);
                let output = root().join(format!(
                    "build/file-closure69-public/column2-candidate74/{}-{format}-{round}.json",
                    name.replace('/', "-")
                ));
                std::fs::write(output,serde_json::to_vec_pretty(&json!({"name":name,"format":format,"round":round,"differences":diff,"layout":layout(&r)})).unwrap()).unwrap();
                assert!(
                    diff.is_empty(),
                    "{name} {format} round{round}:{}",
                    serde_json::to_string(&diff).unwrap()
                );
                d = r;
            }
        }
    }
}

#[test]
fn first_model_contract_probe() {
    let bytes =
        std::fs::read(root().join("build/file-closure69-overlap/support/column2.hwp")).unwrap();
    let d = DocumentCore::from_bytes(&bytes).unwrap();
    std::fs::write(
        root().join("build/file-closure69-public/column2-candidate74/first-model.json"),
        serde_json::to_vec_pretty(&d.document().sections[0].paragraphs[0]).unwrap(),
    )
    .unwrap();
}

fn column_history(name: &str) {
    let source = std::fs::read(root().join("build/file-closure69-overlap").join(name)).unwrap();
    let mut d = DocumentCore::from_bytes(&source).unwrap();
    let before = layout(&d);
    let undo = d.save_snapshot_native();
    let tail = d.document().sections[0].paragraphs.len() - 1;
    d.insert_text_native(0, tail, 0, "HISTORY").unwrap();
    let edited = layout(&d);
    std::fs::write(
        root().join(format!(
            "build/file-closure69-public/column2-candidate74/history-model-{}.json",
            name.replace('/', "-")
        )),
        serde_json::to_vec_pretty(&d.document().sections[0].paragraphs).unwrap(),
    )
    .unwrap();
    same(&before[0]["controls"], &edited[0]["controls"]);
    let redo = d.save_snapshot_native();
    d.restore_snapshot_native(undo).unwrap();
    same(&before, &layout(&d));
    d.restore_snapshot_native(redo).unwrap();
    same(&edited, &layout(&d));
    for format in ["hwp", "hwpx"] {
        let mut current = DocumentCore::from_bytes(&source).unwrap();
        current.insert_text_native(0, tail, 0, "HISTORY").unwrap();
        for _ in 0..2 {
            let a = if format == "hwp" {
                current
                    .export_hwp_with_adapter_snapshot_with_report()
                    .unwrap()
            } else {
                current.export_hwpx_native_with_report().unwrap()
            };
            assert!(
                a.content_loss().is_empty(),
                "{}",
                a.content_loss().to_json()
            );
            current = DocumentCore::from_bytes(a.bytes()).unwrap();
            same(&edited, &layout(&current));
        }
    }
}
#[test]
fn original_api_history() {
    column_history("support/column2.hwp");
}
#[test]
fn hancom_api_history() {
    column_history("hancom-current/column2.hwp");
}
#[test]
fn existing_actual_nine_pairs_remain_exact() {
    let frozen: Value = serde_json::from_slice(
        &std::fs::read(root().join("build/file-closure69-overlap/independent-oracle68.json"))
            .unwrap(),
    )
    .unwrap();
    let mut checked = 0;
    for item in frozen["observations"].as_array().unwrap() {
        let name = item["name"].as_str().unwrap();
        if ["column2.hwp", "negative.hwp"].contains(&name) {
            continue;
        }
        let relative = item["original"]["path"]
            .as_str()
            .unwrap()
            .split("/build/")
            .nth(1)
            .unwrap();
        let bytes = std::fs::read(root().join("build").join(relative)).unwrap();
        let d = DocumentCore::from_bytes(&bytes).unwrap();
        let expected = Value::Array(
            item["afterLayout"]
                .as_array()
                .unwrap()
                .iter()
                .map(|p| json!({"controls":{"controls":p["controls"]},"text":{"runs":p["runs"]}}))
                .collect(),
        );
        same(&expected, &layout(&d));
        checked += 1;
    }
    assert_eq!(checked, 9);
}
fn table(d: &mut rhwp::model::document::Document, p: usize) -> &mut rhwp::model::table::Table {
    let rhwp::model::control::Control::Table(t) = &mut d.sections[0].paragraphs[p].controls[0]
    else {
        panic!()
    };
    t
}
fn negative(name: &str) {
    use rhwp::model::{
        control::{Control, Field, UnknownControl},
        page::{ColumnDirection, ColumnType},
        paragraph::ColumnBreakType,
        shape::{Caption, SizeCriterion, VertRelTo},
        table::{TablePageBreak, TableZone},
    };
    let bytes =
        std::fs::read(root().join("build/file-closure69-overlap/support/column2.hwp")).unwrap();
    let core = DocumentCore::from_bytes(&bytes).unwrap();
    let mut doc = core.document().clone();
    match name {
        "many_following_lines" => {
            let p = doc.sections[0].paragraphs[3].clone();
            for _ in 0..60 {
                doc.sections[0].paragraphs.push(p.clone());
            }
        }
        "single_column" | "three_columns" | "rtl" | "distribute" | "unequal_columns" => {
            for c in &mut doc.sections[0].paragraphs[0].controls {
                if let Control::ColumnDef(c) = c {
                    match name {
                        "single_column" => c.column_count = 1,
                        "three_columns" => c.column_count = 3,
                        "rtl" => c.direction = ColumnDirection::RightToLeft,
                        "distribute" => c.column_type = ColumnType::Distribute,
                        _ => c.same_width = false,
                    }
                }
            }
        }
        "protected" => table(&mut doc, 2).cells[0].set_cell_protect(true),
        "locked" => table(&mut doc, 2).common.locked = true,
        "size_protected" => table(&mut doc, 2).common.size_protect = true,
        "cellfield" => table(&mut doc, 2).cells[0].field_name = Some("owner".into()),
        "field" => doc.sections[0].paragraphs[3]
            .controls
            .push(Control::Field(Field::default())),
        "unknown" => doc.sections[0].paragraphs[2]
            .controls
            .push(Control::Unknown(UnknownControl {
                ctrl_id: 0x11223344,
            })),
        "rowbreak" => table(&mut doc, 2).page_break = TablePageBreak::RowBreak,
        "caption" => table(&mut doc, 2).caption = Some(Caption::default()),
        "zones" => table(&mut doc, 2).zones.push(TableZone::default()),
        "rowspan" => table(&mut doc, 2).cells[0].row_span = 2,
        "colspan" => table(&mut doc, 2).cells[0].col_span = 2,
        "width1" => table(&mut doc, 2).common.width += 1,
        "height1" => table(&mut doc, 2).common.height += 75,
        "positive_offset" => table(&mut doc, 2).common.vertical_offset = 75,
        "negative_offset" => table(&mut doc, 2).common.vertical_offset = (-75i32) as u32,
        "absolute" => table(&mut doc, 2).common.vert_rel_to = VertRelTo::Paper,
        "width_relative" => table(&mut doc, 2).common.width_criterion = SizeCriterion::Para,
        "host_text" => doc.sections[0].paragraphs[2].text = "HOST".into(),
        "mixed_authentic_cache" => doc.sections[0].paragraphs[1].line_segs[0].tag &= !0x80000000,
        "positive_cached_origin" => doc.sections[0].paragraphs[2].line_segs[0].vertical_pos = 100,
        "column_reset" => doc.sections[0].paragraphs[2].column_type = ColumnBreakType::Column,
        "section_reset" => doc.sections[0].paragraphs[2].column_type = ColumnBreakType::Section,
        "asymmetric_margin" => table(&mut doc, 2).outer_margin_top += 1,
        "common_unknown" => table(&mut doc, 2).common.raw_extra.push(0x77),
        _ => panic!("unknown {name}"),
    }
    // These six old low-level mutations left raw_attr/common-margin caches
    // unchanged. Their old failing evidence remains immutable. Build a valid
    // serialized negative using the same dual-write obligations as edit APIs.
    let valid_serialized = ["single_column","three_columns","rtl","distribute","unequal_columns","asymmetric_margin"].contains(&name);
    if valid_serialized {
        doc.sections[0].raw_stream = None;
        if name=="asymmetric_margin" {
            let t=table(&mut doc,2);
            t.common.margin.top=t.outer_margin_top;
            t.raw_ctrl_data[28..30].copy_from_slice(&t.outer_margin_top.to_le_bytes());
        } else {
            for c in &mut doc.sections[0].paragraphs[0].controls {
                if let Control::ColumnDef(c)=c {
                    c.raw_attr=0;
                    if name=="unequal_columns" {
                        c.widths=vec![12000,20768];c.gaps=vec![1000];c.proportional_widths=true;
                    }
                }
            }
        }
    }
    let mut d = DocumentCore::from_bytes(&bytes).unwrap();
    d.set_document(doc);
    if valid_serialized {
        let artifact=d.export_hwp_with_adapter_snapshot_with_report().unwrap();
        assert!(artifact.content_loss().is_empty(),"valid negative source has loss: {}",artifact.content_loss().to_json());
        let disk=artifact.bytes().to_vec();
        let proof_dir=root().join("build/file-closure69-public/column2-candidate74/valid-negative-disk");
        std::fs::create_dir_all(&proof_dir).unwrap();
        let mode=env!("JUEONY_COLUMN_MODE");
        std::fs::write(proof_dir.join(format!("{mode}-{name}.hwp")),&disk).unwrap();
        let loaded=DocumentCore::from_bytes(&disk).unwrap();
        if name=="asymmetric_margin" {
            let Control::Table(t)=&loaded.document().sections[0].paragraphs[2].controls[0] else {panic!()};
            assert_eq!(t.outer_margin_top,t.outer_margin_left+1);
        } else {
            let c=loaded.document().sections[0].paragraphs[0].controls.iter().find_map(|c| if let Control::ColumnDef(c)=c {Some(c)} else {None}).unwrap();
            match name {
                "single_column"=>assert_eq!(c.column_count,1),
                "three_columns"=>assert_eq!(c.column_count,3),
                "rtl"=>assert_eq!(c.direction,ColumnDirection::RightToLeft),
                "distribute"=>assert_eq!(c.column_type,ColumnType::Distribute),
                "unequal_columns"=>{assert!(!c.same_width);assert_eq!(c.widths,vec![12000,20768]);},
                _=>unreachable!(),
            }
        }
        d=loaded;
    }
    let ir = serde_json::to_value(
        d.document()
            .sections
            .iter()
            .map(|s| &s.paragraphs)
            .collect::<Vec<_>>(),
    )
    .unwrap();
    let live = layout(&d);
    let hwp = d.export_hwp_with_adapter_snapshot_with_report().unwrap();
    let hwpx = d.export_hwpx_native_with_report().unwrap();
    let result = json!({"name":name,"live":live,"ir":ir,"hwpLoss":serde_json::from_str::<Value>(&hwp.content_loss().to_json()).unwrap(),"hwpxLoss":serde_json::from_str::<Value>(&hwpx.content_loss().to_json()).unwrap(),"hwpReopen":layout(&DocumentCore::from_bytes(hwp.bytes()).unwrap()),"hwpxReopen":layout(&DocumentCore::from_bytes(hwpx.bytes()).unwrap())});
    let path = root().join(format!(
        "build/file-closure69-public/column2-candidate74/negative-baseline-valid/{name}.json"
    ));
    if std::env::var_os("JUEONY_WRITE_BASELINE").is_some() {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        if path.exists() {
            let frozen: Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
            assert_eq!(
                frozen, result,
                "A frozen fresh baseline must not change:{name}"
            );
        } else {
            std::fs::write(path, serde_json::to_vec_pretty(&result).unwrap()).unwrap();
        }
    } else {
        let expected: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
        let diagnostics = root()
            .join("build/file-closure69-public/column2-candidate74/negative-candidate-valid");
        std::fs::create_dir_all(&diagnostics).unwrap();
        std::fs::write(
            diagnostics.join(format!("{name}.json")),
            serde_json::to_vec_pretty(&result).unwrap(),
        )
        .unwrap();
        assert!(
            expected == result,
            "Excluded scenario changed: {name}; exact complete evidence written separately"
        );
    }
    assert_eq!(
        ir,
        serde_json::to_value(
            d.document()
                .sections
                .iter()
                .map(|s| &s.paragraphs)
                .collect::<Vec<_>>()
        )
        .unwrap(),
        "exports must not mutate live IR"
    );
}
macro_rules! excluded {
    ($name:ident) => {
        #[test]
        fn $name() {
            negative(stringify!($name));
        }
    };
}
excluded!(single_column);
excluded!(three_columns);
excluded!(rtl);
excluded!(distribute);
excluded!(unequal_columns);
excluded!(protected);
excluded!(locked);
excluded!(size_protected);
excluded!(cellfield);
excluded!(field);
excluded!(unknown);
excluded!(rowbreak);
excluded!(caption);
excluded!(zones);
excluded!(rowspan);
excluded!(colspan);
excluded!(width1);
excluded!(height1);
excluded!(positive_offset);
excluded!(negative_offset);
excluded!(absolute);
excluded!(width_relative);
excluded!(host_text);
excluded!(mixed_authentic_cache);
excluded!(positive_cached_origin);
excluded!(column_reset);
excluded!(section_reset);
excluded!(asymmetric_margin);
excluded!(common_unknown);

#[test]
fn actual_negative_pair_remains_exact() {
    let dir = root().join("build/file-closure69-overlap");
    let a = DocumentCore::from_bytes(&std::fs::read(dir.join("support/negative.hwp")).unwrap())
        .unwrap();
    let b =
        DocumentCore::from_bytes(&std::fs::read(dir.join("hancom-current/negative.hwp")).unwrap())
            .unwrap();
    same(&layout(&a), &layout(&b));
}
#[test]
fn compiled_source_provenance() {
    use sha2::{Digest, Sha256};
    const FLOW: &str = include_str!("../src/renderer/typeset/controls/flow_table.rs");
    let digest = Sha256::digest(FLOW.as_bytes())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();
    assert_eq!(digest, env!("JUEONY_FLOW_SHA"));
    let mode = env!("JUEONY_COLUMN_MODE");
    assert_eq!(
        FLOW.contains("generated_column_stack::owns_generated_frame"),
        mode == "candidate"
    );
    let expected = if mode == "candidate" {
        "columns74-candidate"
    } else {
        "columns74-baseline"
    };
    assert!(env!("CARGO_TARGET_DIR").ends_with(expected));
    std::fs::write(root().join(format!("build/file-closure69-public/column2-candidate74/source-provenance-{mode}.json")),serde_json::to_vec_pretty(&json!({"embeddedFlowSha256":digest,"mode":mode,"manifestDir":env!("CARGO_MANIFEST_DIR"),"targetDir":env!("CARGO_TARGET_DIR"),"hasCandidateRuntimeCall":FLOW.contains("generated_column_stack::owns_generated_frame")})).unwrap()).unwrap();
}

excluded!(many_following_lines);
