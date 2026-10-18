use rhwp::parser::xml_template::{extract_hwt_xml_template,MAX_HWT_BYTES};
use std::io::{Cursor,Write};
use flate2::{Compression,write::DeflateEncoder};
const XSD:&str=r#"<?xml version="1.0" encoding="UTF-16"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="report"><xs:complexType><xs:sequence><xs:element name="title" type="xs:string"/></xs:sequence></xs:complexType></xs:element></xs:schema>"#;
const MAP:&str=r#"<?xml version="1.0" encoding="UTF-16"?><XMLELEMENT Name="report" SchemaXPath="/xs:schema/xs:element[position()=1]"><XMLELEMENT Name="title" SchemaXPath="/xs:schema/xs:element[position()=1]/xs:complexType[position()=1]/xs:sequence[position()=1]/xs:element[position()=1]"/></XMLELEMENT>"#;
fn length(s:&str)->Vec<u8>{let mut b=Vec::new();for v in s.encode_utf16(){b.extend_from_slice(&v.to_le_bytes());}let mut result=(b.len()as u32).to_le_bytes().to_vec();result.extend(b);result}
fn zipped(b:&[u8])->Vec<u8>{let mut e=DeflateEncoder::new(Vec::new(),Compression::default());e.write_all(b).unwrap();let mut out=e.finish().unwrap();out.extend_from_slice(&crc32fast::hash(b).to_le_bytes());out.extend_from_slice(&(b.len()as u32).to_le_bytes());out}
fn header(flags:u32)->Vec<u8>{let mut b=vec![0;256];b[..17].copy_from_slice(b"HWP Document File");b[32..36].copy_from_slice(&[1,0,0,5]);b[36..40].copy_from_slice(&flags.to_le_bytes());b}
fn own(schema:Vec<u8>,mapping:Vec<u8>,name:Vec<u8>,flags:u32,omit:&str,wrongcase:bool)->Vec<u8>{
 let mut c=cfb::CompoundFile::create(Cursor::new(Vec::new())).unwrap();c.create_storage_all("/XMLTemplate").unwrap();c.create_storage_all("/Opaque").unwrap();
 for(path,data)in [("/FileHeader",header(flags)),("/XMLTemplate/Schema",schema),("/XMLTemplate/Instance",mapping),("/XMLTemplate/_SchemaName",name),("/Opaque/Original",vec![1,0,255,7])]{
  if path==omit{continue;}let path=if wrongcase&&path=="/XMLTemplate/Schema"{"/XMLTemplate/schema"}else{path};c.create_stream(path).unwrap().write_all(&data).unwrap();
 }c.into_inner().into_inner()
}
fn normal()->Vec<u8>{own(zipped(&length(XSD)),zipped(&length(MAP)),length("own95"),0x21,"",false)}
#[test]fn hwt95_own_exact_streams_read_without_document_or_write(){let source=normal();let before=source.clone();let read=extract_hwt_xml_template(&source).unwrap();assert_eq!(read.schema,XSD);assert_eq!(read.mapping,MAP);assert_eq!(read.schema_name,"own95");assert!(read.read_only);assert!(!read.schema_addresses_validated);assert_eq!(read.streams.len(),3);assert_eq!(source,before);
 if let Ok(folder)=std::env::var("JUEONY_HWT_OUTPUT") {let folder=std::path::Path::new(&folder);std::fs::create_dir_all(folder).unwrap();std::fs::OpenOptions::new().write(true).create_new(true).open(folder.join("own.hwt")).unwrap().write_all(&source).unwrap();std::fs::OpenOptions::new().write(true).create_new(true).open(folder.join("own-decoded.json")).unwrap().write_all(serde_json::to_string_pretty(&read).unwrap().as_bytes()).unwrap();}
 let mut c=rhwp::parser::cfb_reader::CfbReader::open(&source).unwrap();assert_eq!(c.read_stream_raw("/Opaque/Original").unwrap(),[1,0,255,7]);}
#[test]fn hwt95_missing_fixed_stream_refused(){for omit in ["/XMLTemplate/Schema","/XMLTemplate/Instance","/XMLTemplate/_SchemaName"]{assert!(extract_hwt_xml_template(&own(zipped(&length(XSD)),zipped(&length(MAP)),length("own"),0x21,omit,false)).is_err());}}
#[test]fn hwt95_case_alias_is_not_exact_path_authority(){assert!(extract_hwt_xml_template(&own(zipped(&length(XSD)),zipped(&length(MAP)),length("own"),0x21,"",true)).is_err());}
#[test]fn hwt95_flags_reject_protected_or_plain_document(){for flags in [1,0x23,0x25,0x31,0x121]{assert!(extract_hwt_xml_template(&own(zipped(&length(XSD)),zipped(&length(MAP)),length("own"),flags,"",false)).is_err());}}
#[test]fn hwt95_bad_source_and_allocation_budget_refused(){assert!(extract_hwt_xml_template(b"not a compound file").is_err());assert!(extract_hwt_xml_template(&vec![0;MAX_HWT_BYTES+1]).is_err());}
#[test]fn hwt95_utf16_length_is_exact_not_character_count(){let mut bad=length(XSD);bad[0..4].copy_from_slice(&1u32.to_le_bytes());assert!(extract_hwt_xml_template(&own(zipped(&bad),zipped(&length(MAP)),length("own"),0x21,"",false)).is_err());}
#[test]fn hwt95_utf16_surrogate_and_odd_length_refused(){for b in [vec![2,0,0,0,0,0xd8],vec![1,0,0,0,65]]{assert!(extract_hwt_xml_template(&own(zipped(&b),zipped(&length(MAP)),length("own"),0x21,"",false)).is_err());}}
#[test]fn hwt95_corrupt_and_trailing_deflate_refused(){let mut trailing=zipped(&length(XSD));trailing.extend([1,2]);for b in [vec![0,1,2,3],trailing]{assert!(extract_hwt_xml_template(&own(b,zipped(&length(MAP)),length("own"),0x21,"",false)).is_err());}}
#[test]fn hwt95_deflate_bomb_is_bounded(){let b=zipped(&vec![65;2_000_006]);let source=own(b,zipped(&length(MAP)),length("own"),0x21,"",false);assert!(extract_hwt_xml_template(&source).unwrap_err().contains("BUDGET"));}
#[test]fn hwt95_dtd_invalidxml_and_unbound_namespace_refused(){for xml in ["<!DOCTYPE a [<!ENTITY x SYSTEM 'https://invalid.example'>]><a>&x;</a>","<xs:schema/>","<x><y></x>"]{assert!(extract_hwt_xml_template(&own(zipped(&length(xml)),zipped(&length(MAP)),length("own"),0x21,"",false)).is_err());}}
#[test]fn hwt95_mapping_is_not_normal_xml_instance(){assert!(extract_hwt_xml_template(&own(zipped(&length(XSD)),zipped(&length("<report><title>own</title></report>")),length("own"),0x21,"",false)).is_err());}
#[test]fn hwt95_schema_name_controls_refused(){assert!(extract_hwt_xml_template(&own(zipped(&length(XSD)),zipped(&length(MAP)),length("bad\0name"),0x21,"",false)).is_err());}
#[test]fn hwt95_read_only_installed21_structures(){let folder=std::env::var("JUEONY_HWT_INSTALLED").expect("owned harness requires explicit installed folder");let files=std::fs::read_dir(folder).unwrap().filter_map(|p|p.ok()).filter(|p|p.path().extension().is_some_and(|e|e=="hwt")).collect::<Vec<_>>();assert_eq!(files.len(),21);for file in files{let source=std::fs::read(file.path()).unwrap();let before=source.clone();let read=extract_hwt_xml_template(&source).unwrap_or_else(|e|panic!("{}: {e}",file.file_name().to_string_lossy()));assert!(!read.schema.is_empty());assert!(!read.mapping.is_empty());assert_eq!(std::fs::read(file.path()).unwrap(),before);}println!("installed HWT21 read-only exact stream extraction PASS; vendor XML not emitted");}

#[test]fn hwt95_incomplete_deflate_terminator_is_not_a_complete_stream(){let mut b=zipped(&length(XSD));let at=b.len()-9;b.remove(at);assert!(extract_hwt_xml_template(&own(b,zipped(&length(MAP)),length("own"),0x21,"",false)).is_err());}

#[test]fn hwt95_each_crc_and_size_trailer_byte_is_verified(){let b=zipped(&length(XSD));for i in b.len()-8..b.len(){let mut bad=b.clone();bad[i]^=1;assert!(extract_hwt_xml_template(&own(bad,zipped(&length(MAP)),length("own"),0x21,"",false)).is_err());}}
#[test]fn hwt95_bare_raw_deflate_has_no_trailer_authority(){let mut b=zipped(&length(XSD));b.truncate(b.len()-8);assert!(extract_hwt_xml_template(&own(b,zipped(&length(MAP)),length("own"),0x21,"",false)).is_err());}

#[test]fn hwt95_compiled_source_witness_is_exact(){
 let root=std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
 let files:[(&str,&[u8]);5]=[
 ("src/parser/cfb_reader.rs",include_bytes!("../src/parser/cfb_reader.rs")),
 ("src/parser/xml_template.rs",include_bytes!("../src/parser/xml_template.rs")),
 ("src/parser/mod.rs",include_bytes!("../src/parser/mod.rs")),
 ("src/wasm_api/xml_template.rs",include_bytes!("../src/wasm_api/xml_template.rs")),
 ("src/wasm_api.rs",include_bytes!("../src/wasm_api.rs"))];
 let mut proof=Vec::new();for (path,compiled) in files {let live=std::fs::read(root.join(path)).unwrap();assert_eq!(live,compiled,"compiled source drift: {path}");use sha2::{Digest,Sha256};let digest:String=Sha256::digest(compiled).iter().map(|b|format!("{b:02x}")).collect();proof.push(serde_json::json!({"path":path,"bytes":compiled.len(),"sha256":digest}));}
 if let Ok(folder)=std::env::var("JUEONY_HWT_OUTPUT"){std::fs::create_dir_all(&folder).unwrap();std::fs::OpenOptions::new().create_new(true).write(true).open(std::path::Path::new(&folder).join("compiled-source-proof.json")).unwrap().write_all(serde_json::to_vec_pretty(&proof).unwrap().as_slice()).unwrap();}
}

fn slot(bytes:&[u8],wanted:&str)->(u32,usize){
 let sector=1usize<<u16::from_le_bytes(bytes[30..32].try_into().unwrap());assert!(sector==512||sector==4096);
 let fat=u32::from_le_bytes(bytes[76..80].try_into().unwrap())as usize;let fat=(fat+1)*sector;
 let mut dir=u32::from_le_bytes(bytes[48..52].try_into().unwrap());let mut index=0u32;
 for _ in 0..64{let start=(dir as usize+1)*sector;for offset in (0..sector).step_by(128){let at=start+offset;let len=u16::from_le_bytes(bytes[at+64..at+66].try_into().unwrap())as usize;if (2..=64).contains(&len){let name=String::from_utf16(&bytes[at..at+len-2].chunks_exact(2).map(|p|u16::from_le_bytes([p[0],p[1]])).collect::<Vec<_>>()).unwrap();if name==wanted{return(index,at);}}index+=1;}
 dir=u32::from_le_bytes(bytes[fat+dir as usize*4..fat+dir as usize*4+4].try_into().unwrap());if dir==0xfffffffe{break;}}
 panic!("own directory slot missing");
}
fn rename(bytes:&mut[u8],at:usize,name:&str){let raw:Vec<u8>=name.encode_utf16().flat_map(|n|n.to_le_bytes()).collect();assert!(raw.len()<=62);bytes[at..at+64].fill(0);bytes[at..at+raw.len()].copy_from_slice(&raw);bytes[at+64..at+66].copy_from_slice(&((raw.len()+2)as u16).to_le_bytes());}
#[test]fn hwt95_sibling_cycle_is_rejected_by_existing_strict_cfb(){let mut source=normal();let(id,at)=slot(&source,"Schema");source[at+72..at+76].copy_from_slice(&id.to_le_bytes());assert!(extract_hwt_xml_template(&source).is_err());}
#[test]fn hwt95_duplicate_casefold_name_is_rejected_by_existing_strict_cfb(){let mut source=normal();let(_,at)=slot(&source,"Instance");rename(&mut source,at,"sCheMA");assert!(extract_hwt_xml_template(&source).is_err());}
#[test]fn hwt95_parent_case_alias_cannot_grant_canonical_path(){let mut source=normal();let(_,at)=slot(&source,"XMLTemplate");rename(&mut source,at,"xmltemplate");assert!(extract_hwt_xml_template(&source).is_err());}
#[test]fn hwt95_same_leaf_other_storage_is_not_a_template_owner(){
 let source=own(zipped(&length(XSD)),zipped(&length(MAP)),length("own"),0x21,"/XMLTemplate/Schema",false);let mut c=cfb::CompoundFile::open(Cursor::new(source)).unwrap();c.create_storage_all("/Other").unwrap();c.create_stream("/Other/Schema").unwrap().write_all(&zipped(&length(XSD))).unwrap();let source=c.into_inner().into_inner();assert!(extract_hwt_xml_template(&source).is_err());
 let mut c=cfb::CompoundFile::open(Cursor::new(normal())).unwrap();c.create_storage_all("/Other").unwrap();c.create_stream("/Other/Schema").unwrap().write_all(b"opaque unrelated bytes").unwrap();let source=c.into_inner().into_inner();let before=source.clone();assert!(extract_hwt_xml_template(&source).is_ok());assert_eq!(source,before);
}
