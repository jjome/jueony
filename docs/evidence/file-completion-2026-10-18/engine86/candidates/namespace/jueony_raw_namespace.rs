use rhwp::parser::hwpx::HwpxError;
mod utils {pub use rhwp::parser::hwpx::utils::local_name;}
mod header {pub use rhwp::parser::hwpx::header::parse_hwpx_header;}
#[path="../src/parser/hwpx/raw_namespace.rs"] mod raw_namespace;

#[test]
fn raw_namespace83_actual_engine_own_matrix_two_xml_cycles() {
    use rhwp::document_core::DocumentCore;
    use std::io::Read;
    let repo=std::env::var("JUEONY_REPO").unwrap();
    let paths=["build/line-fit-threshold80/own-gulimche-floor4-matrix-no-ls.hwpx","build/line-fit-threshold80/own-gulimche-half-glyph-matrix-no-ls.hwpx"];
    for (index,path) in paths.iter().enumerate() {
        let source=std::fs::read(format!("{repo}/{path}")).unwrap();
        let mut doc=DocumentCore::from_bytes(&source).unwrap();
        let mut raw=doc.document().doc_info.numberings.iter().map(|n|n.raw_para_heads.clone()).collect::<Vec<_>>();
        for cycle in 0..2 {
            let export=doc.export_hwpx_native_with_report().unwrap();
            assert!(export.content_loss().is_empty());
            let bytes=export.into_bytes();
            let mut zip=zip::ZipArchive::new(std::io::Cursor::new(&bytes)).unwrap();
            for n in 0..zip.len() {
                let mut file=zip.by_index(n).unwrap();
                if file.name().ends_with(".xml") || file.name().ends_with(".hpf") {
                    let mut xml=String::new();file.read_to_string(&mut xml).unwrap();
                    raw_namespace::validate(&xml).unwrap();
                }
            }
            std::fs::write(format!("{repo}/build/raw-namespace-closure83/own-{index}-cycle{cycle}.hwpx"),&bytes).unwrap();
            doc=DocumentCore::from_bytes(&bytes).unwrap();
            let next=doc.document().doc_info.numberings.iter().map(|n|n.raw_para_heads.clone()).collect::<Vec<_>>();
            assert_eq!(raw,next,"raw fragments must remain byte-exact");raw=next;
        }
    }
}
