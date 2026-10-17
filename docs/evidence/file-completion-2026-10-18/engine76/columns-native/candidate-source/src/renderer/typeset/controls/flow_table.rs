//! 일반/TAC 표 하나의 포맷·배치 선택과 후행 표 지연 등록 조정.
//! 배치 알고리즘은 기존 엔진 경로를 호출하며 각주 수집·반복 중단은 부모가 소유한다.
use super::super::paragraph::metrics::FormattedParagraph;
use super::super::{preceding_stored_vpos, FormattedTable, TypesetEngine, TypesetState};
use crate::model::{paragraph::Paragraph, table::Table};
use crate::renderer::{
    composer::ComposedParagraph,
    float_placement::{signed_hwpunit, FloatLaneSet},
    height_measurer::MeasuredTable,
    hwpunit_to_px,
    style_resolver::ResolvedStyleSet,
};

/// 소유 문단의 기존 입력만 빌린다. 상태와 float lane은 별도 가변 인자로 전달한다.
pub(in crate::renderer::typeset) struct FlowTableInput<'a> {
    pub para_idx: usize,
    pub ctrl_idx: usize,
    pub para: &'a Paragraph,
    pub table: &'a Table,
    pub fmt: &'a FormattedParagraph,
    pub measured_tables: &'a [MeasuredTable],
    pub styles: &'a ResolvedStyleSet,
    pub composed: Option<&'a ComposedParagraph>,
    pub next_para: Option<&'a Paragraph>,
    pub tac_count: usize,
    pub first_placed_table: Option<usize>,
    pub last_placed_table: Option<usize>,
    pub para_start_height: f64,
    pub paragraphs_all: &'a [Paragraph],
    pub composed_all: &'a [ComposedParagraph],
    pub ctrl_order: &'a [usize],
    pub order_pos: usize,
}

/// strict fit 경로의 선행 배타 영역 소비에 필요한 높이만 조회한다.
fn natural_top_lead(table: &Table, ft: &FormattedTable, dpi: f64) -> Option<f64> {
    if ft.strict_following_plain_text_fit {
        Some(
            hwpunit_to_px(signed_hwpunit(table.common.vertical_offset).max(0), dpi)
                + hwpunit_to_px(table.outer_margin_top as i32, dpi),
        )
    } else {
        None
    }
}

pub(in crate::renderer::typeset) fn place(
    engine: &TypesetEngine,
    st: &mut TypesetState,
    input: FlowTableInput<'_>,
    para_float_lanes: &mut FloatLaneSet,
) -> bool {
    let FlowTableInput {
        para_idx,
        ctrl_idx,
        para,
        table,
        fmt,
        measured_tables,
        styles,
        composed,
        next_para,
        tac_count,
        first_placed_table,
        last_placed_table,
        para_start_height,
        paragraphs_all,
        composed_all,
        ctrl_order,
        order_pos,
    } = input;
    let mut break_after_current_table = false;
    let is_column_top = st.flow_table_column_top();
    let mut ft = engine.format_table(
        para,
        para_idx,
        ctrl_idx,
        table,
        measured_tables,
        styles,
        composed,
        next_para,
        is_column_top,
    );

    // A complete generated first-column frame has no authoritative saved vpos.
    // Reserve the physical outer band and publish the same origin for paint.
    let page=st.empty_float_page();
    let generated=page.current_column==0 && page.visible_float_exclusions.is_empty()
        && page.current_items.len()==para_idx
        && page.current_items.iter().enumerate().all(|(i,item)|match item {
            super::super::PageItem::FullParagraph{para_index}=>i==0&&*para_index==0,
            super::super::PageItem::Table{para_index,control_index}=>i>0&&*para_index==i&&*control_index==0,
            _=>false,
        })
        && crate::renderer::generated_column_stack::owns_generated_frame(
            page.profile,std::sync::Arc::clone(&engine.render_normalization),page.layout.column_areas.len(),
            page.layout.body_area.width,paragraphs_all,para_idx,measured_tables,styles,engine.dpi);
    if generated {
        let column=page.layout.column_areas[0];
        // This contract owns one complete first-column frame. A wide object
        // must not become an exclusion-free overlay on text in a later column.
        let mut complete_height=0.0;
        let mut complete=true;
        for (i,p) in paragraphs_all.iter().enumerate() {
            if (1..=2).contains(&i) {
                let [crate::model::control::Control::Table(t)]=p.controls.as_slice() else {complete=false;break;};
                complete_height+=hwpunit_to_px(t.common.height as i32+i32::from(t.outer_margin_top)+i32::from(t.outer_margin_bottom),engine.dpi);
            } else {
                let f=engine.format_paragraph(p,composed_all.get(i),styles,Some(column.width));
                if f.line_heights.len()!=1 {complete=false;break;}
                complete_height+=f.total_height+f.spacing_before+f.spacing_after;
            }
        }
        let available=st.empty_float_available_height(ft.table_footnote_height,ft.table_footnote_count);
        if !complete || !complete_height.is_finite() || complete_height>available {
            // The ordinary path retains ownership for a spanning/mixed frame.
        } else {
        let ctx=crate::renderer::float_placement::FloatPlacementContext::new(column)
            .with_body_area(page.layout.body_area).with_paper_width(page.layout.page_width);
        let (x_start,x_end)=crate::renderer::float_placement::horizontal_range(
            &table.common,hwpunit_to_px(table.common.width as i32,engine.dpi),ctx,engine.dpi);
        let anchor=page.current_height;
        let top=anchor+hwpunit_to_px(i32::from(table.outer_margin_top),engine.dpi);
        let end=top+hwpunit_to_px(table.common.height as i32+i32::from(table.outer_margin_bottom),engine.dpi);
        if end<=st.empty_float_available_height(ft.table_footnote_height,ft.table_footnote_count) {
            let placement=super::empty_float::EmptyFloatPlacement{x_start,x_end,raw_top:top,
                reserved_height:end-top,
                resolved:Some(crate::renderer::float_placement::ParagraphFloatPlacement{
                    flow:crate::renderer::float_placement::ParagraphFloatFlow::NextLine,
                    anchor_y:anchor,stored_host_origin:None,stored_successor_line_origin:Some(end),
                    table_left:None,table_top:top,occupied_bottom:end,
                })};
            st.commit_empty_float_table(para_idx,ctrl_idx,placement,para_float_lanes);
            return false;
        }
        }
    }

    // Only native single-column adjacent whole-table frames own this empty
    // anchor spacing. Keep all actual style margins and offset contracts in ft.
    let starts_semantic_stack = st.col_count == 1 && (st.profile.hwp5_stored_pagination_layout()
            || (st.profile.hwpx_stored_layout() && crate::renderer::float_placement::stored_closed_whole_table_stack(paragraphs_all, para_idx)))
            && !st.current_items.iter().any(|item| matches!(item, super::super::PageItem::PartialTable { .. } | super::super::PageItem::Shape { .. }))
            && matches!(st.current_items.first(), Some(super::super::PageItem::FullParagraph { para_index })
                if paragraphs_all.get(*para_index).and_then(|host| host.line_segs.first())
                    .is_some_and(|line| line.vertical_pos == 0
                        && line.tag & crate::model::paragraph::LineSeg::TAG_IMPLEMENTATION_PROPERTY == 0))
        && table.page_break == crate::model::table::TablePageBreak::None
        && crate::renderer::float_placement::object_only_saved_table_anchor(para, table)
        && table.common.vert_rel_to == crate::model::shape::VertRelTo::Para
        && table.common.vert_align == crate::model::shape::VertAlign::Top
        && signed_hwpunit(table.common.vertical_offset) >= 0
        && next_para.is_some_and(|next| matches!(next.controls.as_slice(),
            [crate::model::control::Control::Table(following)]
                if following.page_break == crate::model::table::TablePageBreak::None
                    && (crate::renderer::float_placement::object_only_saved_table_anchor(next, following)
                        || crate::renderer::float_placement::closed_full_width_positive_pair(paragraphs_all,para_idx+1))
                    && following.common.vert_rel_to == crate::model::shape::VertRelTo::Para
                    && following.common.vert_align == crate::model::shape::VertAlign::Top
                    && (signed_hwpunit(following.common.vertical_offset) >= 0
                        || (para_idx==1 && crate::renderer::float_placement::negative_pair_has_frame_anchor(paragraphs_all)))));
    if starts_semantic_stack {
        let single_cell_placeholder = table.row_count == 1 && table.col_count == 1
            && table.cells.len() == 1 && table.cells[0].paragraphs.iter()
                .all(|p| p.controls.is_empty() && p.line_segs.len() <= 1);
        let cached_spacing = if single_cell_placeholder { 0.0 } else {
            para.line_segs.last().filter(|seg| seg.line_spacing > 0)
                .map(|seg| hwpunit_to_px(seg.line_spacing, engine.dpi)).unwrap_or(0.0)
        };
        ft.host_spacing.after -= cached_spacing;
        ft.host_spacing.after_for_fit -= cached_spacing;
    }

    // Only the already-emitted adjacent native whole-table stack owns this
    // continuation. The old empty-anchor advance encoded in LINE_SEG is not
    // an additional blank line after the second physical frame (Hancom 2024).
    let semantic_stack = st.col_count == 1 && (st.profile.hwp5_stored_pagination_layout()
            || (st.profile.hwpx_stored_layout() && crate::renderer::float_placement::stored_closed_whole_table_stack(paragraphs_all, para_idx)))
            && !st.current_items.iter().any(|item| matches!(item, super::super::PageItem::PartialTable { .. } | super::super::PageItem::Shape { .. }))
            && matches!(st.current_items.first(), Some(super::super::PageItem::FullParagraph { para_index })
                if paragraphs_all.get(*para_index).and_then(|host| host.line_segs.first())
                    .is_some_and(|line| line.vertical_pos == 0
                        && line.tag & crate::model::paragraph::LineSeg::TAG_IMPLEMENTATION_PROPERTY == 0))
        && table.page_break == crate::model::table::TablePageBreak::None
        && (crate::renderer::float_placement::object_only_saved_table_anchor(para, table)
            || crate::renderer::float_placement::closed_full_width_positive_pair(paragraphs_all,para_idx))
        && table.common.vert_rel_to == crate::model::shape::VertRelTo::Para
        && table.common.vert_align == crate::model::shape::VertAlign::Top
        && (signed_hwpunit(table.common.vertical_offset) >= 0
            || (para_idx==2 && crate::renderer::float_placement::negative_pair_has_frame_anchor(paragraphs_all)))
        && para_idx.checked_sub(1).is_some_and(|previous_index| {
            paragraphs_all.get(previous_index).is_some_and(|host| matches!(host.controls.as_slice(),
                [crate::model::control::Control::Table(previous)] if previous.page_break == crate::model::table::TablePageBreak::None
                    && crate::renderer::float_placement::object_only_saved_table_anchor(host, previous)
                    && previous.common.vert_rel_to == crate::model::shape::VertRelTo::Para
                    && previous.common.vert_align == crate::model::shape::VertAlign::Top
                    && signed_hwpunit(previous.common.vertical_offset) >= 0))
            && matches!(st.current_items.last(), Some(super::super::PageItem::Table { para_index, control_index })
                if *para_index == previous_index && *control_index == 0)
        });
    if semantic_stack {
        let cached_host_advance = crate::renderer::float_placement::stored_empty_anchor_band_host_line_advance_hu(
            true, para, ctrl_idx, next_para).map(|hu| hwpunit_to_px(hu, engine.dpi)).unwrap_or(0.0);
        ft.host_spacing.after -= cached_host_advance;
        ft.host_spacing.after_for_fit -= cached_host_advance;
        if para_idx==2 && crate::renderer::float_placement::negative_pair_has_frame_anchor(paragraphs_all) {
            ft.host_spacing.after -= hwpunit_to_px(table.outer_margin_bottom.max(0) as i32,engine.dpi);
            ft.total_height=ft.effective_height+ft.host_spacing.before+ft.host_spacing.after;
        }
    }

    let issue2439_para_start_height =
        st.prepare_flow_table_anchor(natural_top_lead(table, &ft, engine.dpi), para_start_height);

    let mt = measured_tables
        .iter()
        .find(|mt| mt.para_index == para_idx && mt.control_index == ctrl_idx);
    let is_first_placed = first_placed_table == Some(ctrl_idx);
    let is_last_placed = last_placed_table == Some(ctrl_idx);
    if engine.is_effective_tac_table(para, table, fmt) {
        if !engine.render_normalization.table_text_reflowed(table) {
            if let Some(placement) = super::stored_tac::prepare_coanchored_first_line(
                ctrl_idx,
                para,
                fmt,
                ft.effective_height,
                st.stored_tac_page(paragraphs_all),
                st.available_height(),
                engine.dpi,
            ) {
                st.commit_stored_tac_control(para_idx, placement);
                return false;
            }
        }
        engine.typeset_tac_table(
            st,
            para_idx,
            ctrl_idx,
            para,
            table,
            &ft,
            fmt,
            tac_count,
            is_first_placed,
            is_last_placed,
            styles,
            preceding_stored_vpos(paragraphs_all, para_idx),
        );
    } else if engine.try_typeset_empty_para_float_table(
        st,
        para_idx,
        ctrl_idx,
        para,
        table,
        &ft,
        composed,
        next_para,
        styles,
        para_start_height,
        para_float_lanes,
    ) {
        // Empty host para-float table placed by horizontal lane reservation.
    } else {
        let pages_before_block_table = st.flow_table_page_count();
        engine.typeset_block_table(
            st,
            para_idx,
            ctrl_idx,
            para,
            table,
            &ft,
            fmt,
            mt,
            styles,
            issue2439_para_start_height,
            // [Task #1860] 비지연 경로: para_start_height 가 곧 참 para_start.
            issue2439_para_start_height,
            is_first_placed,
            is_last_placed,
            paragraphs_all,
            composed_all,
        );
        let deferred_query =
            super::deferred::CoanchoredTableQuery::new(para, fmt, engine.tac_flow_query());
        let (page_count, current_items) = st.coanchored_table_page();
        if deferred_query.should_defer_remaining_coanchored_rowbreak_tables(
            table,
            page_count,
            current_items,
            pages_before_block_table,
        ) {
            let deferred = deferred_query.remaining_controls(
                para_idx,
                ctrl_order,
                order_pos,
                first_placed_table,
                last_placed_table,
                para_start_height,
            );
            if !deferred.is_empty() {
                st.enqueue_deferred_table_controls(deferred);
                break_after_current_table = true;
            }
        }
    }

    break_after_current_table
}
