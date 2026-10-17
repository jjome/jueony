//! Physical ownership for a generated full-body-width whole-table stack in
//! the first frame of an otherwise ordinary equal-width multi-column section.
//! Zero/synthetic source rows are never reclassified as stored page positions.
use super::{
    height_measurer::{HeightMeasurer, MeasuredTable},
    hwpunit_to_px,
    style_resolver::ResolvedStyleSet,
};
use crate::model::{
    control::Control,
    paragraph::Paragraph,
    shape::{HorzAlign, HorzRelTo, SizeCriterion, VertAlign, VertRelTo},
    table::{Table, TablePageBreak},
};

pub(crate) fn owns_generated_frame(
    profile: crate::model::provenance::LayoutCompatibilityProfile,
    overlay: std::sync::Arc<super::render_normalization::RenderNormalizationOverlay>,
    columns: usize,
    body_width: f64,
    paragraphs: &[Paragraph],
    index: usize,
    measured: &[MeasuredTable],
    styles: &ResolvedStyleSet,
    dpi: f64,
) -> bool {
    if !profile.native_hwp5_layout()
        || columns != 2
        || paragraphs.len() < 4
        || paragraphs.len() > 128
    {
        return false;
    }
    let plain = |p: &Paragraph| {
        p.field_ranges.is_empty()
            && p.orphan_field_ends.is_empty()
            && p.range_tags.is_empty()
            && p.title_marks.is_empty()
            && p.markpen_marks.is_empty()
            && p.ctrl_data_records.iter().all(Option::is_none)
    };
    // A generated row is not a saved origin. Authentic rows or page/column reset
    // signals deliberately keep their old placement path.
    let generated = |p: &Paragraph| {
        matches!(p.line_segs.as_slice(),[line]
        if line.text_start==0 && line.vertical_pos==0 && line.column_start==0
        && line.line_height>0 && line.text_height==line.line_height
        && line.baseline_distance>0 && line.baseline_distance<=line.line_height
        && line.line_spacing>=0 && line.tag==0x8006_0000)
    };
    let Some(first) = paragraphs.first() else {
        return false;
    };
    if first.text.is_empty()
        || !plain(first)
        || !generated(first)
        || first.column_type != crate::model::paragraph::ColumnBreakType::Section
    {
        return false;
    }
    let mut section = 0;
    let mut column = 0;
    let mut body_width_hu = None;
    for c in &first.controls {
        match c {
            Control::SectionDef(sd) => {
                if sd.page_def.landscape || sd.page_def.margin_gutter != 0 {
                    return false;
                }
                body_width_hu = i64::from(sd.page_def.width)
                    .checked_sub(i64::from(sd.page_def.margin_left))
                    .and_then(|width| width.checked_sub(i64::from(sd.page_def.margin_right)));
                section += 1;
            }
            Control::ColumnDef(c)
                if usize::from(c.column_count) == columns
                    && c.same_width
                    && c.direction == crate::model::page::ColumnDirection::LeftToRight
                    && c.column_type == crate::model::page::ColumnType::Normal
                    && c.spacing >= 0
                    && c.widths.is_empty()
                    && c.gaps.is_empty() =>
            {
                column += 1
            }
            _ => return false,
        }
    }
    if section != 1 || column != 1 {
        return false;
    }
    let count = paragraphs
        .iter()
        .skip(1)
        .take_while(|p| matches!(p.controls.as_slice(), [Control::Table(_)]))
        .count();
    if count != 2 || !(1..=count).contains(&index) {
        return false;
    }
    let generated_body = |p: &Paragraph| {
        p.line_segs.is_empty()
            || matches!(p.line_segs.as_slice(),[l]
            if l.tag==0x8006_0000 && l.text_start==0 && l.vertical_pos>=0
            && l.column_start==0 && l.line_height>0 && l.text_height==l.line_height
            && l.baseline_distance>0 && l.baseline_distance<=l.line_height && l.line_spacing>=0)
    };
    // Edited generated body rows may retain a recomputed positive vpos. They
    // are still synthetic, never stored origins; only plain one-line body is
    // allowed and the complete frame fit is checked by the caller.
    let fully_generated = paragraphs.iter().enumerate().all(|(i, p)| {
        if i <= count {
            generated(p)
        } else {
            generated_body(p)
        }
    });
    // Hancom rewrites the two zero-width object anchors while retaining the
    // generated header/body flags. Their exact integer differences prove only
    // occupied band heights. Placement still starts at the live flow origin.
    let closed = (|| {
        let [Control::Table(a)] = paragraphs[1].controls.as_slice() else {
            return false;
        };
        let [Control::Table(b)] = paragraphs[2].controls.as_slice() else {
            return false;
        };
        let [one] = paragraphs[1].line_segs.as_slice() else {
            return false;
        };
        let [two] = paragraphs[2].line_segs.as_slice() else {
            return false;
        };
        let [next] = paragraphs[3].line_segs.as_slice() else {
            return false;
        };
        let host = |l: &crate::model::paragraph::LineSeg| {
            l.tag == 0x0006_0000
                && l.text_start == 0
                && l.column_start == 0
                && l.segment_width == 0
                && l.vertical_pos > 0
                && l.line_height > 0
                && l.text_height == l.line_height
                && l.baseline_distance > 0
                && l.baseline_distance <= l.line_height
                && l.line_spacing >= 0
        };
        host(one)
            && host(two)
            && next.tag == 0x8006_0000
            && next.vertical_pos > two.vertical_pos
            && i64::from(one.vertical_pos)
                == i64::from(first.line_segs[0].line_height)
                    + i64::from(first.line_segs[0].line_spacing)
            && i64::from(two.vertical_pos) - i64::from(one.vertical_pos)
                == i64::from(a.common.height)
                    + i64::from(a.outer_margin_top)
                    + i64::from(a.outer_margin_bottom)
            && i64::from(next.vertical_pos) - i64::from(two.vertical_pos)
                == i64::from(b.common.height)
                    + i64::from(b.outer_margin_top)
                    + i64::from(b.outer_margin_bottom)
            && paragraphs[3..].iter().all(|p| {
                p.line_segs.is_empty()
                    || matches!(p.line_segs.as_slice(),[l]
                if l.tag==0x8006_0000 && l.text_start==0 && l.vertical_pos>=0
                && l.column_start==0 && l.line_height>0 && l.text_height==l.line_height
                && l.baseline_distance>0 && l.baseline_distance<=l.line_height && l.line_spacing>=0)
            })
    })();
    if !fully_generated && !closed {
        return false;
    }
    for (pi, p) in paragraphs.iter().enumerate() {
        if !plain(p) || (pi > 0 && p.column_type != crate::model::paragraph::ColumnBreakType::None)
        {
            return false;
        }
        let Some(s) = styles.para_styles.get(p.para_shape_id as usize) else {
            return false;
        };
        if [
            s.margin_left,
            s.margin_right,
            s.indent,
            s.spacing_before,
            s.spacing_after,
        ]
        .iter()
        .any(|v| v.abs() > 0.001)
        {
            return false;
        }
        if pi > count && !p.controls.is_empty() {
            return false;
        }
    }
    for (i, p) in paragraphs.iter().enumerate().take(count + 1).skip(1) {
        let [Control::Table(t)] = p.controls.as_slice() else {
            return false;
        };
        if !p.text.is_empty() || !plain_table(t, plain) {
            return false;
        }
        let outer_width = i64::from(t.common.width)
            + i64::from(t.outer_margin_left)
            + i64::from(t.outer_margin_right);
        if outer_width > i64::from(i32::MAX)
            || Some(outer_width) != body_width_hu
            || (hwpunit_to_px(outer_width as i32, dpi) - body_width).abs() > 0.000001
        {
            return false;
        }
        // Raw cell heights are minima, not composed row heights. Probe only
        // the derived aggregate with the same profile/normalization contract
        // as the explicit table content-height command; never mutate the IR.
        let mut probe = t.clone();
        probe.common.height = 0;
        let natural = HeightMeasurer::new(dpi)
            .with_native_hwp5(profile.native_hwp5_layout())
            .with_hwpx_stored_layout(profile.hwpx_stored_layout())
            .with_session_edited(profile.session_edited())
            .with_render_normalization(std::sync::Arc::clone(&overlay))
            .measure_table(&probe, i, 0, styles);
        if natural.row_heights.len() != usize::from(t.row_count)
            || natural
                .row_heights
                .iter()
                .any(|h| !h.is_finite() || *h <= 0.0)
            || !natural.cell_spacing.is_finite()
            || natural.cell_spacing < 0.0
        {
            return false;
        }
        let natural_hu = (natural.row_heights.iter().sum::<f64>()
            + natural.cell_spacing * usize::from(t.row_count).saturating_sub(1) as f64)
            * 7200.0
            / dpi;
        if !natural_hu.is_finite()
            || natural_hu <= 0.0
            || natural_hu > i32::MAX as f64
            || natural_hu.round() as u32 != t.common.height
        {
            return false;
        }
        let Some(m) = measured
            .iter()
            .find(|m| m.para_index == i && m.control_index == 0)
        else {
            return false;
        };
        if (m.total_height - hwpunit_to_px(t.common.height as i32, dpi)).abs() > 0.2 {
            return false;
        }
    }
    true
}
fn plain_table(t: &Table, plain: impl Fn(&Paragraph) -> bool) -> bool {
    if t.common.treat_as_char
        || !super::float_placement::is_para_topbottom_float(&t.common)
        || t.common.vert_rel_to != VertRelTo::Para
        || t.common.vert_align != VertAlign::Top
        || t.common.horz_rel_to != HorzRelTo::Para
        || t.common.horz_align != HorzAlign::Left
        || t.common.vertical_offset != 0
        || t.common.horizontal_offset != 0
        || t.common.locked
        || t.common.size_protect
        || t.attr & (1 << 30) != 0
        || t.raw_table_record_attr & 8 != 0
        || t.common.height_criterion != SizeCriterion::Absolute
        || t.common.width_criterion != SizeCriterion::Absolute
        || !t.common.description.is_empty()
        || t.common.raw_extra.iter().any(|b| *b != 0)
        || t.common.width == 0
        || t.common.width >= 0x8000_0000
        || t.common.height == 0
        || t.common.height >= 0x8000_0000
        || t.page_break != TablePageBreak::None
        || t.repeat_header
        || t.caption.is_some()
        || !t.zones.is_empty()
        || t.cell_spacing != 0
        || t.outer_margin_top <= 0
        || [
            t.outer_margin_left,
            t.outer_margin_right,
            t.outer_margin_bottom,
        ]
        .iter()
        .any(|v| *v != t.outer_margin_top)
        || t.row_count == 0
        || t.row_count > 128
        || t.col_count > 64
        || t.cells.len() > 4096
        || i64::from(t.common.height) + 2 * i64::from(t.outer_margin_top) > i64::from(i32::MAX)
        || t.col_count == 0
        || t.cells.len() != usize::from(t.row_count) * usize::from(t.col_count)
    {
        return false;
    }
    t.cells.iter().enumerate().all(|(i, c)| {
        c.row_span == 1
            && c.col_span == 1
            && usize::from(c.row) == i / usize::from(t.col_count)
            && usize::from(c.col) == i % usize::from(t.col_count)
            && c.width > 0
            && c.width < 0x8000_0000
            && c.height > 0
            && c.height < 0x8000_0000
            && !c.cell_protect()
            && c.field_name.is_none()
            && c.text_direction == 0
            && c.line_wrap == 0
            && !c.paragraphs.is_empty()
            && c.paragraphs.iter().all(|p| {
                p.controls.is_empty()
                    && plain(p)
                    && p.column_type == crate::model::paragraph::ColumnBreakType::None
            })
    })
}
