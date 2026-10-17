use sha2::{Digest, Sha256};
use std::{fs, io::{self, Write}, path::PathBuf};

const MAX_BYTES: u64 = 128 * 1024 * 1024;

pub struct DocumentFile {
    pub path: PathBuf,
    fingerprint: Option<[u8; 32]>,
}

fn invalid(message: &str) -> io::Error { io::Error::other(message) }

fn read_optional(path: &PathBuf) -> io::Result<Option<Vec<u8>>> {
    match fs::symlink_metadata(path) {
        Ok(meta) => {
            if !meta.file_type().is_file() { return Err(invalid("일반 파일만 선택할 수 있습니다.")); }
            if meta.len() > MAX_BYTES { return Err(invalid("현재 검증판은 128 MiB 이하 파일을 지원합니다.")); }
            let bytes = fs::read(path)?;
            if bytes.len() as u64 > MAX_BYTES { return Err(invalid("파일 크기가 제한을 초과했습니다.")); }
            Ok(Some(bytes))
        },
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}

fn hash(bytes: &[u8]) -> [u8; 32] { Sha256::digest(bytes).into() }

impl DocumentFile {
    pub fn open(path: PathBuf) -> io::Result<Self> {
        let extension = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase();
        if !path.is_absolute() || !matches!(extension.as_str(), "hwp" | "hwpx") {
            return Err(invalid("HWP 또는 HWPX 파일을 선택해 주세요."));
        }
        let fingerprint = read_optional(&path)?.map(|b| hash(&b));
        Ok(Self { path, fingerprint })
    }

    pub fn read(&self) -> io::Result<Vec<u8>> {
        let bytes = read_optional(&self.path)?.ok_or_else(|| invalid("파일을 찾을 수 없습니다."))?;
        // Reads used by conflict detection/readback must not adopt an external
        // writer's version. Only an explicit new file binding or verified commit
        // advances the baseline; otherwise a read could bypass the next guard.
        Ok(bytes)
    }

    /// Bind a recent-file inspection to the exact baseline already granted to
    /// this handle. This read never adopts a concurrent external writer.
    pub fn read_bound(&self) -> io::Result<Vec<u8>> {
        let bytes = self.read()?;
        if self.fingerprint != Some(hash(&bytes)) {
            return Err(invalid("원본 확인 중 파일이 바뀌었습니다. 다시 선택해 주세요."));
        }
        Ok(bytes)
    }

    pub fn write(&mut self, bytes: &[u8]) -> io::Result<()> {
        if bytes.is_empty() || bytes.len() as u64 > MAX_BYTES { return Err(invalid("저장 데이터 크기가 올바르지 않습니다.")); }
        let actual = read_optional(&self.path)?.map(|b| hash(&b));
        if actual != self.fingerprint { return Err(invalid("다른 프로그램에서 파일이 변경됐습니다. 다른 이름으로 저장해 주세요.")); }
        let parent = self.path.parent().ok_or_else(|| invalid("저장 폴더가 없습니다."))?;
        let mut staged = tempfile::NamedTempFile::new_in(parent)?;
        staged.write_all(bytes)?;
        staged.as_file().sync_all()?;
        // 새 파일은 다른 프로세스가 먼저 만들었을 때 덮어쓰지 않는다.
        if self.fingerprint.is_none() {
            staged.persist_noclobber(&self.path).map_err(|e| e.error)?;
        } else {
            if read_optional(&self.path)?.map(|b| hash(&b)) != self.fingerprint {
                return Err(invalid("저장 중 원본 파일이 변경됐습니다."));
            }
            staged.persist(&self.path).map_err(|e| e.error)?;
        }
        // Replacement has already committed. If verification fails, report a
        // failure without advancing the baseline or claiming the old disk bytes
        // survived. The frontend retains its dirty document in this case too.
        let committed = read_optional(&self.path)?;
        if committed.as_deref() != Some(bytes) {
            return Err(invalid("저장 파일의 실제 내용을 확인하지 못했습니다. 편집 내용을 유지하고 다른 이름으로 저장해 주세요."));
        }
        self.fingerprint = Some(hash(bytes));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn save_and_external_change_guard() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.hwpx");
        let mut file = DocumentFile::open(path.clone()).unwrap();
        file.write(b"first").unwrap();
        file.write(b"second").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"second");
        fs::write(&path, b"external").unwrap();
        assert!(file.write(b"lost update").is_err());
        assert_eq!(fs::read(&path).unwrap(), b"external");
    }
    #[test]
    fn competing_creation_and_invalid_input_do_not_overwrite() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.hwp");
        let mut file = DocumentFile::open(path.clone()).unwrap();
        fs::write(&path, b"another writer").unwrap();
        assert!(file.write(b"replace").is_err());
        assert!(file.write(b"").is_err());
        assert!(DocumentFile::open(dir.path().join("test.exe")).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"another writer");
    }

    #[test]
    fn reading_an_external_edit_does_not_adopt_it_as_the_write_baseline() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("read-guard.hwpx");
        fs::write(&path, b"original").unwrap();
        let mut file = DocumentFile::open(path.clone()).unwrap();
        fs::write(&path, b"external").unwrap();
        assert_eq!(file.read().unwrap(), b"external");
        assert!(file.write(b"must not overwrite").is_err());
        assert_eq!(fs::read(&path).unwrap(), b"external");
        let mut reopened = DocumentFile::open(path.clone()).unwrap();
        reopened.write(b"explicitly rebound").unwrap();
        assert_eq!(reopened.read().unwrap(), b"explicitly rebound");
    }

    #[test]
    fn read_cannot_adopt_a_competing_new_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("new-conflict.hwp");
        let mut file = DocumentFile::open(path.clone()).unwrap();
        fs::write(&path, b"competitor").unwrap();
        assert_eq!(file.read().unwrap(), b"competitor");
        assert!(file.write(b"overwrite").is_err());
        assert_eq!(fs::read(&path).unwrap(), b"competitor");
    }

    #[test]
    fn removed_existing_file_is_not_silently_recreated() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("removed.hwpx");
        fs::write(&path, b"original").unwrap();
        let mut file = DocumentFile::open(path.clone()).unwrap();
        fs::remove_file(&path).unwrap();
        assert!(file.read().is_err());
        assert!(file.write(b"recreate").is_err());
        assert!(!path.exists());
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
    }

    #[test]
    fn oversized_and_non_file_sources_are_rejected_before_reading() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("oversized.hwp");
        fs::File::create(&path).unwrap().set_len(MAX_BYTES + 1).unwrap();
        assert!(DocumentFile::open(path).is_err());
        let folder = dir.path().join("directory.hwpx");
        fs::create_dir(&folder).unwrap();
        assert!(DocumentFile::open(folder).is_err());
        assert!(DocumentFile::open(PathBuf::from("relative.hwp")).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn windows_read_only_target_stays_unchanged_and_retry_after_unlock_succeeds() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("읽기 전용.hwpx");
        fs::write(&path, b"readonly original").unwrap();
        let mut file = DocumentFile::open(path.clone()).unwrap();
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&path, permissions).unwrap();
        struct ResetReadonly(PathBuf);
        impl Drop for ResetReadonly {
            fn drop(&mut self) {
                if let Ok(metadata) = fs::metadata(&self.0) {
                    let mut p = metadata.permissions(); p.set_readonly(false);
                    let _ = fs::set_permissions(&self.0, p);
                }
            }
        }
        let reset = ResetReadonly(path.clone());
        assert!(file.write(b"must fail").is_err());
        assert_eq!(fs::read(&path).unwrap(), b"readonly original");
        assert!(fs::metadata(&path).unwrap().permissions().readonly());
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
        drop(reset);
        file.write(b"after permission restored").unwrap();
        assert_eq!(file.read().unwrap(), b"after permission restored");
    }

    #[cfg(windows)]
    #[test]
    fn windows_exclusive_share_lock_refuses_read_and_write_without_temp_leaks() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("exclusive.hwp");
        fs::write(&path, b"locked original").unwrap();
        let mut file = DocumentFile::open(path.clone()).unwrap();
        let lock = fs::OpenOptions::new().read(true).write(true).share_mode(0).open(&path).unwrap();
        assert!(file.read().is_err());
        assert!(file.write(b"must fail").is_err());
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
        drop(lock);
        assert_eq!(file.read().unwrap(), b"locked original");
        file.write(b"after unlock").unwrap();
        assert_eq!(file.read().unwrap(), b"after unlock");
    }

    #[cfg(windows)]
    #[test]
    fn windows_replace_denial_preserves_original_and_removes_staging_file() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("replace-locked.hwpx");
        fs::write(&path, b"replace locked original").unwrap();
        let mut file = DocumentFile::open(path.clone()).unwrap();
        // Allow data reads/writes, but deny deletion/replacement while held.
        let lock = fs::OpenOptions::new().read(true).share_mode(3).open(&path).unwrap();
        assert_eq!(file.read().unwrap(), b"replace locked original");
        assert!(file.write(b"must not commit").is_err());
        assert_eq!(file.read().unwrap(), b"replace locked original");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
        drop(lock);
        file.write(b"retry after replace lock").unwrap();
        assert_eq!(file.read().unwrap(), b"retry after replace lock");
    }
}
