use rhwp::DocumentCore;
use std::path::PathBuf;
#[test]
fn mcst_readonly_actual_page_boundary_trace() {
 let root=PathBuf::from(std::env::var("JUEONY_REPO").unwrap());
 for (id,name) in [("actual","build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx"),("explicit56","build/file-closure75-public-readonly/mcst-actual-p56-explicit-break.hwpx"),("converted","build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx.hwpx")] {
  eprintln!("MCST_TRACE_BEGIN {}",id);
  let bytes=std::fs::read(root.join(name)).unwrap();let d=DocumentCore::from_bytes(&bytes).unwrap();
  let out=(0..d.page_count()).map(|page|serde_json::json!({"page":page,"text":serde_json::from_str::<serde_json::Value>(&d.get_page_text_layout_native(page).unwrap()).unwrap(),"controls":serde_json::from_str::<serde_json::Value>(&d.get_page_control_layout_native(page).unwrap()).unwrap()})).collect::<Vec<_>>();
  let doc=d.document();let p=(49..61).map(|i|serde_json::json!({"para":i,"lineSegs":doc.sections[0].paragraphs[i].line_segs,"sourceLineSegVpos":doc.sections[0].paragraphs[i].source_line_seg_vertical_pos,"sourceColumnBreak":doc.sections[0].paragraphs[i].column_type,"partitionDirty":doc.sections[0].paragraphs[i].stored_text_partition_is_dirty(),"cellDirty":doc.sections[0].paragraphs[i].cell_format_vpos_dirty,"shape":doc.doc_info.para_shapes[doc.sections[0].paragraphs[i].para_shape_id as usize],"chars":doc.sections[0].paragraphs[i].text.chars().count(),"controls":doc.sections[0].paragraphs[i].controls.len()})).collect::<Vec<_>>();
  std::fs::write(root.join(format!("build/file-closure75-public-readonly/metrics-plan76-v5-{}-layout.json",id)),serde_json::to_vec(&out).unwrap()).unwrap();
  std::fs::write(root.join(format!("build/file-closure75-public-readonly/metrics-plan76-v5-{}-raw49-60.json",id)),serde_json::to_vec(&p).unwrap()).unwrap();
  eprintln!("MCST_TRACE_END {} pages{}",id,d.page_count());
 }
}
