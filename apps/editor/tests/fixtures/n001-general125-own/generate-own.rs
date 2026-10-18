// Own deterministic fixture author, public edit/table APIs then ordinary serialization.
// No private computed rows, leases, cache payloads or implementation flags are authored.
use rhwp::{DocumentCore,model::control::Control};
use sha2::{Digest,Sha256};
use std::path::PathBuf;
#[derive(Clone,Copy)]struct Case{ name:&'static str,tables:usize,interleave:bool,columns:u16,unequal:bool,short_page:bool,offset:bool,tac:bool }
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
  Control::Table(t)=>{t.common.treat_as_char=c.tac;if c.offset {t.common.horizontal_offset=450;t.common.vertical_offset=300;}t.raw_ctrl_data.clear();t.raw_ctrl_seal=None;},
  Control::SectionDef(s)=>if c.short_page{let page=&mut s.page_def;page.height=23000;page.margin_header=1000;page.margin_top=1000;page.margin_bottom=1000;page.margin_footer=1000;},
  Control::ColumnDef(cd)=>if c.unequal{cd.same_width=false;cd.proportional_widths=true;cd.widths=if c.columns==2{vec![11000,20568]}else{vec![7000,11000,12368]};cd.gaps=vec![1200;c.columns.saturating_sub(1)as usize];cd.raw_attr=0;},_=>{}}}}
 for s in &mut doc.sections{s.raw_stream=None;}
 let a=rhwp::serializer::serialize_hwp_with_report(&doc).unwrap();assert_eq!(a.content_loss().len(),0,"authoring {} {}",c.name,a.content_loss().to_json());a.bytes().to_vec()
}
fn main(){ let cases=[
 Case{name:"one-float",tables:1,interleave:false,columns:1,unequal:false,short_page:false,offset:false,tac:false},
 Case{name:"two-float-control",tables:2,interleave:false,columns:1,unequal:false,short_page:false,offset:false,tac:false},
 Case{name:"three-float",tables:3,interleave:false,columns:1,unequal:false,short_page:false,offset:false,tac:false},
 Case{name:"four-float",tables:4,interleave:false,columns:1,unequal:false,short_page:false,offset:false,tac:false},
 Case{name:"three-float-interleaved",tables:3,interleave:true,columns:1,unequal:false,short_page:false,offset:false,tac:false},
 Case{name:"four-float-interleaved",tables:4,interleave:true,columns:1,unequal:false,short_page:false,offset:false,tac:false},
 Case{name:"one-tac",tables:1,interleave:false,columns:1,unequal:false,short_page:false,offset:false,tac:true},
 Case{name:"two-tac-control",tables:2,interleave:false,columns:1,unequal:false,short_page:false,offset:false,tac:true},
 Case{name:"three-tac",tables:3,interleave:false,columns:1,unequal:false,short_page:false,offset:false,tac:true},
 Case{name:"four-tac",tables:4,interleave:false,columns:1,unequal:false,short_page:false,offset:false,tac:true},
 Case{name:"three-interleaved",tables:3,interleave:true,columns:1,unequal:false,short_page:false,offset:false,tac:true},
 Case{name:"four-interleaved",tables:4,interleave:true,columns:1,unequal:false,short_page:false,offset:false,tac:true},
 Case{name:"one-offset",tables:1,interleave:false,columns:1,unequal:false,short_page:false,offset:true,tac:false},
 Case{name:"three-offset",tables:3,interleave:true,columns:1,unequal:false,short_page:false,offset:true,tac:false},
 Case{name:"three-multipage",tables:3,interleave:true,columns:1,unequal:false,short_page:true,offset:false,tac:true},
 Case{name:"four-multipage",tables:4,interleave:true,columns:1,unequal:false,short_page:true,offset:false,tac:true},
 Case{name:"two-columns",tables:3,interleave:true,columns:2,unequal:false,short_page:false,offset:false,tac:true},
 Case{name:"three-columns",tables:4,interleave:true,columns:3,unequal:false,short_page:false,offset:false,tac:true},
 Case{name:"unequal-two",tables:3,interleave:true,columns:2,unequal:true,short_page:false,offset:false,tac:true},
 Case{name:"unequal-three",tables:4,interleave:true,columns:3,unequal:true,short_page:false,offset:false,tac:true},
 Case{name:"two-columns-multipage",tables:3,interleave:true,columns:2,unequal:false,short_page:true,offset:false,tac:true},
 Case{name:"unequal-three-offset",tables:4,interleave:true,columns:3,unequal:true,short_page:true,offset:true,tac:false}];
 let out=PathBuf::from(std::env::var("N001_FIXTURE_OUTPUT").expect("explicit new output directory"));std::fs::create_dir_all(&out).unwrap();for c in cases{let bytes=author(c);let path=out.join(format!("{}.hwp",c.name));std::fs::write(&path,&bytes).unwrap();println!("{} {}",c.name,Sha256::digest(&bytes).iter().map(|b|format!("{b:02x}")).collect::<String>());}}
