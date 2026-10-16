//! Runs the actual desktop file implementation without pulling in Tauri/WebView.
#[allow(dead_code)]
#[path = "../src-tauri/src/storage.rs"]
mod storage;

#[cfg(test)]
mod fixtures {
    use super::storage::DocumentFile;
    use std::{fs,path::PathBuf};

    #[test]
    fn real_engine_documents_keep_exact_bytes_across_native_create_replace_and_conflict() {
        let source = PathBuf::from(std::env::var_os("JUEONY_NATIVE_STORAGE_FIXTURES")
            .expect("Generate the engine HWP/HWPX fixtures and set JUEONY_NATIVE_STORAGE_FIXTURES"));
        for extension in ["hwp", "hwpx"] {
            let original = fs::read(source.join(format!("original.{extension}"))).unwrap();
            let edited = fs::read(source.join(format!("edited.{extension}"))).unwrap();
            assert_ne!(original, edited);
            let directory = tempfile::tempdir().unwrap();
            let path = directory.path().join(format!("업무 문서.{extension}"));
            let mut file = DocumentFile::open(path.clone()).unwrap();
            file.write(&original).unwrap();
            assert_eq!(file.read().unwrap(), original);
            file.write(&edited).unwrap();
            assert_eq!(file.read().unwrap(), edited);
            fs::write(&path, &original).unwrap();
            assert_eq!(file.read().unwrap(), original);
            assert!(file.write(&edited).is_err());
            assert_eq!(fs::read(&path).unwrap(), original);
            assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
        }
    }
}
