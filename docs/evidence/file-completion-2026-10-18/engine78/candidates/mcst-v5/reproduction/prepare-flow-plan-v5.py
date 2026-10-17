import pathlib,shutil,re,json,hashlib,difflib
out=pathlib.Path('build/file-closure75-public-readonly');base=pathlib.Path('build/rhwp-engine/source-23d2545926a179a5');dst=out/'metrics-plan-candidate76-v5';shutil.copytree(out/'metrics-candidate76',dst)
for name in ['src/renderer/typeset.rs','src/renderer/typeset/paragraph.rs','src/renderer/typeset/paragraph/metrics.rs','src/renderer/typeset/section/vpos.rs']:shutil.copy2(base/name,dst/name)
p=dst/'src/renderer/typeset/section/vpos.rs';s=p.read_text(encoding='utf-8');start=s.index('        let mut hc = HeightCursor {');end=s.index('\n        };',start)+len('\n        };');literal=s[start:end];body=literal.split('HeightCursor {',1)[1].rsplit('};',1)[0];body=body.replace('self.dpi','dpi').replace('self.uniform_filler_ladder.get()','uniform_filler_ladder').replace('self.profile.get().session_edited()','session_edited');s=s[:start]+'''        let mut hc = crate::renderer::typeset::shared_body_height_cursor(
            st, self.dpi, self.uniform_filler_ladder.get(), self.profile.get().session_edited(),
        );'''+s[end:];s=s.replace('stored_ladder_encodes_spacing_before, HeightCursor, Paragraph,','stored_ladder_encodes_spacing_before, Paragraph,');p.write_text(s,encoding='utf-8')
p=dst/'src/renderer/typeset.rs';s=p.read_text(encoding='utf-8');s+='''\n// Keep the fit cursor and spacing-restoration proof on the same policy inputs.\nfn shared_body_height_cursor(\n    st: &TypesetState, dpi: f64, uniform_filler_ladder: bool, session_edited: bool,\n) -> HeightCursor {\n    HeightCursor {'''+body+'''\n    }\n}\n''';needle='''                st.vpos_ladder_dirty
                    || !spacing_trim_restorable(paragraphs_all, next_idx)''';assert s.count(needle)==1;s=s.replace(needle,'''                st.vpos_ladder_dirty
                    || paragraph::source_spacing_trim_changes_next_origin(
                        st, next_idx, next, &fmt_n, paragraphs_all, styles, trim_sb, false, self.dpi,
                    )
                    || !spacing_trim_restorable(paragraphs_all, next_idx)''');p.write_text(s,encoding='utf-8')
p=dst/'src/renderer/typeset/paragraph.rs';s=p.read_text(encoding='utf-8');# Add the context-specific proof alongside each existing dirty gate.
needle='st.vpos_ladder_dirty\n';count=s.count(needle);assert count==5,count
# Each gate is in a call whose final lazy flag is known from the surrounding function.
pos=0
for _ in range(count):
 i=s.index(needle,pos);j=s.index('next_boundary_reverts_spacing_trim(',i);end=s.index('),',j)+2;tail=s[end:end+170];lazy='st.vpos_page_base.is_none() && st.vpos_lazy_base.is_some()' if 'st.vpos_page_base.is_none()' in tail else 'false';indent=re.search(r'\n( *)st.vpos_ladder_dirty',s[:i+len(needle)]).group(1) if False else ''
 add='''                || source_spacing_trim_changes_next_origin(
                    st, para_idx, para, fmt, paragraphs, styles,
                    trim_spacing_before_for_flow, '''+lazy+''', dpi,
                )
''';s=s[:i+len(needle)]+add+s[i+len(needle):];pos=i+len(needle)+len(add)
s+='''
/// A changed source-vpos snapshot identifies a reconstructed ordinary body, but
/// is not itself a failed snap. Compare the actual HeightCursor decisions at
/// trimmed and full consumption; retain trimming only if both reach exactly
/// the same position and the same future page/lazy origin.
#[allow(clippy::too_many_arguments)]
pub(super) fn source_spacing_trim_changes_next_origin(
    st: &TypesetState, para_idx: usize, para: &Paragraph, fmt: &FormattedParagraph,
    paragraphs: &[Paragraph], styles: &ResolvedStyleSet,
    trim_before: bool, lazy_base: bool, dpi: f64,
) -> bool {
    if st.col_count != 1 || !st.profile.hwpx_stored_layout()
        || st.profile.session_edited() || para.stored_text_partition_is_dirty()
        || para.cell_format_vpos_dirty || !para.controls.is_empty()
        || !para.field_ranges.is_empty() || !para.orphan_field_ends.is_empty()
        || para.text.contains('\\t')
    { return false; }
    let Some(source) = para.source_line_seg_vertical_pos.as_ref() else { return false; };
    if source.len() != para.line_segs.len() || source.is_empty()
        || !source.iter().any(|&v| v > 0) || source.iter().any(|&v| v < 0)
        || source.windows(2).any(|w| w[1] < w[0])
        || para.line_segs.iter().any(is_synthetic_line_seg)
        || source.iter().zip(&para.line_segs).all(|(&v, line)| v == line.vertical_pos)
    { return false; }
    let Some(next) = paragraphs.get(para_idx + 1) else { return false; };
    if !next.controls.is_empty() || !next.field_ranges.is_empty()
        || !next.orphan_field_ends.is_empty() || next.stored_text_partition_is_dirty()
        || next.cell_format_vpos_dirty || next.line_segs.is_empty()
        || next.line_segs.iter().any(is_synthetic_line_seg)
    { return false; }
    // The existing uniform-filler cursor is a whole-section predicate. A local
    // multi-row paragraph disproves its necessary one-row condition without
    // rescanning an arbitrarily large section for every body paragraph.
    let local_nonuniform = paragraphs.len() < 8
        || paragraphs[para_idx.saturating_sub(1)..(para_idx + 2).min(paragraphs.len())]
            .iter().any(|p| p.line_segs.len() != 1);
    if !local_nonuniform { return false; }
    let trimmed = fmt.flow_advance_height(para, 1, trim_before, false, lazy_base);
    if trimmed >= fmt.total_height { return false; }
    let mut a = super::shared_body_height_cursor(st, dpi, false, st.profile.session_edited());
    a.prev_layout_para = Some(para_idx);
    a.prev_item_was_partial_table = false;
    a.trimmed_prev_spacing_before_px = if st.profile.hwp5_stored_pagination_layout() {
        fmt.flow_trimmed_spacing_before(para, 1, trim_before, false, lazy_base)
    } else { 0.0 };
    let mut b = super::shared_body_height_cursor(st, dpi, false, st.profile.session_edited());
    b.prev_layout_para = Some(para_idx);
    b.prev_item_was_partial_table = false;
    b.trimmed_prev_spacing_before_px = 0.0;
    let from_trim = a.vpos_adjust(st.current_height + trimmed, para_idx + 1, paragraphs, styles);
    let from_full = b.vpos_adjust(st.current_height + fmt.total_height, para_idx + 1, paragraphs, styles);
    from_trim != from_full || a.vpos_page_base != b.vpos_page_base
        || a.vpos_lazy_base != b.vpos_lazy_base
}
''';p.write_text(s,encoding='utf-8')
for p in (dst/'tests').glob('jueony_mcst*.rs'):
 s=p.read_text(encoding='utf-8-sig').replace('metrics76','metrics-plan76-v5');p.write_text(s,encoding='utf-8')
proof=[];patch=''
for p in (base/'src').rglob('*'):
 if p.is_file():
  rel=p.relative_to(base);q=dst/rel
  if p.read_bytes()!=q.read_bytes():
   proof.append(dict(path=rel.as_posix(),before=hashlib.sha256(p.read_bytes()).hexdigest(),after=hashlib.sha256(q.read_bytes()).hexdigest()));patch+=''.join(difflib.unified_diff(p.read_text(encoding='utf-8').splitlines(True),q.read_text(encoding='utf-8').splitlines(True),fromfile='a/'+rel.as_posix(),tofile='b/'+rel.as_posix()))
assert len(proof)==3,proof;(out/'metrics-plan76-v5-source-proof.json').write_text(json.dumps(proof,indent=2),encoding='utf-8');(out/'metrics-plan76-v5-private.patch').write_text(patch,encoding='utf-8');s=(out/'run-metrics76.sh').read_bytes().decode().replace('metrics-candidate76','metrics-plan-candidate76-v5').replace('../metrics76-exclusions-actual11.log','../metrics-plan76-v5.log');(out/'run-metrics-plan76-v5.sh').write_bytes(s.encode());print(proof)
