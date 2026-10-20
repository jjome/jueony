use rhwp::{DocumentCore,model::control::Control};
use sha2::{Digest,Sha256};
use serde_json::{Value,json};
use std::path::{Path,PathBuf};
#[derive(Clone,Copy)]struct Case{name:&'static str,tables:usize,interleave:bool,columns:u16,unequal:bool,short_page:bool,offset:i32,relative:rhwp::model::shape::VertRelTo,tac:bool,overlap:bool,oversize:bool}
fn cases()->Vec<Case>{use rhwp::model::shape::VertRelTo::{Page,Paper};[
 ("page-single",Page,1,false,false),("paper-single",Paper,1,false,false),
 ("page-equal2",Page,2,false,false),("paper-equal2",Paper,2,false,false),
 ("page-equal3",Page,3,false,false),("paper-equal3",Paper,3,false,false),
 ("page-unequal2",Page,2,true,false),("paper-unequal2",Paper,2,true,false),
 ("page-unequal3",Page,3,true,false),("paper-unequal3",Paper,3,true,false),
 ("page-unequal3-overlap",Page,3,true,true),("paper-unequal3-overlap",Paper,3,true,true),
 ].into_iter().map(|(name,relative,columns,unequal,overlap)|Case{name,relative,columns,unequal,overlap,offset:12000,short_page:false,oversize:false,tables:3,interleave:true,tac:false}).collect()}
fn hash(b:&[u8])->String{Sha256::digest(b).iter().map(|b|format!("{b:02x}")).collect()}
fn author(c:Case)->Vec<u8>{
 let mut d=DocumentCore::new_empty();d.create_blank_document_native().unwrap();d.insert_text_native(0,0,0,&"Own general-layout prefix. ".repeat(4)).unwrap();
 for n in 0..c.tables {let last=d.document().sections[0].paragraphs.len()-1;let end=d.document().sections[0].paragraphs[last].text.chars().count();d.create_table_native(0,last,end,2,1).unwrap();let host=d.document().sections[0].paragraphs.iter().rposition(|p|p.controls.iter().any(|c|matches!(c,Control::Table(_)))).unwrap();let ci=d.document().sections[0].paragraphs[host].controls.iter().position(|c|matches!(c,Control::Table(_))).unwrap();d.insert_text_in_cell_native(0,host,ci,0,0,0,&format!("Own table {n} first cell. ")).unwrap();d.insert_text_in_cell_native(0,host,ci,1,0,0,&format!("Own table {n} second cell. ")).unwrap();if c.interleave{let tail=d.document().sections[0].paragraphs.len()-1;d.insert_text_native(0,tail,0,&format!("Interleaved body {n}. ")).unwrap();}}
 let tail=d.document().sections[0].paragraphs.len()-1;let end=d.document().sections[0].paragraphs[tail].text.chars().count();d.insert_text_native(0,tail,end,&"Own trailing paragraph. ".repeat(if c.short_page{18}else{2})).unwrap();
 if c.columns>1 {d.set_column_def_native(0,c.columns,0,true,720).unwrap();}
 // This is fixture authoring only, before serialization/reopen/public edit.
 // No descriptor, CompletedRows, source seal, or implementation flag is authored.
 let mut doc=d.document().clone();
 if c.short_page{let page=&mut doc.sections[0].section_def.page_def;page.height=23000;page.margin_header=1000;page.margin_top=1000;page.margin_bottom=1000;page.margin_footer=1000;}
 for p in &mut doc.sections[0].paragraphs {for ctrl in &mut p.controls {match ctrl{
  Control::Table(t)=>{t.common.vert_rel_to=c.relative;t.common.treat_as_char=c.tac;t.common.allow_overlap=c.overlap;t.common.horizontal_offset=0;t.common.vertical_offset=c.offset as u32;
    if c.oversize{t.common.height=80000;for cell in &mut t.cells{cell.height=80000/u32::from(t.row_count);}}t.raw_ctrl_data.clear();t.raw_ctrl_seal=None;},
  Control::SectionDef(s)=>if c.short_page{let page=&mut s.page_def;page.height=23000;page.margin_header=1000;page.margin_top=1000;page.margin_bottom=1000;page.margin_footer=1000;},
  Control::ColumnDef(cd)=>if c.unequal{cd.same_width=false;cd.proportional_widths=true;cd.widths=if c.columns==2{vec![11000,20568]}else{vec![7000,11000,12368]};cd.gaps=vec![1200;c.columns.saturating_sub(1)as usize];cd.raw_attr=0;},_=>{}}}}
 for s in &mut doc.sections{s.raw_stream=None;}
 let a=rhwp::serializer::serialize_hwp_with_report(&doc).unwrap();assert_eq!(a.content_loss().len(),0,"authoring {} {}",c.name,a.content_loss().to_json());a.bytes().to_vec()
}
fn artifact(d:&DocumentCore,format:&str,pwd:&[u8])->Result<(Vec<u8>,usize),String>{let a=match(format,pwd.is_empty()){
 ("hwp",true)=>d.export_hwp_with_adapter_snapshot_with_report(),("hwp",false)=>d.export_hwp_with_adapter_snapshot_with_password_and_report(pwd),
 ("hwpx",true)=>d.export_hwpx_native_with_report(),("hwpx",false)=>d.export_hwpx_native_with_password_and_report(pwd),_=>unreachable!()}.map_err(|e|e.to_string())?;Ok((a.bytes().to_vec(),a.content_loss().len()))}
fn generate(out:&Path){let dir=out.join("fixtures");std::fs::create_dir_all(&dir).unwrap();let mut manifest=vec![];
 for c in cases(){let bytes=author(c);let p=dir.join(format!("{}.hwp",c.name));std::fs::write(&p,&bytes).unwrap();let d=DocumentCore::from_bytes(&bytes).unwrap();
 for para in &d.document().sections[0].paragraphs{for ctrl in &para.controls{if let Control::Table(t)=ctrl{assert_eq!(t.common.vertical_offset as i32,c.offset);}}}
 let(x,loss)=artifact(&d,"hwpx",b"").unwrap();assert_eq!(loss,0);let xp=dir.join(format!("{}.hwpx",c.name));std::fs::write(&xp,&x).unwrap();
 manifest.push(json!({"name":c.name,"native":p,"nativeSha256":hash(&bytes),"xml":xp,"xmlSha256":hash(&x),"declaredOffset":c.offset,"relative":format!("{:?}",c.relative),"allowOverlap":c.overlap,"columns":c.columns,"unequal":c.unequal,"oversizeAuthored":c.oversize,"shortPage":c.short_page}));println!("AUTHORED {}",c.name);}
 std::fs::write(out.join("manifest.json"),serde_json::to_vec_pretty(&json!({"authoringOnly":"public create/table/text then explicit typed Page/Paper absolute origin and column geometry before ordinary serialize and read; no source row/tag/descriptor repair","fixtures":manifest})).unwrap()).unwrap();}
fn main(){let out=PathBuf::from(std::env::var("N001_OUT").expect("own fixture output path"));std::fs::create_dir_all(&out).unwrap();generate(&out);}
