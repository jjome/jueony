use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fs, io::{self, Write}, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};
use crate::storage::DocumentFile;

#[derive(Serialize, Deserialize, Clone)]
struct Entry { id: String, workspace: String, path: PathBuf, name: String, fingerprint: String, opened_at: u64 }
#[derive(Serialize, Deserialize)]
struct Registry { version: u32, entries: Vec<Entry> }
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all="camelCase")]
pub struct RecentSummary { pub id: String, pub name: String, pub opened_at: u64 }
#[derive(Serialize, Debug)]
#[serde(rename_all="camelCase")]
pub struct Inspection { pub status: String, pub name: String, pub fingerprint: Option<String>, pub message: String }
pub struct RecentStore { file: PathBuf }
fn invalid(message: &str)->io::Error { io::Error::other(message) }
fn workspace(value: &str)->io::Result<()> {
    if value.is_empty() || value.len()>128 || !value.bytes().all(|c|c.is_ascii_alphanumeric()||c==b'-'||c==b'_') { return Err(invalid("업무 식별자가 올바르지 않습니다.")); } Ok(())
}
fn digest(bytes: &[u8])->String { format!("{:x}",Sha256::digest(bytes)) }
fn valid_digest(value: &str)->bool { value.len()==64&&value.bytes().all(|c|c.is_ascii_hexdigit()) }
impl RecentStore {
    pub fn new(file: PathBuf)->Self { Self {file} }
    fn read(&self)->io::Result<Registry> {
        if fs::metadata(&self.file).map(|m|m.len()>1024*1024).unwrap_or(false) {return Err(invalid("최근 문서 목록이 너무 큽니다."));}
        let bytes=match fs::read(&self.file){Ok(b)=>b,Err(e)if e.kind()==io::ErrorKind::NotFound=>return Ok(Registry{version:1,entries:vec![]}),Err(e)=>return Err(e)};
        if bytes.len()>1024*1024 {return Err(invalid("최근 문서 목록이 너무 큽니다."));}
        let registry:Registry=serde_json::from_slice(&bytes).map_err(|_|invalid("최근 문서 목록이 손상되었습니다. 원래 파일은 변경하지 않았습니다."))?;
        if registry.version!=1 || registry.entries.len()>1000 {return Err(invalid("지원하지 않는 최근 문서 목록입니다."));}
        let mut ids=std::collections::HashSet::new();
        for entry in &registry.entries {
            workspace(&entry.workspace)?;
            if uuid::Uuid::parse_str(&entry.id).is_err() || !ids.insert(&entry.id) || !entry.path.is_absolute() || !valid_digest(&entry.fingerprint)
                || entry.path.file_name().map(|s|s.to_string_lossy())!=Some(entry.name.as_str().into()) {
                return Err(invalid("최근 문서 연결 정보를 확인할 수 없습니다."));
            }
        }
        Ok(registry)
    }
    fn write(&self, registry:&Registry)->io::Result<()> {
        let parent=self.file.parent().ok_or_else(||invalid("최근 문서 저장소가 없습니다."))?;
        fs::create_dir_all(parent)?;
        let mut staged=tempfile::NamedTempFile::new_in(parent)?;
        let bytes=serde_json::to_vec(registry).map_err(|_|invalid("최근 문서 목록을 만들 수 없습니다."))?;
        staged.write_all(&bytes)?;staged.as_file().sync_all()?;
        staged.persist(&self.file).map_err(|e|io::Error::new(e.error.kind(),format!("최근 문서 목록 교체 실패: {}",e.error)))?;
        if fs::read(&self.file)?!=bytes {return Err(invalid("최근 문서 목록의 저장 결과를 확인하지 못했습니다."));} Ok(())
    }
    pub fn list(&self, scope:&str)->io::Result<Vec<RecentSummary>> {
        workspace(scope)?;let mut entries:Vec<_>=self.read()?.entries.into_iter().filter(|e|e.workspace==scope).collect();
        entries.sort_by(|a,b|b.opened_at.cmp(&a.opened_at).then(a.id.cmp(&b.id)));
        Ok(entries.into_iter().map(|e|RecentSummary{id:e.id,name:e.name,opened_at:e.opened_at}).collect())
    }
    pub fn remember(&self, scope:&str, file:&DocumentFile)->io::Result<()> {
        workspace(scope)?;let bytes=file.read_bound()?;
        let path=fs::canonicalize(&file.path).map_err(|e|io::Error::new(e.kind(),format!("최근 문서 위치 확인 실패: {e}")))?;
        let name=path.file_name().ok_or_else(||invalid("파일 이름이 없습니다."))?.to_string_lossy().into_owned();
        let mut registry=self.read()?;
        let old=registry.entries.iter().find(|e|e.workspace==scope&&e.path==path).map(|e|e.id.clone());
        registry.entries.retain(|e|!(e.workspace==scope&&e.path==path));
        if registry.entries.len()>=1000 {return Err(invalid("최근 문서 저장소 한도에 도달했습니다."));}
        registry.entries.push(Entry{id:old.unwrap_or_else(||uuid::Uuid::new_v4().to_string()),workspace:scope.into(),path,name,fingerprint:digest(&bytes),opened_at:SystemTime::now().duration_since(UNIX_EPOCH).map_err(|_|invalid("시각을 확인할 수 없습니다."))?.as_millis() as u64});
        let mut own:Vec<_>=registry.entries.iter().filter(|e|e.workspace==scope).map(|e|(e.opened_at,e.id.clone())).collect();own.sort_by(|a,b|b.cmp(a));
        let keep:std::collections::HashSet<_>=own.into_iter().take(20).map(|(_,id)|id).collect();
        registry.entries.retain(|e|e.workspace!=scope||keep.contains(&e.id));self.write(&registry)
    }
    fn entry(&self, scope:&str,id:&str)->io::Result<Entry> {
        workspace(scope)?;self.read()?.entries.into_iter().find(|e|e.workspace==scope&&e.id==id).ok_or_else(||invalid("현재 업무에 없는 최근 문서입니다. 목록을 다시 여세요."))
    }
    pub fn inspect(&self,scope:&str,id:&str)->io::Result<Inspection> {
        let entry=self.entry(scope,id)?;
        match fs::symlink_metadata(&entry.path) {
            Err(e)if e.kind()==io::ErrorKind::NotFound=>return Ok(Inspection{status:"missing".into(),name:entry.name,fingerprint:None,message:"원본 파일이 이동되거나 삭제되어 열지 않았습니다. 파일 열기로 위치를 다시 선택하세요.".into()}),
            Err(_)=>return Ok(Inspection{status:"unavailable".into(),name:entry.name,fingerprint:None,message:"원본 파일을 읽을 수 없습니다. 접근 권한과 잠금을 확인하세요.".into()}),
            Ok(meta)if !meta.file_type().is_file()=>return Ok(Inspection{status:"unavailable".into(),name:entry.name,fingerprint:None,message:"최근 문서의 원본이 일반 파일이 아니므로 열지 않았습니다.".into()}),_=>{}
        }
        let bytes=match DocumentFile::open(entry.path.clone()).and_then(|f|f.read_bound()) {Ok(b)=>b,Err(_)=>return Ok(Inspection{status:"unavailable".into(),name:entry.name,fingerprint:None,message:"원본 파일 읽기에 실패했습니다. 권한·공유 잠금·파일 크기를 확인하세요.".into()})};
        let fingerprint=digest(&bytes);let changed=fingerprint!=entry.fingerprint;
        Ok(Inspection{status:if changed{"changed"}else{"unchanged"}.into(),name:entry.name,fingerprint:Some(fingerprint),message:if changed{"원본 파일이 마지막으로 확인한 내용과 다릅니다. 현재 디스크 내용을 새로 열까요?"}else{""}.into()})
    }
    pub fn reopen(&self,scope:&str,id:&str,approved:&str)->io::Result<DocumentFile> {
        if !valid_digest(approved){return Err(invalid("원본 확인 정보가 올바르지 않습니다."));}
        let entry=self.entry(scope,id)?;let file=DocumentFile::open(entry.path)?;
        if digest(&file.read_bound()?)!=approved {return Err(invalid("확인 중 원본 파일이 다시 바뀌어 열지 않았습니다. 최근 목록에서 다시 선택하세요."));} Ok(file)
    }
    pub fn clear(&self,scope:&str)->io::Result<()> {workspace(scope)?;let mut registry=self.read()?;registry.entries.retain(|e|e.workspace!=scope);self.write(&registry)}
}

#[cfg(test)] mod tests {
    use super::*;
    fn setup()->(tempfile::TempDir,RecentStore,PathBuf){let dir=tempfile::tempdir().unwrap();let path=dir.path().join("same.hwpx");fs::write(&path,b"original").unwrap();let store=RecentStore::new(dir.path().join("app/recent.json"));(dir,store,path)}
    #[test]fn restart_reopens_exact_original_with_new_bound_file(){let(dir,store,path)=setup();store.remember("work-a",&DocumentFile::open(path.clone()).unwrap()).unwrap();let restarted=RecentStore::new(dir.path().join("app/recent.json"));let row=&restarted.list("work-a").unwrap()[0];let proof=restarted.inspect("work-a",&row.id).unwrap();assert_eq!(proof.status,"unchanged");let mut file=restarted.reopen("work-a",&row.id,proof.fingerprint.as_ref().unwrap()).unwrap();assert_eq!(file.read_bound().unwrap(),b"original");file.write(b"saved").unwrap();assert_eq!(fs::read(path).unwrap(),b"saved");}
    #[test]fn workspace_ids_cannot_cross_and_clear_is_scoped(){let(_dir,store,path)=setup();store.remember("a",&DocumentFile::open(path.clone()).unwrap()).unwrap();let id=store.list("a").unwrap()[0].id.clone();assert!(store.list("b").unwrap().is_empty());assert!(store.inspect("b",&id).is_err());assert!(store.reopen("b",&id,&digest(b"original")).is_err());store.remember("b",&DocumentFile::open(path).unwrap()).unwrap();store.clear("a").unwrap();assert!(store.list("a").unwrap().is_empty());assert_eq!(store.list("b").unwrap().len(),1);}
    #[test]fn changed_and_second_change_never_adopt_unapproved_bytes(){let(_dir,store,path)=setup();store.remember("a",&DocumentFile::open(path.clone()).unwrap()).unwrap();let id=store.list("a").unwrap()[0].id.clone();fs::write(&path,b"external").unwrap();let proof=store.inspect("a",&id).unwrap();assert_eq!(proof.status,"changed");assert!(store.reopen("a",&id,&digest(b"original")).is_err());fs::write(&path,b"again").unwrap();assert!(store.reopen("a",&id,proof.fingerprint.as_ref().unwrap()).is_err());assert_eq!(fs::read(path).unwrap(),b"again");}
    #[test]fn missing_original_is_not_recreated_and_record_survives(){let(_dir,store,path)=setup();store.remember("a",&DocumentFile::open(path.clone()).unwrap()).unwrap();let id=store.list("a").unwrap()[0].id.clone();fs::remove_file(&path).unwrap();assert_eq!(store.inspect("a",&id).unwrap().status,"missing");assert!(store.reopen("a",&id,&digest(b"original")).is_err());assert!(!path.exists());assert_eq!(store.list("a").unwrap().len(),1);}
    #[test]fn same_names_are_distinct_and_repeat_keeps_identity(){let(dir,store,path)=setup();let second=dir.path().join("other/same.hwpx");fs::create_dir(second.parent().unwrap()).unwrap();fs::write(&second,b"other").unwrap();store.remember("a",&DocumentFile::open(path.clone()).unwrap()).unwrap();let first=store.list("a").unwrap()[0].id.clone();store.remember("a",&DocumentFile::open(second).unwrap()).unwrap();store.remember("a",&DocumentFile::open(path).unwrap()).unwrap();let rows=store.list("a").unwrap();assert_eq!(rows.len(),2);assert!(rows.iter().any(|r|r.id==first));assert_ne!(rows[0].id,rows[1].id);}
    #[test]fn corrupt_registry_fails_without_overwrite(){let(dir,store,path)=setup();fs::create_dir(dir.path().join("app")).unwrap();fs::write(dir.path().join("app/recent.json"),b"invalid").unwrap();assert!(store.remember("a",&DocumentFile::open(path).unwrap()).is_err());assert_eq!(fs::read(dir.path().join("app/recent.json")).unwrap(),b"invalid");}
    #[test]fn saved_revision_updates_registry_but_later_external_change_blocks_writes(){let(_dir,store,path)=setup();let mut file=DocumentFile::open(path.clone()).unwrap();store.remember("a",&file).unwrap();let id=store.list("a").unwrap()[0].id.clone();file.write(b"saved revision").unwrap();store.remember("a",&file).unwrap();assert_eq!(store.list("a").unwrap()[0].id,id);let proof=store.inspect("a",&id).unwrap();assert_eq!(proof.status,"unchanged");let mut reopened=store.reopen("a",&id,proof.fingerprint.as_ref().unwrap()).unwrap();fs::write(&path,b"external after consent").unwrap();assert!(reopened.read_bound().is_err());assert!(reopened.write(b"lost update").is_err());assert_eq!(fs::read(path).unwrap(),b"external after consent");}
    #[test]fn directory_substitution_cannot_be_reopened_or_drop_the_record(){let(_dir,store,path)=setup();store.remember("a",&DocumentFile::open(path.clone()).unwrap()).unwrap();let id=store.list("a").unwrap()[0].id.clone();fs::remove_file(&path).unwrap();fs::create_dir(&path).unwrap();assert_eq!(store.inspect("a",&id).unwrap().status,"unavailable");assert!(store.reopen("a",&id,&digest(b"original")).is_err());assert_eq!(store.list("a").unwrap().len(),1);assert!(path.is_dir());}
    #[cfg(windows)]
    #[test]fn windows_locked_source_is_unavailable_and_retry_keeps_original_identity(){use std::os::windows::fs::OpenOptionsExt;let(_dir,store,path)=setup();store.remember("a",&DocumentFile::open(path.clone()).unwrap()).unwrap();let id=store.list("a").unwrap()[0].id.clone();let lock=fs::OpenOptions::new().read(true).write(true).share_mode(0).open(&path).unwrap();assert_eq!(store.inspect("a",&id).unwrap().status,"unavailable");assert!(store.reopen("a",&id,&digest(b"original")).is_err());assert_eq!(store.list("a").unwrap()[0].id,id);drop(lock);assert_eq!(store.inspect("a",&id).unwrap().status,"unchanged");assert_eq!(fs::read(path).unwrap(),b"original");}

    fn path_registry(dir: &std::path::Path, count: usize) -> Registry {
        // Historical missing files are valid records. Each component stays
        // below the Windows filename limit and the absolute paths below 32K.
        let mut parent = dir.to_path_buf();
        for _ in 0..12 { parent.push("r".repeat(100)); }
        Registry { version: 1, entries: (0..count).map(|i| {
            let name = format!("archived-{i}.hwpx");
            Entry { id: uuid::Uuid::new_v4().to_string(),
                workspace: format!("archive-{i}"), path: parent.join(&name),
                name, fingerprint: digest(b"original"), opened_at: i as u64 }
        }).collect() }
    }

    #[test]
    fn oversized_registry_is_refused_before_replacing_the_readable_catalog() {
        let (dir, store, path) = setup();
        store.remember("a", &DocumentFile::open(path.clone()).unwrap()).unwrap();
        let catalog = dir.path().join("app/recent.json");
        let before = fs::read(&catalog).unwrap();
        let large = path_registry(dir.path(), 800);
        assert!(large.entries.len() < 1000);
        assert!(serde_json::to_vec(&large).unwrap().len() > 1024 * 1024);
        assert!(store.write(&large).is_err(), "writer must honor the reader's size contract");
        assert_eq!(fs::read(&catalog).unwrap(), before);
        assert_eq!(store.list("a").unwrap().len(), 1);
        assert_eq!(fs::read(path).unwrap(), b"original");
        assert_eq!(fs::read_dir(catalog.parent().unwrap()).unwrap().count(), 1);
    }

    #[test]
    fn large_valid_registry_below_the_read_limit_still_roundtrips() {
        let (dir, store, _) = setup();
        let valid = path_registry(dir.path(), 600);
        assert!(serde_json::to_vec(&valid).unwrap().len() < 1024 * 1024);
        store.write(&valid).unwrap();
        assert_eq!(store.read().unwrap().entries.len(), 600);
        assert_eq!(store.list("archive-599").unwrap().len(), 1);
    }
}
