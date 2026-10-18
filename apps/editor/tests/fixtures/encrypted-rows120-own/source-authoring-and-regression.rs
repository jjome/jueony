use rhwp::DocumentCore;
use serde_json::json;
#[test]
fn own_native_prefix_encrypted_rows_are_preserved() {
 let mut own=DocumentCore::new_empty();own.create_blank_document_native().unwrap();
 own.insert_text_native(0,0,0,"Own authored encrypted completed rows. ").unwrap();
 let native=own.export_hwp_with_adapter_snapshot_with_report().unwrap();assert_eq!(native.content_loss().len(),0);
 let mut d=DocumentCore::from_bytes(native.bytes()).unwrap();
 // Author a controlled native-source fixture with the standard implementation
 // row tag. These are current engine-composed rows already in the model. No
 // CompletedRows field is accessible or synthesized by this external harness.
 for r in &mut d.document_mut().sections[0].paragraphs[0].line_segs {r.tag=0x80060000;}
 let authored=d.export_hwp_with_adapter_snapshot_with_report().unwrap();assert_eq!(authored.content_loss().len(),0);
 let mut d=DocumentCore::from_bytes(authored.bytes()).unwrap();
 let end=d.document().sections[0].paragraphs[0].text.chars().count();
 d.insert_text_native(0,0,end,&"Own long prefix causing current row recomposition. ".repeat(25)).unwrap();
 let plain=d.export_hwp_with_adapter_snapshot_with_report().unwrap();assert_eq!(plain.content_loss().len(),0);
 let encrypted=d.export_hwp_with_adapter_snapshot_with_password_and_report(b"own120-password").unwrap();
 let result=json!({"ownFixture":true,"nativeSourceRows":format!("{:?}",d.document().sections[0].paragraphs[0].line_segs),"profile":format!("{:?}",d.document().layout_profile()),"plainLoss":serde_json::from_str::<serde_json::Value>(&plain.content_loss().to_json()).unwrap(),"encryptedLoss":serde_json::from_str::<serde_json::Value>(&encrypted.content_loss().to_json()).unwrap()});
 std::fs::write(std::env::var("ENC120_OUT").unwrap(),serde_json::to_vec_pretty(&result).unwrap()).unwrap();
 assert_eq!(encrypted.content_loss().len(),0,"encrypted completed row loss: {}",encrypted.content_loss().to_json());
}
