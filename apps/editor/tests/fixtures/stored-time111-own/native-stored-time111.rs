use rhwp::DocumentCore;
use serde_json::{json, Value};
use std::io::{Cursor, Read};
use std::collections::BTreeMap;

const CREATED: &str = "133536420001234567";
const MODIFIED: &str = "133536420007654321";
const PRINTED: &str = "133536420000000006";
const DURATION: &str = "18446744073709551615";
fn state(d: &DocumentCore) -> Value { serde_json::from_str(&d.get_document_stored_information_edit_state_native()).unwrap() }
fn times(d: &DocumentCore) -> Value { let mut v:Value=serde_json::from_str(&d.get_document_stored_information_native()).unwrap();v.as_object_mut().unwrap().remove("sourceFormat");v }
fn new() -> DocumentCore { let mut d=DocumentCore::new_empty();d.create_blank_document_native().unwrap();d }
fn req(values:Value)->String {json!({"schemaVersion":1,"values":values}).to_string()}
fn full()->String {req(json!({"created":CREATED,"modified":MODIFIED,"lastPrinted":PRINTED,"editingDuration":DURATION}))}
fn apply(d:&mut DocumentCore,request:&str)->Value {let token=state(d)["fingerprint"].as_str().unwrap().to_owned();serde_json::from_str(&d.set_document_stored_information_native(&token,request).unwrap()).unwrap()}
fn body(d:&DocumentCore)->String {format!("{:?}",d.document().sections)}
fn whole(d:&DocumentCore)->String {format!("{:?}",d.document())}
fn u32at(b:&[u8],p:usize)->u32 {u32::from_le_bytes(b[p..p+4].try_into().unwrap())}
fn props(b:&[u8])->BTreeMap<u32,Vec<u8>> {
    let start=u32at(b,44)as usize;let size=u32at(b,start)as usize;let n=u32at(b,start+4)as usize;
    let entries=(0..n).map(|i|(u32at(b,start+8+i*8),u32at(b,start+12+i*8)as usize)).collect::<Vec<_>>();
    entries.iter().map(|(id,offset)|{let end=entries.iter().map(|v|v.1).filter(|v|v>offset).min().unwrap_or(size);(*id,b[start+offset..start+end].to_vec())}).collect()
}
fn rebuild(b:&[u8],p:&BTreeMap<u32,Vec<u8>>)->Vec<u8> {
    let start=u32at(b,44)as usize;let mut section=vec![0;8+p.len()*8];let mut values=vec![];
    for(i,(id,raw))in p.iter().enumerate(){let offset=section.len()+values.len();section[8+i*8..12+i*8].copy_from_slice(&id.to_le_bytes());section[12+i*8..16+i*8].copy_from_slice(&(offset as u32).to_le_bytes());values.extend(raw);while values.len()%4!=0{values.push(0);}}
    section.extend(values);let size=section.len()as u32;section[..4].copy_from_slice(&size.to_le_bytes());section[4..8].copy_from_slice(&(p.len()as u32).to_le_bytes());let mut out=b[..start].to_vec();out.extend(section);out
}
fn raw_summary(d:&DocumentCore)->&[u8] {&d.document().extra_streams.iter().find(|v|v.0.ends_with("HwpSummaryInformation")).unwrap().1}
fn assert_standard(raw:&[u8]) {let p=props(raw);for(pid,want)in [(12,CREATED),(13,MODIFIED),(11,PRINTED),(10,DURATION)]{let b=&p[&pid];assert_eq!(u32at(b,0),64);assert_eq!(u64::from_le_bytes(b[4..12].try_into().unwrap()).to_string(),want);}}
fn actual_summary(b:&[u8])->Vec<u8>{let mut c=cfb::CompoundFile::open(Cursor::new(b.to_vec())).unwrap();let mut out=vec![];c.open_stream("/\u{5}HwpSummaryInformation").unwrap().read_to_end(&mut out).unwrap();out}
fn actual_xml(b:&[u8])->String {let mut z=zip::ZipArchive::new(Cursor::new(b)).unwrap();let mut out=String::new();z.by_name("Contents/content.hpf").unwrap().read_to_string(&mut out).unwrap();out}
fn layout(d:&DocumentCore)->Value {Value::Array((0..d.page_count()).map(|i|json!({"text":serde_json::from_str::<Value>(&d.get_page_text_layout_native(i).unwrap()).unwrap(),"controls":serde_json::from_str::<Value>(&d.get_page_control_layout_native(i).unwrap()).unwrap()})).collect())}
fn record(name:&str,value:Value){if let Ok(dir)=std::env::var("ST111_OUT"){let path=std::path::Path::new(&dir);std::fs::create_dir_all(path).unwrap();std::fs::write(path.join(format!("{name}.json")),serde_json::to_vec_pretty(&value).unwrap()).unwrap();}}

#[test]
fn exact_100ns_ole_and_standard_xml_roundtrip_both_directions_three_cycles(){
    let mut d=new();let before=body(&d);let current=layout(&d);let five=d.get_document_metadata_native();let result=apply(&mut d,&full());assert_eq!(result["changed"],true);assert_eq!(result["fingerprint"],state(&d)["fingerprint"]);assert_eq!(before,body(&d));assert_eq!(current,layout(&d));assert_standard(raw_summary(&d));
    let five_after:Value=serde_json::from_str(&d.get_document_metadata_native()).unwrap();let five:Value=serde_json::from_str(&five).unwrap();assert_eq!(five["values"],five_after["values"]);
    let expected=times(&d);let mut observations=vec![];
    for (cycle,format) in ["hwp","hwpx","hwp","hwpx","hwp","hwpx"].into_iter().enumerate(){
        let unchanged=whole(&d);let artifact=if format=="hwp"{d.export_hwp_with_adapter_snapshot_with_report().unwrap()}else{d.export_hwpx_native_with_report().unwrap()};assert_eq!(artifact.content_loss().len(),0);
        let out=std::path::PathBuf::from(std::env::var("ST111_OUT").expect("dedicated test output directory"));std::fs::create_dir_all(&out).unwrap();let disk=out.join(format!("cycle-{cycle}.{format}"));std::fs::write(&disk,artifact.bytes()).unwrap();let bytes=std::fs::read(&disk).unwrap();assert_eq!(bytes,artifact.bytes());
        if format=="hwp"{assert_standard(&actual_summary(&bytes));}else{let x=actual_xml(&bytes);assert!(x.contains("2024-02-29T01:00:00.1234567Z"));assert!(x.contains("2024-02-29T01:00:00.7654321Z"));}
        let next=DocumentCore::from_bytes(&bytes).unwrap();assert_eq!(expected,times(&next));assert_eq!(current,layout(&next));assert_eq!(unchanged,whole(&d));observations.push(json!({"format":format,"disk":disk,"bytes":bytes.len(),"diskReadbackExact":true,"contentLoss":0,"storedTimesExact":true,"publishedLayoutExact":true,"sourceUnchanged":true}));d=next;
    }
    record("actual-roundtrip",json!({"observations":observations,"information":expected}));
}

#[test]
fn preview_cancel_noop_and_stale_owner_are_atomic(){
    let mut d=new();let before=whole(&d);let s=state(&d);assert_eq!(s["editable"],true);let token=s["fingerprint"].as_str().unwrap();let preview:Value=serde_json::from_str(&d.preview_document_stored_information_native(token,&full()).unwrap()).unwrap();assert_eq!(preview["changed"],true);assert_eq!(before,whole(&d));assert_eq!(s,state(&d));
    let changed=apply(&mut d,&full());assert_eq!(preview["information"],changed["information"]);let after=whole(&d);assert!(d.set_document_stored_information_native(token,&full()).is_err());assert_eq!(after,whole(&d));let same=apply(&mut d,&full());assert_eq!(same["changed"],false);assert_eq!(after,whole(&d));
    let old=state(&d)["fingerprint"].as_str().unwrap().to_owned();let mut fields:Value=serde_json::from_str(&d.get_document_metadata_native()).unwrap();fields["values"]["title"]=json!("new summary owner");d.set_document_metadata_native(&old,&fields["values"].to_string()).unwrap();let after=whole(&d);assert!(d.set_document_stored_information_native(&old,&full()).is_err());assert_eq!(after,whole(&d));
}

#[test]
fn malformed_requests_never_modify_any_source_data(){
    let mut d=new();let token=state(&d)["fingerprint"].as_str().unwrap().to_owned();let bad=[
        "{}", "{\"schemaVersion\":2,\"values\":{\"created\":\"0\"}}", "{\"schemaVersion\":1,\"values\":{}}",
        "{\"schemaVersion\":1,\"values\":{\"created\":null}}", "{\"schemaVersion\":1,\"values\":{\"created\":0}}",
        "{\"schemaVersion\":1,\"values\":{\"created\":\"-1\"}}", "{\"schemaVersion\":1,\"values\":{\"created\":\"01\"}}",
        "{\"schemaVersion\":1,\"values\":{\"created\":\"1.0\"}}", "{\"schemaVersion\":1,\"values\":{\"created\":\"1e2\"}}",
        "{\"schemaVersion\":1,\"values\":{\"created\":\"18446744073709551615\"}}", "{\"schemaVersion\":1,\"values\":{\"editingDuration\":\"18446744073709551616\"}}",
        "{\"schemaVersion\":1,\"values\":{\"unknown\":\"0\"}}", "{\"schemaVersion\":1,\"values\":{\"created\":\"0\"},\"other\":true}",
        "{\"schemaVersion\":1,\"schemaVersion\":1,\"values\":{\"created\":\"0\"}}", "{\"schemaVersion\":1,\"values\":{\"created\":\"0\",\"created\":\"1\"}}",
        "{\"schemaVersion\":1,\"values\":{\"created\":\"0\"},\"values\":{\"created\":\"1\"}}", "{\"schemaVersion\":1,\"values\":{\"created\":\"0\"}}false",
        "{\"schemaVersion\":1,\"values\":{\"created\":\"+1\"}}", "{\"schemaVersion\":1,\"values\":{\"created\":\" 1\"}}", "{\"schemaVersion\":1,\"values\":{\"created\":\"\"}}"
    ];
    for request in bad {let before=whole(&d);assert!(d.preview_document_stored_information_native(&token,request).is_err(),"preview accepted {request}");assert!(d.set_document_stored_information_native(&token,request).is_err(),"setter accepted {request}");assert_eq!(before,whole(&d));}
    let before=whole(&d);assert!(d.set_document_stored_information_native(&token,&" ".repeat(4097)).is_err());assert_eq!(before,whole(&d));record("request-negatives",json!({"requestsRejected":bad.len()+1,"sourceUnchanged":true}));
}

#[test]
fn unknown_properties_and_unchanged_time_raw_padding_are_exact(){
    let mut d=new();let mut p=props(raw_summary(&d));let old=p.get(&12).unwrap().clone();let mut padded=old.clone();padded.extend([0u8;8]);p.insert(12,padded.clone());p.insert(999,vec![3,0,0,0,0x51,0x25,0x73,0x19]);let source=rebuild(raw_summary(&d),&p);d.document_mut().extra_streams.iter_mut().find(|v|v.0.ends_with("HwpSummaryInformation")).unwrap().1=source;
    let before=body(&d);apply(&mut d,&req(json!({"modified":MODIFIED,"editingDuration":"17"})));let after=props(raw_summary(&d));assert_eq!(after[&12],padded);assert_eq!(after[&999],p[&999]);assert_eq!(before,body(&d));
}

#[test]
fn malformed_or_restricted_original_owner_is_not_repaired(){
    for kind in ["type","duplicate","encrypted","badxml"]{
        let mut d=new();match kind {
            "type"=>{let mut p=props(raw_summary(&d));p.get_mut(&12).unwrap()[..4].copy_from_slice(&40u32.to_le_bytes());let raw=rebuild(raw_summary(&d),&p);d.document_mut().extra_streams.iter_mut().find(|v|v.0.ends_with("HwpSummaryInformation")).unwrap().1=raw;},
            "duplicate"=>{let raw=raw_summary(&d).to_vec();d.document_mut().extra_streams.push(("/\u{5}HwpSummaryInformation".into(),raw));},
            "encrypted"=>d.document_mut().header.encrypted=true,
            "badxml"=>d.document_mut().hwpx_aux_entries.push(("Contents/content.hpf".into(),b"<invalid>".to_vec())),_=>unreachable!()
        }
        let before=whole(&d);assert_eq!(state(&d)["editable"],false,"{kind}");assert!(d.set_document_stored_information_native("ignored",&full()).is_err());assert_eq!(before,whole(&d));
    }
}

#[test]
fn xml_alias_empty_dates_unknown_attributes_and_foreign_payload_preserved(){
    let mut d=new();apply(&mut d,&full());let a=d.export_hwpx_native_with_report().unwrap();let mut x=DocumentCore::from_bytes(a.bytes()).unwrap();
    let entry=x.document_mut().hwpx_aux_entries.iter_mut().find(|v|v.0=="Contents/content.hpf").unwrap();let s=String::from_utf8(entry.1.clone()).unwrap();let s=s.replace("opf:","p:").replace("xmlns:opf=","xmlns:p=").replace("<p:metadata>","<p:metadata data-extra='keep' xmlns:q='urn:foreign'><q:meta name='ModifiedDate'>FOREIGN</q:meta>");entry.1=s.into_bytes();
    let before=body(&x);apply(&mut x,&req(json!({"modified":"133536420000000001"})));let out=String::from_utf8(x.document().hwpx_aux_entry("Contents/content.hpf").unwrap().to_vec()).unwrap();assert!(out.contains("data-extra='keep'"));assert!(out.contains("<q:meta name='ModifiedDate'>FOREIGN</q:meta>"));assert!(out.contains("<p:meta name=\"ModifiedDate\" content=\"text\">2024-02-29T01:00:00.0000001Z</p:meta>"));assert_eq!(before,body(&x));
}

#[test]
fn empty_default_namespace_metadata_and_empty_date_keep_exact_owners(){
    let mut d=new();let a=d.export_hwpx_native_with_report().unwrap();let mut x=DocumentCore::from_bytes(a.bytes()).unwrap();
    let mut p=props(raw_summary(&x));for pid in [10,11,12,13]{p.remove(&pid);}let raw=rebuild(raw_summary(&x),&p);x.document_mut().extra_streams.iter_mut().find(|v|v.0.ends_with("HwpSummaryInformation")).unwrap().1=raw;
    let xml=b"<package xmlns='http://www.idpf.org/2007/opf/' id='root-owner'><metadata data-opaque='keep' /></package>".to_vec();x.document_mut().hwpx_aux_entries.iter_mut().find(|v|v.0=="Contents/content.hpf").unwrap().1=xml;
    assert_eq!(state(&x)["editable"],true);apply(&mut x,&req(json!({"created":"0","modified":MODIFIED})));
    let xml=String::from_utf8(x.document().hwpx_aux_entry("Contents/content.hpf").unwrap().to_vec()).unwrap();assert!(xml.contains("<package xmlns='http://www.idpf.org/2007/opf/' id='root-owner'>"));assert!(xml.contains("<metadata data-opaque='keep' >"));assert!(xml.contains("<meta name=\"CreatedDate\" content=\"text\">1601-01-01T00:00:00.0000000Z</meta>"));
    let old="<meta name=\"ModifiedDate\" content=\"text\">2024-02-29T01:00:00.7654321Z</meta>";assert!(xml.contains(old));let empty=xml.replace(old,"<meta name='ModifiedDate' content='text' data-extra='yes' />");x.document_mut().hwpx_aux_entries.iter_mut().find(|v|v.0=="Contents/content.hpf").unwrap().1=empty.into_bytes();let mut p=props(raw_summary(&x));p.remove(&13);let raw=rebuild(raw_summary(&x),&p);x.document_mut().extra_streams.iter_mut().find(|v|v.0.ends_with("HwpSummaryInformation")).unwrap().1=raw;
    assert_eq!(state(&x)["editable"],true);apply(&mut x,&req(json!({"modified":MODIFIED})));let out=String::from_utf8(x.document().hwpx_aux_entry("Contents/content.hpf").unwrap().to_vec()).unwrap();assert!(out.contains("<meta name='ModifiedDate' content='text' data-extra='yes' >2024-02-29T01:00:00.7654321Z</meta>"));
    // A numerically identical timezone spelling must not be canonicalized by a no-op.
    let xml=out.replace("1601-01-01T00:00:00.0000000Z","1601-01-01T01:00:00+01:00");x.document_mut().hwpx_aux_entries.iter_mut().find(|v|v.0=="Contents/content.hpf").unwrap().1=xml.into_bytes();let before=whole(&x);assert_eq!(apply(&mut x,&req(json!({"created":"0"})))["changed"],false);assert_eq!(before,whole(&x));
}
