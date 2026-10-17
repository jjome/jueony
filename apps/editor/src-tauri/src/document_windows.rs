use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{self, Write},
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
fn invalid(s: &str) -> io::Error {
    io::Error::other(s)
}
pub fn valid_id(s: &str) -> bool {
    uuid::Uuid::parse_str(s)
        .map(|id| id.to_string() == s)
        .unwrap_or(false)
}
pub fn label(id: &str) -> String {
    format!("document-{id}")
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Opening,
    Ready,
    Closed,
    Failed,
}
#[derive(Clone, Serialize, Deserialize, PartialEq)]
pub struct Entry {
    pub id: String,
    pub phase: Phase,
    pub recoverable: bool,
    pub created_at: u64,
    pub error: Option<String>,
}
#[derive(Serialize, Deserialize)]
struct Request {
    id: String,
    owner: String,
    window_id: Option<String>,
    error: Option<String>,
}
#[derive(Serialize, Deserialize)]
struct Registry {
    version: u32,
    entries: Vec<Entry>,
    requests: Vec<Request>,
}
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Receipt {
    pub request_id: String,
    pub window_id: Option<String>,
    pub status: String,
    pub error: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Context {
    pub kind: String,
    pub window_id: Option<String>,
    pub label: String,
    pub scope: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub window_id: String,
    pub phase: Phase,
    pub recoverable: bool,
    pub created_at: u64,
}
pub struct WindowStore {
    path: PathBuf,
}
impl WindowStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
    fn read(&self) -> io::Result<Registry> {
        if fs::metadata(&self.path)
            .map(|m| m.len() > 1024 * 1024)
            .unwrap_or(false)
        {
            return Err(invalid("문서 창 목록이 너무 큽니다."));
        }
        let bytes = match fs::read(&self.path) {
            Ok(v) => v,
            Err(e) if e.kind() == io::ErrorKind::NotFound => {
                return Ok(Registry {
                    version: 1,
                    entries: vec![],
                    requests: vec![],
                })
            }
            Err(e) => return Err(e),
        };
        let r: Registry = serde_json::from_slice(&bytes)
            .map_err(|_| invalid("문서 창 목록이 손상되어 기존 기록을 유지합니다."))?;
        if r.version != 1 || r.entries.len() > 1000 || r.requests.len() > 5000 {
            return Err(invalid("지원하지 않는 문서 창 목록입니다."));
        }
        let mut ids = std::collections::HashSet::new();
        for e in &r.entries {
            if !valid_id(&e.id) || !ids.insert(&e.id) {
                return Err(invalid("문서 창 식별자가 올바르지 않습니다."));
            }
        }
        let mut requests = std::collections::HashSet::new();
        for q in &r.requests {
            if !valid_id(&q.id)
                || !valid_owner(&q.owner)
                || !requests.insert(&q.id)
                || q.window_id.as_ref().is_some_and(|id| !ids.contains(id))
            {
                return Err(invalid("문서 창 요청을 확인할 수 없습니다."));
            }
        }
        Ok(r)
    }
    fn write(&self, r: &Registry) -> io::Result<()> {
        let parent = self
            .path
            .parent()
            .ok_or_else(|| invalid("문서 창 저장 위치가 없습니다."))?;
        fs::create_dir_all(parent)?;
        let bytes = serde_json::to_vec(r)?;
        if bytes.len() > 1024 * 1024 {
            return Err(invalid("문서 창 목록 저장 한도에 도달했습니다."));
        }
        let mut staged = tempfile::NamedTempFile::new_in(parent)?;
        staged.write_all(&bytes)?;
        staged.as_file().sync_all()?;
        staged.persist(&self.path).map_err(|e| e.error)?;
        if fs::read(&self.path)? != bytes {
            return Err(invalid("문서 창 목록 저장 결과가 다릅니다."));
        }
        Ok(())
    }
    pub fn context(&self, owner: &str, url: &tauri::Url) -> io::Result<Context> {
        if !(matches!(
            (url.scheme(), url.host_str()),
            ("tauri", Some("localhost")) | ("http" | "https", Some("tauri.localhost"))
        ) && url.port().is_none()
            && url.username().is_empty()
            && url.password().is_none())
            || !matches!(url.path(), "/" | "/index.html")
            || url.fragment().is_some()
        {
            return Err(invalid("허용되지 않은 문서 창입니다."));
        }
        if owner == "main" {
            return Ok(Context {
                kind: "main".into(),
                window_id: None,
                label: owner.into(),
                scope: "main".into(),
            });
        }
        let id = owner
            .strip_prefix("document-")
            .filter(|id| valid_id(id))
            .ok_or_else(|| invalid("등록되지 않은 문서 창입니다."))?;
        let query: Vec<_> = url
            .query_pairs()
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect();
        if query != vec![("documentWindow".into(), id.into())]
            || !self.read()?.entries.iter().any(|e| e.id == id)
        {
            return Err(invalid("문서 창과 저장소 범위가 일치하지 않습니다."));
        }
        Ok(Context {
            kind: "document".into(),
            window_id: Some(id.into()),
            label: owner.into(),
            scope: id.into(),
        })
    }
    pub fn receipt(&self, owner: &str, request: &str) -> io::Result<Receipt> {
        let r = self.read()?;
        Self::receipt_from(&r, owner, request)
    }
    fn receipt_from(r: &Registry, owner: &str, request: &str) -> io::Result<Receipt> {
        let q = r
            .requests
            .iter()
            .find(|q| q.id == request && q.owner == owner)
            .ok_or_else(|| invalid("현재 창의 요청이 아닙니다."))?;
        let e = q
            .window_id
            .as_ref()
            .and_then(|id| r.entries.iter().find(|e| &e.id == id));
        Ok(Receipt {
            request_id: q.id.clone(),
            window_id: q.window_id.clone(),
            status: if q.error.is_some() {
                "failed".into()
            } else {
                e.map(|e| match e.phase {
                    Phase::Opening => "opening",
                    Phase::Ready => "ready",
                    Phase::Closed => "closed",
                    Phase::Failed => "failed",
                })
                .unwrap_or("failed")
                .into()
            },
            error: q.error.clone().or_else(|| e.and_then(|e| e.error.clone())),
        })
    }
    pub fn begin(
        &self,
        owner: &str,
        request: &str,
        restore: Option<&str>,
        active: usize,
    ) -> io::Result<Receipt> {
        self.begin_live(owner, request, restore, active, false)
    }
    pub fn begin_live(
        &self,
        owner: &str,
        request: &str,
        restore: Option<&str>,
        active: usize,
        live: bool,
    ) -> io::Result<Receipt> {
        if !valid_owner(owner) || !valid_id(request) {
            return Err(invalid("문서 창 요청 식별자가 올바르지 않습니다."));
        }
        let mut r = self.read()?;
        if r.requests.iter().any(|q| q.id == request) {
            return Self::receipt_from(&r, owner, request);
        }
        if r.requests.len() >= 5000 || r.entries.len() >= 1000 && restore.is_none() {
            return Err(invalid(
                "문서 창 기록 한도에 도달했습니다. 기존 기록은 보존했습니다.",
            ));
        }
        let target = if let Some(id) = restore {
            if !valid_id(id) || !r.entries.iter().any(|e| e.id == id) {
                return Err(invalid("목록에 없는 문서 창입니다."));
            }
            id.into()
        } else {
            uuid::Uuid::new_v4().to_string()
        };
        if active >= 30 {
            r.requests.push(Request {
                id: request.into(),
                owner: owner.into(),
                window_id: None,
                error: Some(
                    "문서 창은 30개까지 열 수 있습니다. 기존 창을 닫고 다시 시도하세요.".into(),
                ),
            });
            self.write(&r)?;
            return Self::receipt_from(&r, owner, request);
        }
        if let Some(e) = r.entries.iter_mut().find(|e| e.id == target) {
            if !live {
                e.phase = Phase::Opening;
                e.error = None;
            }
        } else {
            r.entries.push(Entry {
                id: target.clone(),
                phase: Phase::Opening,
                recoverable: true,
                created_at: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map_err(|_| invalid("시각을 확인할 수 없습니다."))?
                    .as_millis() as u64,
                error: None,
            });
        }
        r.requests.push(Request {
            id: request.into(),
            owner: owner.into(),
            window_id: Some(target),
            error: None,
        });
        self.write(&r)?;
        Self::receipt_from(&r, owner, request)
    }
    pub fn reopening(&self, id: &str) -> io::Result<()> {
        self.update(id, |e| {
            e.phase = Phase::Opening;
            e.error = None;
        })
    }
    pub fn ready(&self, id: &str) -> io::Result<()> {
        self.update(id, |e| {
            e.phase = Phase::Ready;
            e.error = None;
        })
    }
    pub fn failed(&self, id: &str, message: String) -> io::Result<()> {
        self.update(id, |e| {
            e.phase = Phase::Failed;
            e.error = Some(message);
        })
    }
    fn update(&self, id: &str, change: impl FnOnce(&mut Entry)) -> io::Result<()> {
        let mut r = self.read()?;
        let e = r
            .entries
            .iter_mut()
            .find(|e| e.id == id)
            .ok_or_else(|| invalid("등록되지 않은 문서 창입니다."))?;
        change(e);
        self.write(&r)
    }
    pub fn close(&self, id: &str, recoverable: bool) -> io::Result<(Entry, Entry)> {
        let mut r = self.read()?;
        let e = r
            .entries
            .iter_mut()
            .find(|e| e.id == id)
            .ok_or_else(|| invalid("등록되지 않은 문서 창입니다."))?;
        let before = e.clone();
        e.phase = Phase::Closed;
        e.recoverable = recoverable;
        let after = e.clone();
        self.write(&r)?;
        Ok((before, after))
    }
    pub fn undo_close(&self, before: Entry, after: Entry) -> io::Result<()> {
        let mut r = self.read()?;
        let e = r
            .entries
            .iter_mut()
            .find(|e| e.id == before.id)
            .ok_or_else(|| invalid("문서 창 기록이 없습니다."))?;
        if e != &after {
            return Err(invalid("문서 창 기록이 바뀌어 원복하지 않았습니다."));
        }
        *e = before;
        self.write(&r)
    }
    pub fn list(&self) -> io::Result<Vec<Summary>> {
        let mut e = self.read()?.entries;
        e.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(e.into_iter()
            .map(|e| Summary {
                window_id: e.id,
                phase: e.phase,
                recoverable: e.recoverable,
                created_at: e.created_at,
            })
            .collect())
    }
}
fn valid_owner(v: &str) -> bool {
    v == "main" || v.strip_prefix("document-").is_some_and(valid_id)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn setup() -> (tempfile::TempDir, WindowStore) {
        let d = tempfile::tempdir().unwrap();
        let s = WindowStore::new(d.path().join("windows.json"));
        (d, s)
    }
    fn req() -> String {
        uuid::Uuid::new_v4().to_string()
    }
    #[test]
    fn same_request_is_idempotent_and_owner_bound() {
        let (_d, s) = setup();
        let q = req();
        let a = s.begin("main", &q, None, 1).unwrap();
        let b = s.begin("main", &q, None, 2).unwrap();
        assert_eq!(a.window_id, b.window_id);
        assert_eq!(s.list().unwrap().len(), 1);
        assert!(s.receipt(&label(&req()), &q).is_err());
    }
    #[test]
    fn limit_failure_is_a_replayable_receipt_without_new_context() {
        let (_d, s) = setup();
        let q = req();
        let a = s.begin("main", &q, None, 30).unwrap();
        assert_eq!(a.status, "failed");
        assert!(a.window_id.is_none());
        assert!(s.list().unwrap().is_empty());
        assert_eq!(s.begin("main", &q, None, 1).unwrap().status, "failed");
    }
    #[test]
    fn restart_and_closed_window_reuse_exact_namespace() {
        let (d, s) = setup();
        let a = s.begin("main", &req(), None, 1).unwrap();
        let id = a.window_id.unwrap();
        s.ready(&id).unwrap();
        s.close(&id, true).unwrap();
        let r = WindowStore::new(d.path().join("windows.json"));
        assert_eq!(r.list().unwrap()[0].window_id, id);
        let b = r.begin("main", &req(), Some(&id), 1).unwrap();
        assert_eq!(b.window_id, Some(id));
        assert_eq!(r.list().unwrap().len(), 1);
    }
    #[test]
    fn context_requires_registered_label_and_exact_local_scope() {
        let (_d, s) = setup();
        let id = s.begin("main", &req(), None, 1).unwrap().window_id.unwrap();
        let good = format!("http://tauri.localhost/index.html?documentWindow={id}");
        assert_eq!(
            s.context(&label(&id), &good.parse().unwrap())
                .unwrap()
                .scope,
            id
        );
        for url in [
            format!("https://evil.invalid/?documentWindow={id}"),
            format!("http://localhost:9999/?documentWindow={id}"),
            format!("http://tauri.localhost:9999/?documentWindow={id}"),
            format!("http://tauri.localhost/index.html?documentWindow={}", req()),
            format!("http://tauri.localhost/editor.html?documentWindow={id}"),
            format!("http://tauri.localhost/?documentWindow={id}&extra=1"),
        ] {
            assert!(s.context(&label(&id), &url.parse().unwrap()).is_err());
        }
    }
    #[test]
    fn failed_creation_and_failed_destroy_are_explicit_and_reversible() {
        let (_d, s) = setup();
        let q = req();
        let id = s.begin("main", &q, None, 1).unwrap().window_id.unwrap();
        s.failed(&id, "fixture-build-failed".into()).unwrap();
        assert_eq!(s.receipt("main", &q).unwrap().status, "failed");
        s.ready(&id).unwrap();
        let (before, after) = s.close(&id, false).unwrap();
        s.undo_close(before, after).unwrap();
        assert_eq!(s.receipt("main", &q).unwrap().status, "ready");
    }
    #[test]
    fn unknown_restore_and_malformed_request_never_create_context() {
        let (_d, s) = setup();
        assert!(s.begin("main", &req(), Some(&req()), 1).is_err());
        assert!(s.begin("main", "../bad", None, 1).is_err());
        assert!(s.list().unwrap().is_empty());
    }
    #[test]
    fn focusing_an_opening_window_does_not_forge_readiness() {
        let (_d, s) = setup();
        let id = s.begin("main", &req(), None, 1).unwrap().window_id.unwrap();
        assert_eq!(
            s.begin_live("main", &req(), Some(&id), 1, true)
                .unwrap()
                .status,
            "opening"
        );
        s.ready(&id).unwrap();
        assert_eq!(
            s.begin_live("main", &req(), Some(&id), 1, true)
                .unwrap()
                .status,
            "ready"
        );
    }
    #[test]
    fn stale_ready_receipt_needs_a_new_readiness_proof() {
        let (_d, s) = setup();
        let q = req();
        let id = s.begin("main", &q, None, 1).unwrap().window_id.unwrap();
        s.ready(&id).unwrap();
        s.reopening(&id).unwrap();
        assert_eq!(s.receipt("main", &q).unwrap().status, "opening");
        s.ready(&id).unwrap();
        assert_eq!(s.receipt("main", &q).unwrap().status, "ready");
    }
    #[test]
    fn corrupt_registry_is_preserved() {
        let (d, s) = setup();
        fs::write(d.path().join("windows.json"), b"broken").unwrap();
        assert!(s.begin("main", &req(), None, 1).is_err());
        assert_eq!(fs::read(d.path().join("windows.json")).unwrap(), b"broken");
    }
}
