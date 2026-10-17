//! Read-only session story evidence. No mutations, synthesized IDs or renderer caches.
use super::HwpDocument;
use crate::document_core::DocumentCore;
use crate::model::{control::Control,paragraph::Paragraph,style::HeadType};
use serde::Deserialize;
use serde_json::{json,Value};
use wasm_bindgen::prelude::*;
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct Request {kind:String,section:usize,apply_to:Option<u8>,parent:Option<usize>,control:Option<usize>}
fn fail(s:&str)->String{s.to_owned()}
fn encoded<T:serde::Serialize>(v:&T)->Result<Value,String>{serde_json::to_value(v).map_err(|_|fail("unreadable semantic metadata"))}
fn remove(v:&mut Value,keys:&[&str]){if let Some(o)=v.as_object_mut(){for k in keys{o.remove(*k);}}}
fn clean_identity(extra:&[u8])->Result<Value,String>{match extra.len(){0=>Ok(json!({"mode":"semantic","instance":null})),4=>{let id=u32::from_le_bytes(extra.try_into().unwrap());Ok(if id==0{json!({"mode":"semantic","instance":null})}else{json!({"mode":"instance","instance":id})})},_=>Err(fail("opaque owner identity tail"))}}
fn border_evidence(core:&DocumentCore,id:u16)->Result<Value,String>{
 if id==0{return Ok(json!({"absent":true}));}let border=core.document.doc_info.border_fills.get((id-1) as usize).ok_or_else(||fail("invalid border/fill reference"))?;
 if border.attr&0x8000!=0||border.fill.image.is_some()||border.fill.gradient.is_some(){return Err(fail("unobserved complex fill graph or flags"));}
 if let Some(raw)=&border.raw_data{if ![40,53].contains(&raw.len())||[2,8,14,20,26].iter().any(|i|raw[*i]>17)||[3,9,15,21,27].iter().any(|i|raw[*i]>15){return Err(fail("opaque border record layout"));}let tag=u32::from_le_bytes(raw[32..36].try_into().unwrap());if (tag==0&&(raw.len()!=40||raw[36..40].iter().any(|v|*v!=0)))||(tag==1&&(raw.len()!=53||raw[48..52].iter().any(|v|*v!=0)))||tag>1{return Err(fail("unreadable fill record attributes"));}}
 let mut v=encoded(border)?;remove(&mut v,&["raw_data"]);
 // Transparent no-hatch Solid is the model's explicit no-fill sentinel.
 if let Some(solid)=&border.fill.solid{if !matches!(border.fill.fill_type,crate::model::style::FillType::Solid) && !(matches!(border.fill.fill_type,crate::model::style::FillType::None)&&solid.background_color==u32::MAX&&solid.pattern_type<0){return Err(fail("inconsistent fill variants"));}if ![-1,0].contains(&solid.pattern_type)&&solid.pattern_type<0{return Err(fail("unknown hatch pattern"));}if solid.pattern_type<=0{if solid.background_color==u32::MAX{v["fill"]=json!({"fill_type":"None"});}else{remove(&mut v["fill"]["solid"],&["pattern_color"]);v["fill"]["solid"]["pattern_type"]=json!(-1);}}}else{if !matches!(border.fill.fill_type,crate::model::style::FillType::None){return Err(fail("incomplete fill variant"));}v["fill"]=json!({"fill_type":"None"});}Ok(v)
}
fn generated_mask(p:&Paragraph)->u32{let mut bits=0;for c in &p.controls{bits|=match c{Control::SectionDef(_)|Control::ColumnDef(_)=>1<<2,Control::Header(_)|Control::Footer(_)=>1<<16,Control::Footnote(_)|Control::Endnote(_)=>1<<17,Control::AutoNumber(_)=>1<<18,_=>0};}if p.text.contains('\t'){bits|=1<<9;}if p.text.contains('\n'){bits|=1<<10;}bits}
// The story DTO identifies effective font meaning, not which codec supplied an
// already-consistent known type spelling. Retain REP, missing/unknown source
// spellings and inconsistent claims; they are not proven native equivalences.
fn font_evidence(font:&crate::model::style::Font)->Result<Value,String>{
 let mut value=encoded(font)?;remove(&mut value,&["raw_data"]);
 if matches!((font.hwpx_type_origin.as_ref(),font.alt_type),
  (Some(crate::model::style::FontTypeOrigin::TrueType),1)
  |(Some(crate::model::style::FontTypeOrigin::HwpFont),2)){
  value["hwpx_type_origin"]=Value::Null;
 }
 Ok(value)
}
fn char_evidence(core:&DocumentCore,id:u32)->Result<Value,String>{
 let cs=core.document.doc_info.char_shapes.get(id as usize).ok_or_else(||fail("invalid character reference"))?;
 if cs.raw_data.as_ref().is_some_and(|b| ![68,70,74].contains(&b.len())){return Err(fail("opaque character record tail"));}
 if cs.attr&0x8002_0000!=0||(cs.attr>>2)&3==2||cs.shadow_type>2||cs.outline_type>6||((cs.attr>>18)&7)>1{return Err(fail("unknown character flags"));}
 let mut value=encoded(cs)?;remove(&mut value,&["raw_data","font_ids","border_fill_id","attr"]);
 let mut fonts=Vec::new();for (lang,id) in cs.font_ids.iter().enumerate(){let f=core.document.doc_info.font_faces.get(lang).and_then(|a|a.get(*id as usize)).ok_or_else(||fail("invalid language font reference"))?;if f.is_embedded||f.resolved_bin_data_id.is_some()||f.subst_font.is_some()||f.alt_name.is_some(){return Err(fail("embedded font identity not observed"));}if let Some(raw)=&f.raw_data{let expected=1+2+f.name.encode_utf16().count()*2+if f.type_info.is_some(){10}else{0}+f.default_name.as_ref().map(|n|2+n.encode_utf16().count()*2).unwrap_or(0);if raw.len()!=expected||raw.first().is_none_or(|b|b&!0x63!=0){return Err(fail("opaque font record attributes"));}}fonts.push(font_evidence(f)?);}
 value["fonts"]=json!(fonts);value["border"]=border_evidence(core,cs.border_fill_id)?;
 value["resolved"]=serde_json::from_str(&core.build_char_properties_json_by_id(id.try_into().map_err(|_|fail("character ID overflow"))?)).map_err(|_|fail("invalid resolved character properties"))?;
 // Resolved properties include border/fill meaning; never keep reindexable resource IDs.
 remove(&mut value["resolved"],&["charShapeId","borderFillId"]);Ok(value)
}
fn para_evidence(core:&DocumentCore,p:&Paragraph,section:usize)->Result<Value,String>{
 let ps=core.document.doc_info.para_shapes.get(p.para_shape_id as usize).ok_or_else(||fail("invalid paragraph reference"))?;
 if ps.raw_data.as_ref().is_some_and(|b| ![42,46,54,58].contains(&b.len())){return Err(fail("opaque paragraph shape tail"));}
 if !matches!(ps.head_type,HeadType::None){return Err(fail("list resource graph not observed"));}
 if ((ps.attr1>>2)&7)>5||ps.attr2&3==3{return Err(fail("reserved paragraph wrapping flags"));}
 let mut v=encoded(ps)?;remove(&mut v,&["raw_data","tab_def_id","border_fill_id","numbering_id","hwpx_plain_para_margin","hwpx_plain_para_margin_physical"]);
 // Remove only bits materialized from the explicit semantic properties below.
 v["attr1"]=json!(ps.attr1 & !0x0f80_001f);if ps.break_latin_word.is_none(){v["break_latin_word"]=json!("KEEP_WORD");}
 let tabs=core.document.doc_info.tab_defs.get(ps.tab_def_id as usize).ok_or_else(||fail("invalid tab reference"))?;if tabs.attr&!3!=0||tabs.raw_data.as_ref().is_some_and(|b|b.len()!=8+tabs.tabs.len()*8||b[8..].chunks_exact(8).any(|entry|entry[6..8].iter().any(|v|*v!=0))){return Err(fail("opaque tab definition flags or reserved bytes"));}let mut td=encoded(tabs)?;remove(&mut td,&["raw_data","attr"]);v["tabs"]=td;v["border"]=border_evidence(core,ps.border_fill_id)?;
 v["resolved"]=serde_json::from_str(&core.build_para_properties_json(p.para_shape_id,section)).map_err(|_|fail("invalid resolved paragraph properties"))?;remove(&mut v["resolved"],&["paraShapeId","borderFillId"]);Ok(v)
}
fn paragraph(core:&DocumentCore,p:&Paragraph,section:usize,characters:&mut usize,runs:&mut usize)->Result<Value,String>{
 let len=p.text.chars().count();*characters+=len;if *characters>100000||p.char_offsets.len()!=len{return Err(fail("invalid or oversized story text"));}
 if !p.field_ranges.is_empty()||!p.orphan_field_ends.is_empty()||!p.range_tags.is_empty()||!p.title_marks.is_empty()||!p.markpen_marks.is_empty()||p.ctrl_data_records.iter().any(Option::is_some){return Err(fail("field or opaque paragraph marker"));}
 if p.controls.iter().any(|c|!matches!(c,Control::AutoNumber(_))){return Err(fail("nested or unsupported story object"));}
 let mut metadata=encoded(p)?;remove(&mut metadata,&["text","char_count","char_count_msb","char_offsets","char_shapes","line_segs","hwpx_axis_shift","layout_only_fill_lines","has_para_text","para_shape_id","style_id","controls","raw_header_extra"]);
 // None slots are positional parser bookkeeping, not CtrlData payloads. Some was rejected above.
 metadata["ctrl_data_records"]=json!([]);metadata["control_mask"]=json!(p.control_mask & !generated_mask(p));
 let extra=&p.raw_header_extra;if ![0,10,12].contains(&extra.len())||(extra.len()==12&&extra[10..].iter().any(|b|*b!=0)){return Err(fail("unknown paragraph identity/tracking suffix"));}metadata["identity"]=if extra.len()>=10{clean_identity(&extra[6..10])?}else{clean_identity(&[])?};
 let style=core.document.doc_info.styles.get(p.style_id as usize).ok_or_else(||fail("invalid named style reference"))?;if let Some(b)=&style.raw_data{let len=12+2*(style.local_name.encode_utf16().count()+style.english_name.encode_utf16().count());if b.len()!=len&&(b.len()!=len+2||b[len..].iter().any(|v|*v!=0)){return Err(fail("opaque style record tail"));}}let mut style_meta=encoded(style)?;remove(&mut style_meta,&["raw_data","next_style_id","para_shape_id","char_shape_id"]);let next=core.document.doc_info.styles.get(style.next_style_id as usize).ok_or_else(||fail("invalid next-style reference"))?;style_meta["next"]=json!({"localName":next.local_name,"englishName":next.english_name,"kind":next.style_type});
 let mut style_p=Paragraph::default();style_p.para_shape_id=style.para_shape_id;style_meta["paragraph"]=para_evidence(core,&style_p,section)?;style_meta["characters"]=char_evidence(core,style.char_shape_id as u32)?;
 let first=p.char_offsets.first().copied().unwrap_or(0);for (i,run) in p.char_shapes.iter().enumerate(){if core.document.doc_info.char_shapes.get(run.char_shape_id as usize).is_none()||run.start_pos>=p.char_count.max(1)||(i>0&&p.char_shapes[i-1].start_pos>=run.start_pos)||(i==0&&len>0&&run.start_pos>first){return Err(fail("invalid character run order, gap or reference"));}}
 let id_at=|offset:usize|if p.char_shapes.is_empty(){Some(0)}else{p.char_shape_id_at(offset)};
 let mut segments=Vec::new();let mut start=0;while start<len{let id=id_at(start).ok_or_else(||fail("missing character run"))?;let mut end=start+1;while end<len&&id_at(end)==Some(id){end+=1;}*runs+=1;if *runs>4096{return Err(fail("oversized character runs"));}segments.push(json!({"start":start,"end":end,"properties":char_evidence(core,id)?}));start=end;}
 let empty=if len==0{Some(char_evidence(core,p.char_shapes.first().map(|r|r.char_shape_id).unwrap_or(0))?)}else{None};
 Ok(json!({"text":p.text,"paragraph":para_evidence(core,p,section)?,"characters":segments,"emptyCharacters":empty,"endCharacters":char_evidence(core,id_at(len).ok_or_else(||fail("missing end character format"))?)?,"metadata":metadata,"style":style_meta,"controls":p.controls}))
}
fn observe(core:&DocumentCore,r:&Request)->Result<Value,String>{
 if core.document.header.encrypted||core.document.header.distribution||core.document.provenance.hwp3_lineage{return Err(fail("protected or legacy source"));}
 let sec=core.document.sections.get(r.section).ok_or_else(||fail("invalid section"))?;
 let mut owners=Vec::new();for (pi,p) in sec.paragraphs.iter().enumerate(){for (ci,c) in p.controls.iter().enumerate(){let matches=match c{Control::Header(h)=>r.kind=="header"&&r.apply_to==Some(crate::document_core::header_footer_apply_to_u8(h.apply_to)),Control::Footer(h)=>r.kind=="footer"&&r.apply_to==Some(crate::document_core::header_footer_apply_to_u8(h.apply_to)),Control::Footnote(_)=>r.kind=="footnote"&&r.parent==Some(pi)&&r.control==Some(ci),Control::Endnote(_)=>r.kind=="endnote"&&r.parent==Some(pi)&&r.control==Some(ci),_=>false};if matches{owners.push((pi,ci,c));}}}
 if owners.len()!=1{return Err(fail("missing or duplicate logical owner"));}let (parent,control,owner)=owners[0];
 let (paras,identity)=match owner{Control::Header(h)=>{if h.raw_attr&!3!=0||h.raw_attr&3==3||h.list_attr!=0||h.text_ref!=0||h.num_ref!=0{return Err(fail("unknown header attributes"));}(&h.paragraphs,clean_identity(&h.raw_ctrl_extra)?)},Control::Footer(h)=>{if h.raw_attr&!3!=0||h.raw_attr&3==3||h.list_attr!=0||h.text_ref!=0||h.num_ref!=0{return Err(fail("unknown footer attributes"));}(&h.paragraphs,clean_identity(&h.raw_ctrl_extra)?)},Control::Footnote(n)=>{if n.list_header_property!=0{return Err(fail("unknown note list flags"));}(&n.paragraphs,if n.instance_id==0{clean_identity(&[])?}else{clean_identity(&n.instance_id.to_le_bytes())?})},Control::Endnote(n)=>{if n.list_header_property!=0{return Err(fail("unknown note list flags"));}(&n.paragraphs,if n.instance_id==0{clean_identity(&[])?}else{clean_identity(&n.instance_id.to_le_bytes())?})},_=>return Err(fail("invalid owner"))};
 if paras.is_empty()||paras.len()>1024{return Err(fail("invalid story paragraph count"));}
 let mut owner_meta=encoded(owner)?;let object=owner_meta.as_object_mut().and_then(|o|o.values_mut().next()).ok_or_else(||fail("invalid owner shape"))?;remove(object,&["paragraphs","raw_ctrl_extra","instance_id"]);if let Some(attr)=object.get("raw_attr").and_then(Value::as_u64){object["raw_attr"]=json!(attr & !3);}
 let mut chars=0;let mut runs=0;let mut paragraphs=paras.iter().map(|p|paragraph(core,p,r.section,&mut chars,&mut runs)).collect::<Result<Vec<_>,_>>()?;
 let mut story_ids=Vec::new();for p in &mut paragraphs{let metadata=p.get_mut("metadata").and_then(Value::as_object_mut).ok_or_else(||fail("invalid story provenance"))?;story_ids.push(metadata.remove("identity").ok_or_else(||fail("missing story provenance"))?);}
 let mut context_ids=Vec::new();let mut context=Vec::new();for pi in parent.saturating_sub(1)..=(parent+1).min(sec.paragraphs.len()-1){let p=&sec.paragraphs[pi];if p.text.chars().count()>100000{return Err(fail("oversized adjacent host"));}if p.ctrl_data_records.iter().any(Option::is_some){return Err(fail("opaque adjacent control payload"));}let mut kinds=Vec::new();for (ci,c) in p.controls.iter().enumerate(){if pi==parent&&ci==control{kinds.push(json!({"kind":r.kind,"target":true}));continue;}match c{Control::SectionDef(s) if s.master_pages.is_empty()=>{if s.flags&!0x0038_031f!=0||s.page_num_type>2||s.text_direction>1||!s.extra_child_records.is_empty()||s.raw_ctrl_extra.iter().any(|v|*v!=0)||s.memo_shape_id!=0{return Err(fail("unreadable surrounding section flags"));}let properties:Value=serde_json::from_str(&core.get_section_def_native(r.section).map_err(|_|fail("section meaning unreadable"))?).map_err(|_|fail("invalid section meaning"))?;kinds.push(json!({"kind":"section","properties":properties,"lineGrid":s.line_grid,"charGrid":s.char_grid,"textDirection":s.text_direction,"firstBorder":s.first_page_border,"firstFill":s.first_page_fill}));},Control::ColumnDef(column)=>{if column.raw_attr&!0x1fff!=0||column.raw_attr&3==3||(column.raw_attr>>10)&3==3||!column.same_width||column.proportional_widths{return Err(fail("unreadable surrounding column graph"));}let mut v=encoded(column)?;remove(&mut v,&["raw_attr"]);kinds.push(json!({"kind":"column","properties":v}));},_=>return Err(fail("adjacent object semantic graph not observed"))};}
 let mut detached=p.clone();detached.controls.clear();detached.ctrl_data_records.clear();detached.control_mask &= !generated_mask(p);let mut host=paragraph(core,&detached,r.section,&mut chars,&mut runs)?;let identity=host.get_mut("metadata").and_then(Value::as_object_mut).and_then(|o|o.remove("identity")).ok_or_else(||fail("missing host provenance"))?;context_ids.push(json!({"paragraph":pi,"identity":identity}));
 context.push(json!({"paragraph":pi,"text":p.text,"paragraphProperties":para_evidence(core,p,r.section)?,"host":host,"controlKinds":kinds}));}
 Ok(json!({"version":1,"scope":"cursor-owner-and-neighbor-paragraphs","complete":true,"identityKnown":true,"identity":identity,"kind":r.kind,"section":r.section,"parent":parent,"control":control,"applyTo":r.apply_to,"owner":owner_meta,"context":context,"paragraphs":paragraphs,"provenance":{"kind":"generated-paragraph-record-identities","story":story_ids,"context":context_ids}}))
}
#[wasm_bindgen]
impl HwpDocument{
 /// Exact read-only semantic story graph for guarded session restoration.
 #[wasm_bindgen(js_name=getSessionStoryEvidence)]
 pub fn get_session_story_evidence(&self,options_json:&str)->String{
  let result=(||{let r:Request=serde_json::from_str(options_json).map_err(|_|fail("invalid story request"))?;if !matches!(r.kind.as_str(),"header"|"footer"|"footnote"|"endnote")||((r.kind=="header"||r.kind=="footer")&&(r.apply_to.is_none()||r.apply_to.unwrap()>2||r.parent.is_some()||r.control.is_some()))||((r.kind=="footnote"||r.kind=="endnote")&&(r.parent.is_none()||r.control.is_none()||r.apply_to.is_some())){return Err(fail("invalid story target"));}observe(&self.core,&r)})();
  match result{Ok(v)=>v.to_string(),Err(reason)=>json!({"version":1,"complete":false,"reason":reason}).to_string()}
 }
}
