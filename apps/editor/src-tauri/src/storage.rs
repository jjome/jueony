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

    pub fn read(&mut self) -> io::Result<Vec<u8>> {
        let bytes = read_optional(&self.path)?.ok_or_else(|| invalid("파일을 찾을 수 없습니다."))?;
        self.fingerprint = Some(hash(&bytes));
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
}
