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

    #[test]
    fn actual_guarded_hwt_copy_keeps_bytes_and_all_normal_open_authority_separate() {
        let source=PathBuf::from(std::env::var_os("JUEONY_NATIVE_STORAGE_FIXTURES").unwrap());
        let original=fs::read(source.join("original.hwt")).unwrap();
        let edited=fs::read(source.join("edited.hwt")).unwrap();
        assert_ne!(original,edited);
        let directory=tempfile::tempdir().unwrap();
        let path=directory.path().join("일반 필드 사본.HWT");
        assert!(DocumentFile::open(path.clone()).is_err());
        assert!(DocumentFile::open_hwt_copy(directory.path().join("wrong.hwpx")).is_err());
        assert!(DocumentFile::open_hwt_copy(PathBuf::from("relative.hwt")).is_err());
        let mut file=DocumentFile::open_hwt_copy(path.clone()).unwrap();
        assert!(file.read().is_err());assert_eq!(file.read_hwt_copy().unwrap(),Vec::<u8>::new());
        file.write(&original).unwrap();assert_eq!(file.read().unwrap(),original);
        file.write(&edited).unwrap();assert_eq!(file.read_bound().unwrap(),edited);
        fs::write(&path,&original).unwrap();assert_eq!(file.read().unwrap(),original);
        assert!(file.read_bound().is_err());assert!(file.write(&edited).is_err());
        assert_eq!(fs::read(&path).unwrap(),original);
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(),1);
        #[cfg(windows)] {
            use std::os::windows::fs::OpenOptionsExt;
            let mut rebound=DocumentFile::open_hwt_copy(path.clone()).unwrap();
            let lock=fs::OpenOptions::new().read(true).share_mode(3).open(&path).unwrap();
            assert!(rebound.write(&edited).is_err());assert_eq!(rebound.read().unwrap(),original);
            assert_eq!(fs::read_dir(directory.path()).unwrap().count(),1);
            drop(lock);rebound.write(&edited).unwrap();assert_eq!(fs::read(&path).unwrap(),edited);
            fs::remove_file(&path).unwrap();assert!(rebound.read_hwt_copy().is_err());
            assert!(rebound.write(&original).is_err());assert!(!path.exists());
        }
    }
}
