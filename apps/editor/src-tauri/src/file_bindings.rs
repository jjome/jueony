use crate::storage::DocumentFile;
use serde::Serialize;
use std::{collections::HashMap, io, path::PathBuf};
#[derive(Serialize, Clone)]
pub struct HandleInfo {
    pub token: String,
    pub name: String,
}
struct BoundFile {
    owner: String,
    file: DocumentFile,
}
#[derive(Default)]
pub struct FileBindings {
    files: HashMap<String, BoundFile>,
}
fn denied() -> io::Error {
    io::Error::other("현재 창에 허용되지 않은 파일입니다.")
}
impl FileBindings {
    pub fn register(&mut self, owner: &str, path: PathBuf) -> io::Result<HandleInfo> {
        self.insert(owner, DocumentFile::open(path)?)
    }
    pub fn insert(&mut self, owner: &str, file: DocumentFile) -> io::Result<HandleInfo> {
        let name = file
            .path
            .file_name()
            .ok_or_else(denied)?
            .to_string_lossy()
            .into_owned();
        let token = uuid::Uuid::new_v4().to_string();
        self.files.insert(
            token.clone(),
            BoundFile {
                owner: owner.into(),
                file,
            },
        );
        Ok(HandleInfo { token, name })
    }
    pub fn file(&self, owner: &str, token: &str) -> io::Result<&DocumentFile> {
        self.files
            .get(token)
            .filter(|f| f.owner == owner)
            .map(|f| &f.file)
            .ok_or_else(denied)
    }
    pub fn read(&self, owner: &str, token: &str, bound: bool) -> io::Result<Vec<u8>> {
        let f = self.file(owner, token)?;
        if bound {
            f.read_bound()
        } else {
            f.read()
        }
    }
    pub fn write(&mut self, owner: &str, token: &str, bytes: &[u8]) -> io::Result<()> {
        self.files
            .get_mut(token)
            .filter(|f| f.owner == owner)
            .ok_or_else(denied)?
            .file
            .write(bytes)
    }
    pub fn same(&self, owner: &str, a: &str, b: &str) -> io::Result<bool> {
        Ok(std::fs::canonicalize(&self.file(owner, a)?.path)?
            == std::fs::canonicalize(&self.file(owner, b)?.path)?)
    }
    pub fn revoke(&mut self, owner: &str) {
        self.files.retain(|_, f| f.owner != owner);
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cross_window_read_write_and_comparison_are_refused() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("a.hwpx");
        std::fs::write(&p, b"original").unwrap();
        let mut f = FileBindings::default();
        let a = f.register("main", p.clone()).unwrap();
        let b = f.register("document-b", p.clone()).unwrap();
        assert!(f.read("document-b", &a.token, false).is_err());
        assert!(f.write("document-b", &a.token, b"changed").is_err());
        assert!(f.same("main", &a.token, &b.token).is_err());
        assert_eq!(std::fs::read(p).unwrap(), b"original");
    }
    #[test]
    fn two_owned_handles_compare_but_close_revokes_only_its_owner() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("a.hwp");
        std::fs::write(&p, b"own").unwrap();
        let mut f = FileBindings::default();
        let a = f.register("main", p.clone()).unwrap();
        let b = f.register("main", p.clone()).unwrap();
        let c = f.register("child", p).unwrap();
        assert!(f.same("main", &a.token, &b.token).unwrap());
        f.revoke("main");
        assert!(f.read("main", &a.token, false).is_err());
        assert_eq!(f.read("child", &c.token, true).unwrap(), b"own");
    }
}
