//! Closed plain-root xs:string / ordinary ClickHere leaf editor for native HWT.
//! No OS IO, mutable live application document, template generation or general HWT claim.
use std::collections::{BTreeMap,BTreeSet};
use crate::{document_core::DocumentCore,model::control::{Control,FieldType}};
use quick_xml::{events::Event,reader::NsReader,name::ResolveResult};
use sha2::{Digest,Sha256};
pub type Result<T> = std::result::Result<T,String>;
pub fn hash(b:&[u8])->String{Sha256::digest(b).iter().map(|v|format!("{v:02x}")).collect()}
fn fail<T>(s:&str)->Result<T>{Err(s.into())}
const XS:&str="http://www.w3.org/2001/XMLSchema";
const HWP:&str="http://www.haansoft.com/HWP";
pub const FIELD_INFO:&str="CreateField:int:1 FieldType:int:0 NextFieldDirection:int:1 ChoiceDefault:int:0 CopyCreateType:int:0 InstID:uint:0 NextGroupDirection:int:1";
#[derive(Debug,Clone)]struct Node{ns:String,name:String,attrs:BTreeMap<String,String>,children:Vec<Node>}
fn tree(xml:&str)->Result<Node>{
 let mut r=NsReader::from_str(xml);let mut stack:Vec<Node>=Vec::new();let mut root=None;let mut count=0;
 loop{let event=r.read_event().map_err(|_|"XML_PARSE")?;let empty=matches!(&event,Event::Empty(_));match event{
  Event::Start(e)|Event::Empty(e)=>{
   count+=1;if count>128||stack.len()>8{return fail("XML_BUDGET");}
   let (ns,local)=r.resolver().resolve_element(e.name());
   let ns=match ns{ResolveResult::Unbound=>String::new(),ResolveResult::Bound(v)=>v.as_ref().to_string(),_=>return fail("XML_NS")};
   let mut node=Node{ns,name:local.as_ref().to_string(),attrs:BTreeMap::new(),children:vec![]};
   for attr in e.attributes(){let a=attr.map_err(|_|"XML_ATTR")?;let key=a.key.as_ref().to_string();let value=a.normalized_value(quick_xml::XmlVersion::Implicit1_0).map_err(|_|"XML_ATTR")?.into_owned();
    if key.starts_with("xmlns"){
     if !stack.is_empty()||!((key=="xmlns:xs"&&value==XS)||(key=="xmlns:h"&&value==HWP)){return fail("XML_NS_PROFILE");}continue;
    }
    if node.attrs.insert(key,value).is_some(){return fail("XML_DUP_ATTR");}
   }
   if empty{if let Some(p)=stack.last_mut(){p.children.push(node);}else if root.replace(node).is_some(){return fail("XML_ROOT");}}
   else{stack.push(node);}
  },Event::End(_)=>{let node=stack.pop().ok_or("XML_END")?;if let Some(p)=stack.last_mut(){p.children.push(node);}else if root.replace(node).is_some(){return fail("XML_ROOT");}},
  Event::Text(e)=>{if !e.as_ref().trim().is_empty(){return fail("XML_VALUE_NOT_MAPPING");}},
  Event::Decl(_)|Event::Comment(_)=>{},Event::Eof=>break,_=>return fail("XML_UNSUPPORTED")
 }}
 if !stack.is_empty(){return fail("XML_END");}root.ok_or("XML_ROOT".into())
}
fn exact(n:&Node,name:&str,ns:&str,attrs:&[&str],children:usize)->Result<()> {
 if n.name!=name||n.ns!=ns||n.attrs.keys().map(String::as_str).collect::<BTreeSet<_>>()!=attrs.iter().copied().collect()||n.children.len()!=children{return fail("SCHEMA_PROFILE");}Ok(())
}
fn simple_name(s:&str)->bool{!s.is_empty()&&s.len()<=32&&s.bytes().enumerate().all(|(i,c)|c==b'_'||c.is_ascii_alphabetic()||(i>0&&c.is_ascii_digit()))}
/// Requires a complete closed schema/mapping profile, never a successful subset.
fn leaves(schema:&str,mapping:&str)->Result<Vec<String>>{
 let s=tree(schema)?;exact(&s,"schema",XS,&[],1)?;
 let root=&s.children[0];exact(root,"element",XS,&["name"],1)?;let name=&root.attrs["name"];if !simple_name(name){return fail("SCHEMA_NAME");}
 let complex=&root.children[0];exact(complex,"complexType",XS,&[],1)?;
 let seq=&complex.children[0];if seq.children.is_empty()||seq.children.len()>32{return fail("SCHEMA_BUDGET");}exact(seq,"sequence",XS,&[],seq.children.len())?;
 let m=tree(mapping)?;exact(&m,"XMLELEMENT","",&["Name","SchemaXPath"],seq.children.len())?;
 if m.attrs["Name"]!=*name||m.attrs["SchemaXPath"]!="/xs:schema/xs:element[position()=1]"{return fail("MAPPING_ROOT");}
 let mut result=Vec::new();let mut seen=BTreeSet::new();
 for(i,(s,m))in seq.children.iter().zip(&m.children).enumerate(){
  exact(s,"element",XS,&["name","type","h:FieldInfo"],0)?;exact(m,"XMLELEMENT","",&["Name","SchemaXPath"],0)?;
  let name=&s.attrs["name"];if !simple_name(name)||s.attrs["type"]!="xs:string"||s.attrs["h:FieldInfo"]!=FIELD_INFO{return fail("SCHEMA_LEAF_PROFILE");}
  let path=format!("/xs:schema/xs:element[position()=1]/xs:complexType[position()=1]/xs:sequence[position()=1]/xs:element[position()={}]",i+1);
  if m.attrs["Name"]!=*name||m.attrs["SchemaXPath"]!=path||!seen.insert(name.clone()){return fail("MAPPING_AMBIGUOUS");}result.push(name.clone());
 }Ok(result)
}

fn container_streams(bytes:&[u8])->Result<BTreeMap<String,Vec<u8>>>{
 use crate::parser::cfb_reader::CfbReader;
 let mut reader=CfbReader::open(bytes).map_err(|_|"HWT_CFB")?;
 let paths=reader.list_streams();if paths.len()>512{return fail("HWT_STREAM_BUDGET");}
 let mut seen=BTreeSet::new();let mut out=BTreeMap::new();let mut total=0usize;
 for path in paths{
  if path.len()>512||!seen.insert(path.to_uppercase())||!reader.has_exact_stream_path(&path){return fail("HWT_STREAM_OWNER");}
  let data=if path=="/DocInfo"{reader.read_doc_info_limited(true,16*1024*1024)}else{reader.read_stream_raw_limited(&path,32*1024*1024)}.map_err(|_|"HWT_STREAM_READ_BUDGET")?;
  total=total.checked_add(data.len()).ok_or("HWT_STREAM_BUDGET")?;if total>64*1024*1024{return fail("HWT_STREAM_BUDGET");}
  if path.starts_with("/BodyText/"){
   if path!="/BodyText/Section0"{return fail("HWT_SECTION_PROFILE");}
   let body=reader.read_body_text_section_limited(0,true,16*1024*1024).map_err(|_|"HWT_BODY_BUDGET")?;
   let records=crate::parser::record::Record::read_all(&body).map_err(|_|"HWT_BODY_RECORD")?;
   if records.len()>4096{return fail("HWT_RECORD_BUDGET");}
   let mut consumed=0usize;
   use crate::parser::tags::*;
   for record in records{
    if !matches!(record.tag_id,HWPTAG_PARA_HEADER|HWPTAG_PARA_TEXT|HWPTAG_PARA_CHAR_SHAPE|HWPTAG_PARA_LINE_SEG|HWPTAG_CTRL_HEADER|HWPTAG_PAGE_DEF|HWPTAG_FOOTNOTE_SHAPE|HWPTAG_PAGE_BORDER_FILL|HWPTAG_CTRL_DATA){return fail("HWT_UNKNOWN_BODY_RECORD");}
    consumed=consumed.checked_add(4+if record.size>=0xfff{4}else{0}).and_then(|n|n.checked_add(record.data.len())).ok_or("HWT_BODY_BUDGET")?;
   }
   if consumed!=body.len(){return fail("HWT_BODY_TRAILING_BYTES");}
   out.insert(path,Vec::new());continue;
  }
  out.insert(path,data);
 }
 Ok(out)
}


fn body_records(bytes:&[u8])->Result<Vec<crate::parser::record::Record>>{
 let mut reader=crate::parser::cfb_reader::CfbReader::open(bytes).map_err(|_|"HWT_CFB")?;
 let body=reader.read_body_text_section_limited(0,true,16*1024*1024).map_err(|_|"HWT_BODY_BUDGET")?;
 crate::parser::record::Record::read_all(&body).map_err(|_|"HWT_BODY_RECORD".into())
}
fn body_projection(bytes:&[u8],edited:&BTreeSet<u32>)->Result<Vec<(u16,u16,Vec<u8>)>>{
 use crate::parser::tags::*;
 let mut out=Vec::new();let mut header:Option<Vec<u8>>=None;let mut counts=[0usize;3];let mut seen=[false;3];
 fn close(header:&Option<Vec<u8>>,counts:[usize;3],seen:[bool;3])->Result<()>{
  if let Some(h)=header{
   if !seen[0]||!seen[1]||(u32::from_le_bytes(h[0..4].try_into().unwrap())&0x7fff_ffff)as usize!=counts[0]||u16::from_le_bytes(h[12..14].try_into().unwrap())as usize!=counts[1]||u16::from_le_bytes(h[14..16].try_into().unwrap())!=0||u16::from_le_bytes(h[16..18].try_into().unwrap())as usize!=counts[2]{return fail("HWT_BODY_DECLARED_COUNTS");}
  }else{return fail("HWT_BODY_PARAGRAPH_OWNER");}Ok(())
 }
 for record in body_records(bytes)?{
  let mut data=record.data;
  match record.tag_id{
   HWPTAG_PARA_HEADER=>{
    if header.is_some(){close(&header,counts,seen)?;}
    if record.level!=0||data.len()<22||data.len()>64{return fail("HWT_PARA_HEADER_PROFILE");}
    header=Some(data.clone());counts=[0;3];seen=[false;3];
    let last=data[3]&0x80;data[0..4].fill(0);data[3]=last;data[12..14].fill(0);data[16..18].fill(0);
   },
   HWPTAG_PARA_TEXT|HWPTAG_PARA_CHAR_SHAPE|HWPTAG_PARA_LINE_SEG=>{
    if header.is_none()||record.level!=1{return fail("HWT_BODY_PARAGRAPH_OWNER");}
    let(index,size)=match record.tag_id{HWPTAG_PARA_TEXT=>(0,2),HWPTAG_PARA_CHAR_SHAPE=>(1,8),_=>(2,36)};
    if seen[index]||data.len()%size!=0{return fail("HWT_BODY_RECORD_PROFILE");}seen[index]=true;counts[index]=data.len()/size;data.clear();
   },
   HWPTAG_CTRL_HEADER=>{
    if data.len()<4{return fail("HWT_CONTROL_HEADER_PROFILE");}
    if u32::from_le_bytes(data[..4].try_into().unwrap())==FIELD_CLICKHERE{
     if data.len()<19{return fail("HWT_FIELD_HEADER_PROFILE");}
     let len=u16::from_le_bytes(data[9..11].try_into().unwrap())as usize;
     let at=11usize.checked_add(len.checked_mul(2).ok_or("HWT_FIELD_HEADER_PROFILE")?).ok_or("HWT_FIELD_HEADER_PROFILE")?;
     if at.checked_add(8)!=Some(data.len()){return fail("HWT_FIELD_HEADER_PROFILE");}
     let id=u32::from_le_bytes(data[at..at+4].try_into().unwrap());
     // Only the actually edited ClickHere may acquire the existing filled bit.
     if edited.contains(&id){data[5]&=0x7f;}
    }
   },_=>{}
  }
  out.push((record.tag_id,record.level,data));
 }
 close(&header,counts,seen)?;Ok(out)
}

fn body_preview(doc:&crate::model::document::Document)->Vec<u8>{
 let mut text=String::new();
 'sections:for section in &doc.sections{for paragraph in &section.paragraphs{
  let line=paragraph.text.trim_end_matches('\0');if line.is_empty(){continue;}text.push_str(line);text.push_str("\r\n");
  if text.chars().count()>=1000{text=text.chars().take(1000).collect();break 'sections;}
 }}text.encode_utf16().flat_map(u16::to_le_bytes).collect()
}
fn source_preview_is_derived(source:&[u8],raw:&[u8])->Result<bool>{
 if raw.len()>8192||raw.len()%2!=0{return fail("HWT_PREVIEW_BUDGET");}
 let units=raw.chunks_exact(2).map(|p|u16::from_le_bytes([p[0],p[1]])).collect::<Vec<_>>();
 let text=String::from_utf16(&units).map_err(|_|"HWT_PREVIEW_UTF16")?;
 if text.trim().is_empty(){return Ok(true);}
 let original=DocumentCore::from_bytes(source).map_err(|_|"HWT_PREVIEW_SOURCE")?;
 Ok(raw==body_preview(original.document()))
}
fn exact_container_preservation(source:&[u8],output:&[u8],current:&crate::model::document::Document)->Result<()> {
 let before=container_streams(source)?;let after=container_streams(output)?;
 if before.keys().collect::<Vec<_>>()!=after.keys().collect::<Vec<_>>(){return fail("HWT_CONTAINER_STREAM_SET");}
 for(path,original)in &before{
  let emitted=&after[path];if original==emitted{continue;}
  // Only a blank source preview or an exact preview of the SOURCE body is derived.
  // Reparse source independently: the edited current body must not grant source authority.
  if path!="/PrvText"||original.len()>8192||emitted.len()>8192||original.len()%2!=0{return fail("HWT_EXACT_CONTAINER_STREAMS");}
  if !source_preview_is_derived(source,original)?{return fail("HWT_PREVIEW_SOURCE_NOT_DERIVED");}
  let encoded=body_preview(current);
  if emitted!=&encoded{return fail("HWT_PREVIEW_DERIVATION");}
 }
 Ok(())
}

#[derive(Debug,Clone,PartialEq)]pub struct Binding{pub name:String,pub field_id:u32,pub paragraph:usize,pub value:String}
pub fn preflight(bytes:&[u8],doc:&DocumentCore)->Result<Vec<Binding>>{
 let read=crate::parser::xml_template::extract_hwt_xml_template(bytes)?;
 let names=leaves(&read.schema,&read.mapping)?;
 let d=doc.document();if d.header.flags!=0x21||d.sections.len()!=1||d.sections[0].paragraphs.len()>64{return fail("HWT_DOCUMENT_PROFILE");}
 if d.is_hwpx_variant||d.is_hwp3_variant||d.provenance.hwpx_lineage||d.provenance.hwp3_lineage||!d.hwpx_aux_entries.is_empty(){return fail("HWT_SOURCE_PROFILE");}
 if !d.sections[0].section_def.master_pages.is_empty()||!d.sections[0].section_def.extra_child_records.is_empty(){return fail("HWT_HIDDEN_STORY_UNSUPPORTED");}
 let mut ids=BTreeSet::new();let mut result=Vec::new();
 for(pi,p)in d.sections[0].paragraphs.iter().enumerate(){
  if p.controls.iter().filter(|c|matches!(c,Control::Field(_))).count()>1||p.field_ranges.len()!=p.controls.iter().filter(|c|matches!(c,Control::Field(_))).count(){return fail("FIELD_PARAGRAPH_OWNER_UNSUPPORTED");}
  if !p.range_tags.is_empty()||!p.title_marks.is_empty()||!p.markpen_marks.is_empty()||!p.tab_extended.is_empty(){return fail("HWT_TEXT_SIDECAR_UNSUPPORTED");}
  if !p.orphan_field_ends.is_empty(){return fail("FIELD_CROSS_PARAGRAPH");}
  for(ci,c)in p.controls.iter().enumerate(){match c{
   Control::SectionDef(s)=>{if pi!=0||!s.master_pages.is_empty()||!s.extra_child_records.is_empty(){return fail("UNEXPECTED_SECTION_CONTROL");}},
   Control::ColumnDef(_)=>{if pi!=0{return fail("UNEXPECTED_SECTION_CONTROL");}},
   Control::Field(f)=>{
    if f.field_type!=FieldType::ClickHere||f.field_id==0||!ids.insert(f.field_id)||!f.is_editable_in_form(){return fail("FIELD_TYPE_ID_PERMISSION");}
    let name=f.ctrl_data_name.as_ref().ok_or("FIELD_EXACT_NAME_REQUIRED")?;
    if f.field_name()!=Some(name)||!names.contains(name)||result.iter().any(|b:&Binding|&b.name==name){return fail("FIELD_NAME_AMBIGUOUS");}
    let ranges=p.field_ranges.iter().filter(|r|r.control_idx==ci).collect::<Vec<_>>();
    if ranges.len()!=1||ranges[0].inner_slot_count!=0||ranges[0].start_char_idx>ranges[0].end_char_idx{return fail("FIELD_GROUP_UNSUPPORTED");}
    let value:String=p.text.chars().skip(ranges[0].start_char_idx).take(ranges[0].end_char_idx-ranges[0].start_char_idx).collect();
    if ranges[0].end_char_idx>p.text.chars().count()||value.chars().count()>256||value.chars().any(char::is_control){return fail("FIELD_VALUE_PROFILE");}
    result.push(Binding{name:name.clone(),field_id:f.field_id,paragraph:pi,value});
   },_=>return fail("FORM_OBJECT_OR_OTHER_CONTROL_UNSUPPORTED")
  }}
 }
 if result.len()!=names.len(){return fail("FIELD_MAPPING_INCOMPLETE");}Ok(result)
}
#[derive(Debug,Clone)]pub struct Lease{pub instance:u64,pub revision:u64,pub source_sha:String,pub field_id:u32,pub old_value:String}
pub struct Session{doc:DocumentCore,source:Vec<u8>,instance:u64,revision:u64,undo:Vec<(u32,u32)>,redo:Vec<(u32,u32)>,edited_field_ids:BTreeSet<u32>}
fn edit_delta(before:&crate::model::document::Document,after:&DocumentCore,source:&[u8],id:u32,value:&str)->Result<()> {
 let mut a=DocumentCore::new_empty();a.set_document(before.clone());let original=preflight(source,&a)?;let mut expected=original.clone();let target=expected.iter_mut().find(|b|b.field_id==id).ok_or("DELTA_TARGET")?;target.value=value.into();
 if preflight(source,after)?!=expected{return fail("EDIT_OTHER_FIELD_CHANGED");}
 let b=after.document();if before.extra_streams!=b.extra_streams||before.header.raw_data!=b.header.raw_data||crate::serializer::doc_info::serialize_doc_info(&before.doc_info,&before.doc_properties)!=crate::serializer::doc_info::serialize_doc_info(&b.doc_info,&b.doc_properties){return fail("EDIT_RESOURCE_CHANGED");}
 for(old,new)in before.sections[0].paragraphs.iter().zip(&b.sections[0].paragraphs){
  let target=old.controls.iter().enumerate().find_map(|(i,c)|if let Control::Field(f)=c{(f.field_id==id).then_some(i)}else{None});
  let mut controls=old.controls.clone();let mut expected_text=old.text.clone();let mut changed=None;
  if let Some(ci)=target{let range=old.field_ranges.iter().find(|r|r.control_idx==ci).ok_or("DELTA_RANGE")?;let chars=old.text.chars().collect::<Vec<_>>();expected_text=chars[..range.start_char_idx].iter().collect::<String>()+value+&chars[range.end_char_idx..].iter().collect::<String>();changed=Some((range.start_char_idx,range.end_char_idx));if !value.is_empty(){if let Control::Field(f)=&mut controls[ci]{f.properties|=1<<15;}}}
  if expected_text!=new.text||serde_json::to_value(controls).unwrap()!=serde_json::to_value(&new.controls).unwrap()||old.para_shape_id!=new.para_shape_id||old.style_id!=new.style_id{return fail("EDIT_MODEL_DELTA");}
  let oldlen=old.text.chars().count();let inserted=value.chars().count();for i in 0..oldlen{let mapped=match changed{Some((start,end))if i>=start&&i<end=>None,Some((start,end))if i>=end=>Some(i-end+start+inserted),_=>Some(i)};if let Some(j)=mapped{if old.char_shape_id_at(i)!=new.char_shape_id_at(j){return fail("EDIT_EXISTING_STYLE_ID_CHANGED");}}}
  if let Some((start,_))=changed{let style=old.char_shape_id_at(start);for i in start..start+inserted{if new.char_shape_id_at(i)!=style{return fail("EDIT_INSERTED_STYLE_ID_CHANGED");}}}
 }Ok(())
}
impl Session{
 pub fn open(bytes:&[u8],instance:u64)->Result<Self>{crate::parser::xml_template::extract_hwt_xml_template(bytes)?;container_streams(bytes)?;let doc=DocumentCore::from_bytes(bytes).map_err(|_|"HWT_OPEN")?;preflight(bytes,&doc)?;
 // Refuse an unowned source representation before exposing an editable session.
 let baseline=doc.export_hwp_with_adapter_snapshot_with_report().map_err(|_|"HWT_SOURCE_EXPORT")?;
 if !baseline.content_loss().is_empty(){return fail("HWT_SOURCE_CONTENT_LOSS");}
 let source_records=body_records(bytes)?;let baseline_records=body_records(baseline.bytes())?;
 if source_records.len()!=baseline_records.len()||source_records.iter().zip(&baseline_records).any(|(a,b)|a.tag_id!=b.tag_id||a.level!=b.level||a.data!=b.data){return fail("HWT_SOURCE_RAW_OWNER");}
 body_projection(bytes,&BTreeSet::new())?;
 Ok(Self{doc,source:bytes.to_vec(),instance,revision:0,undo:vec![],redo:vec![],edited_field_ids:BTreeSet::new()})}
 pub fn document(&self)->&DocumentCore{&self.doc}
 pub fn undo(&mut self)->Result<()>{let pair=self.undo.pop().ok_or("NO_UNDO")?;self.doc.restore_snapshot_native(pair.0).map_err(|_|"UNDO_FAILED")?;self.redo.push(pair);self.revision+=1;Ok(())}
 pub fn redo(&mut self)->Result<()>{let pair=self.redo.pop().ok_or("NO_REDO")?;self.doc.restore_snapshot_native(pair.1).map_err(|_|"REDO_FAILED")?;self.undo.push(pair);self.revision+=1;Ok(())}
 pub fn lease(&self,name:&str)->Result<Lease>{let b=preflight(&self.source,&self.doc)?.into_iter().find(|b|b.name==name).ok_or("FIELD_NOT_FOUND")?;Ok(Lease{instance:self.instance,revision:self.revision,source_sha:hash(&self.source),field_id:b.field_id,old_value:b.value})}
 pub fn edit(&mut self,lease:&Lease,value:&str)->Result<()> {
  if lease.instance!=self.instance||lease.revision!=self.revision||lease.source_sha!=hash(&self.source){return fail("STALE_DOCUMENT_LEASE");}
  if value.chars().count()>256||value.chars().any(char::is_control){return fail("VALUE_PROFILE");}
  if self.undo.len()+self.redo.len()>=32{return fail("HISTORY_BUDGET");}
  let b=preflight(&self.source,&self.doc)?.into_iter().find(|b|b.field_id==lease.field_id).ok_or("STALE_FIELD")?;
  if b.value!=lease.old_value||b.value==value{return fail("STALE_VALUE_OR_NOOP");}
  let model_before=self.doc.document().clone();let before=self.doc.save_snapshot_native();
  let result=self.doc.set_field_value_by_id(lease.field_id,value).map_err(|_|"FIELD_EDIT_FAILED".to_string()).and_then(|_|edit_delta(&model_before,&self.doc,&self.source,lease.field_id,value));
  if let Err(e)=result{self.doc.restore_snapshot_native(before).map_err(|_|"ROLLBACK_FAILED")?;self.doc.discard_snapshot_native(before);return Err(e.into());}
  let after=self.doc.save_snapshot_native();for(a,b)in self.redo.drain(..){self.doc.discard_snapshot_native(a);self.doc.discard_snapshot_native(b);}self.undo.push((before,after));self.edited_field_ids.insert(lease.field_id);self.revision+=1;Ok(())
 }
 /// Returns bytes only after same-format and strict post-write evidence checks.
 /// The caller still owns actual safe OS writing; this candidate never writes files.
 pub fn export_checked(&self)->Result<Vec<u8>>{
  let expected=preflight(&self.source,&self.doc)?;
  // The normal adapter snapshot still owns all body lowering. Only a proven
  // source-derived preview is regenerated on this isolated export clone.
  let mut snapshot=self.doc.prepare_hwp_export_snapshot().document().clone();
  if let Some(raw)=container_streams(&self.source)?.get("/PrvText"){
   if source_preview_is_derived(&self.source,raw)?{
    let encoded=body_preview(self.doc.document());
    let units=encoded.chunks_exact(2).map(|p|u16::from_le_bytes([p[0],p[1]])).collect::<Vec<_>>();
    snapshot.preview.get_or_insert_with(Default::default).text=Some(String::from_utf16(&units).map_err(|_|"HWT_PREVIEW_UTF16")?);
   }
  }
  let output=crate::serializer::serialize_document_with_report(&snapshot).map_err(|_|"HWT_EXPORT")?;
  if !output.content_loss().is_empty(){return fail("HWT_CONTENT_LOSS");}
  let bytes=output.into_bytes();exact_container_preservation(&self.source,&bytes,self.doc.document())?;if body_projection(&self.source,&self.edited_field_ids)?!=body_projection(&bytes,&self.edited_field_ids)?{return fail("HWT_EXACT_BODY_STRUCTURE");}let reopened=DocumentCore::from_bytes(&bytes).map_err(|_|"HWT_REOPEN")?;
  if preflight(&bytes,&reopened)?!=expected{return fail("HWT_FIELD_ROUNDTRIP");}
  let before=self.doc.document();let after=reopened.document();
  if before.header.flags!=after.header.flags||before.header.raw_data!=after.header.raw_data||before.extra_streams!=after.extra_streams{return fail("HWT_RAW_STREAM_PRESERVATION");}
  if crate::serializer::doc_info::serialize_doc_info(&before.doc_info,&before.doc_properties)!=crate::serializer::doc_info::serialize_doc_info(&after.doc_info,&after.doc_properties){return fail("HWT_RESOURCE_PRESERVATION");}
  if before.sections[0].paragraphs.len()!=after.sections[0].paragraphs.len(){return fail("HWT_PARAGRAPH_COUNT");}
  for(a,b)in before.sections[0].paragraphs.iter().zip(&after.sections[0].paragraphs){
   if a.text!=b.text||a.para_shape_id!=b.para_shape_id||a.style_id!=b.style_id||serde_json::to_value(&a.char_shapes).unwrap()!=serde_json::to_value(&b.char_shapes).unwrap()||serde_json::to_value(&a.controls).unwrap()!=serde_json::to_value(&b.controls).unwrap()||serde_json::to_value(&a.field_ranges).unwrap()!=serde_json::to_value(&b.field_ranges).unwrap(){return fail("HWT_FIELD_AND_STYLE_METADATA");}
  }
  if self.doc.page_count()!=reopened.page_count(){return fail("HWT_PAGES");}
  for page in 0..self.doc.page_count(){for pair in [(self.doc.get_page_text_layout_native(page),reopened.get_page_text_layout_native(page)),(self.doc.get_page_control_layout_native(page),reopened.get_page_control_layout_native(page))]{
   let a:serde_json::Value=serde_json::from_str(&pair.0.map_err(|_|"LAYOUT_READ")?).map_err(|_|"LAYOUT_JSON")?;
   let b:serde_json::Value=serde_json::from_str(&pair.1.map_err(|_|"LAYOUT_READ")?).map_err(|_|"LAYOUT_JSON")?;
   if a!=b{return fail("HWT_LAYOUT_EXACT");}
  }}Ok(bytes)
 }
}


#[derive(serde::Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct EditRequest {source_sha256:String,field_id:u32,original_text:String,text:String}
fn bounded(bytes:&[u8])->Result<()> {if bytes.is_empty()||bytes.len()>32*1024*1024{return fail("HWT_SIZE_BUDGET");}Ok(())}
pub fn inspect_native(bytes:&[u8])->Result<String>{
 bounded(bytes)?;let session=Session::open(bytes,1)?;let fields=preflight(bytes,session.document())?;
 serde_json::to_string(&serde_json::json!({"version":1,"profile":"plain-root-string-clickhere-v1","sourceSha256":hash(bytes),"fields":fields.iter().map(|b|serde_json::json!({"name":b.name,"fieldId":b.field_id,"paragraph":b.paragraph,"value":b.value})).collect::<Vec<_>>()})).map_err(|_|"HWT_RESPONSE".into())
}
pub fn edit_native(bytes:&[u8],request:&str)->Result<Vec<u8>>{
 bounded(bytes)?;if request.len()>8192{return fail("HWT_REQUEST_BUDGET");}
 let r:EditRequest=serde_json::from_str(request).map_err(|_|"HWT_REQUEST")?;
 if r.source_sha256!=hash(bytes){return fail("STALE_DOCUMENT_LEASE");}
 let mut session=Session::open(bytes,1)?;let field=preflight(bytes,session.document())?.into_iter().find(|b|b.field_id==r.field_id).ok_or("FIELD_NOT_FOUND")?;
 if field.value!=r.original_text{return fail("STALE_VALUE_OR_NOOP");}
 let lease=session.lease(&field.name)?;session.edit(&lease,&r.text)?;session.export_checked()
}
#[wasm_bindgen::prelude::wasm_bindgen(js_name=inspectHwtLeafDocument)]
pub fn inspect_hwt_leaf_document(bytes:&[u8])->std::result::Result<String,wasm_bindgen::JsValue>{inspect_native(bytes).map_err(|e|wasm_bindgen::JsValue::from_str(&e))}
#[wasm_bindgen::prelude::wasm_bindgen(js_name=editHwtLeafDocument)]
pub fn edit_hwt_leaf_document(bytes:&[u8],request:&str)->std::result::Result<Vec<u8>,wasm_bindgen::JsValue>{edit_native(bytes,request).map_err(|e|wasm_bindgen::JsValue::from_str(&e))}
