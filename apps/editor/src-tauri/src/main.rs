#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod document_windows;
mod file_bindings;
mod native_recents;
mod storage;
use file_bindings::HandleInfo;
use std::{collections::HashSet, path::PathBuf, sync::Mutex};
use tauri::{Manager, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
#[derive(Default)]
struct Documents(Mutex<file_bindings::FileBindings>);
struct NativeRecents(Mutex<PathBuf>);
struct NativeWindows {
    launch: Mutex<()>,
    store: Mutex<document_windows::WindowStore>,
    capabilities: Mutex<HashSet<String>>,
}
fn context(
    app: &tauri::AppHandle,
    window: &WebviewWindow,
) -> Result<document_windows::Context, String> {
    app.state::<NativeWindows>()
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .context(window.label(), &window.url().map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}
fn recent(
    path: &std::path::Path,
    scope: &document_windows::Context,
) -> native_recents::RecentStore {
    native_recents::RecentStore::new(path.join(if scope.kind == "main" {
        "recent-documents-v1.json".into()
    } else {
        format!("recent-documents-{}.json", scope.scope)
    }))
}
fn register(app: &tauri::AppHandle, owner: &str, path: PathBuf) -> Result<HandleInfo, String> {
    app.state::<Documents>()
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .register(owner, path)
        .map_err(|e| e.to_string())
}
#[tauri::command]
async fn pick_document(
    app: tauri::AppHandle,
    window: WebviewWindow,
) -> Result<Option<HandleInfo>, String> {
    let owner = context(&app, &window)?.label;
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .set_parent(&window)
            .add_filter("한글 문서", &["hwp", "hwpx"])
            .blocking_pick_file();
        selected
            .map(|p| {
                p.into_path()
                    .map_err(|e| e.to_string())
                    .and_then(|p| register(&app, &owner, p))
            })
            .transpose()
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn pick_save_document(
    app: tauri::AppHandle,
    window: WebviewWindow,
    suggested_name: String,
) -> Result<Option<HandleInfo>, String> {
    let owner = context(&app, &window)?.label;
    tauri::async_runtime::spawn_blocking(move || {
        let extension = if suggested_name.to_lowercase().ends_with(".hwp") {
            "hwp"
        } else {
            "hwpx"
        };
        let name = PathBuf::from(&suggested_name)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned();
        let selected = app
            .dialog()
            .file()
            .set_parent(&window)
            .set_file_name(name)
            .add_filter("한글 문서", &[extension])
            .blocking_save_file();
        selected
            .map(|p| {
                p.into_path()
                    .map_err(|e| e.to_string())
                    .and_then(|p| register(&app, &owner, p))
            })
            .transpose()
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn pick_save_hwt_copy(
    app: tauri::AppHandle,
    window: WebviewWindow,
    suggested_name: String,
) -> Result<Option<HandleInfo>, String> {
    let owner = context(&app, &window)?.label;
    tauri::async_runtime::spawn_blocking(move || {
        let name = PathBuf::from(&suggested_name).file_name().unwrap_or_default().to_string_lossy().into_owned();
        if !name.to_ascii_lowercase().ends_with(".hwt") { return Err("HWT 사본 이름이 필요합니다.".into()); }
        app.dialog().file().set_parent(&window).set_file_name(name)
            .add_filter("HWT 일반 필드 사본", &["hwt"]).blocking_save_file()
            .map(|selected| {
                let path = selected.into_path().map_err(|e| e.to_string())?;
                let file = storage::DocumentFile::open_hwt_copy(path).map_err(|e| e.to_string())?;
                app.state::<Documents>().0.lock().map_err(|e| e.to_string())?
                    .insert(&owner, file).map_err(|e| e.to_string())
            }).transpose()
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
fn read_hwt_copy(app: tauri::AppHandle, window: WebviewWindow, documents: State<Documents>, token: String) -> Result<Vec<u8>, String> {
    let owner=context(&app,&window)?.label;
    documents.0.lock().map_err(|e| e.to_string())?.file(&owner,&token)
        .and_then(|file| file.read_hwt_copy()).map_err(|e| e.to_string())
}
#[tauri::command]
fn read_document(
    app: tauri::AppHandle,
    window: WebviewWindow,
    documents: State<Documents>,
    token: String,
) -> Result<Vec<u8>, String> {
    let owner = context(&app, &window)?.label;
    documents
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .read(&owner, &token, false)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn read_bound_document(
    app: tauri::AppHandle,
    window: WebviewWindow,
    documents: State<Documents>,
    token: String,
) -> Result<Vec<u8>, String> {
    let owner = context(&app, &window)?.label;
    documents
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .read(&owner, &token, true)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn write_document(
    app: tauri::AppHandle,
    window: WebviewWindow,
    documents: State<Documents>,
    token: String,
    bytes: Vec<u8>,
) -> Result<(), String> {
    let owner = context(&app, &window)?.label;
    documents
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .write(&owner, &token, &bytes)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn same_document(
    app: tauri::AppHandle,
    window: WebviewWindow,
    documents: State<Documents>,
    token: String,
    other_token: String,
) -> Result<bool, String> {
    let owner = context(&app, &window)?.label;
    documents
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .same(&owner, &token, &other_token)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn remember_recent_document(
    app: tauri::AppHandle,
    window: WebviewWindow,
    documents: State<Documents>,
    recents: State<NativeRecents>,
    workspace: String,
    token: String,
) -> Result<(), String> {
    let scope = context(&app, &window)?;
    let documents = documents.0.lock().map_err(|e| e.to_string())?;
    let file = documents
        .file(&scope.label, &token)
        .map_err(|e| e.to_string())?;
    let path = recents.0.lock().map_err(|e| e.to_string())?;
    recent(&path, &scope)
        .remember(&workspace, file)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn list_recent_documents(
    app: tauri::AppHandle,
    window: WebviewWindow,
    recents: State<NativeRecents>,
    workspace: String,
) -> Result<Vec<native_recents::RecentSummary>, String> {
    let scope = context(&app, &window)?;
    let path = recents.0.lock().map_err(|e| e.to_string())?;
    recent(&path, &scope)
        .list(&workspace)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn inspect_recent_document(
    app: tauri::AppHandle,
    window: WebviewWindow,
    recents: State<NativeRecents>,
    workspace: String,
    id: String,
) -> Result<native_recents::Inspection, String> {
    let scope = context(&app, &window)?;
    let path = recents.0.lock().map_err(|e| e.to_string())?;
    recent(&path, &scope)
        .inspect(&workspace, &id)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn reopen_recent_document(
    app: tauri::AppHandle,
    window: WebviewWindow,
    documents: State<Documents>,
    recents: State<NativeRecents>,
    workspace: String,
    id: String,
    fingerprint: String,
) -> Result<HandleInfo, String> {
    let scope = context(&app, &window)?;
    let file = {
        let path = recents.0.lock().map_err(|e| e.to_string())?;
        recent(&path, &scope)
            .reopen(&workspace, &id, &fingerprint)
            .map_err(|e| e.to_string())?
    };
    documents
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .insert(&scope.label, file)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn clear_recent_documents(
    app: tauri::AppHandle,
    window: WebviewWindow,
    recents: State<NativeRecents>,
    workspace: String,
) -> Result<(), String> {
    let scope = context(&app, &window)?;
    let path = recents.0.lock().map_err(|e| e.to_string())?;
    recent(&path, &scope)
        .clear(&workspace)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn document_window_context(
    app: tauri::AppHandle,
    window: WebviewWindow,
) -> Result<document_windows::Context, String> {
    context(&app, &window)
}
#[tauri::command]
fn document_window_request(
    app: tauri::AppHandle,
    window: WebviewWindow,
    request_id: String,
) -> Result<document_windows::Receipt, String> {
    let owner = context(&app, &window)?.label;
    app.state::<NativeWindows>()
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .receipt(&owner, &request_id)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn list_document_windows(
    app: tauri::AppHandle,
    window: WebviewWindow,
) -> Result<Vec<document_windows::Summary>, String> {
    context(&app, &window)?;
    app.state::<NativeWindows>()
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .list()
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn ready_document_window(app: tauri::AppHandle, window: WebviewWindow) -> Result<(), String> {
    let scope = context(&app, &window)?;
    let id = scope.window_id.ok_or("별도 문서 창이 아닙니다.")?;
    app.state::<NativeWindows>()
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .ready(&id)
        .map_err(|e| e.to_string())
}
#[tauri::command]
async fn open_document_window(
    app: tauri::AppHandle,
    window: WebviewWindow,
    request_id: String,
    restore_id: Option<String>,
) -> Result<document_windows::Receipt, String> {
    let owner = context(&app, &window)?.label;
    let windows = app.state::<NativeWindows>();
    let _launch = windows.launch.lock().map_err(|e| e.to_string())?;
    let existing = restore_id
        .as_ref()
        .and_then(|id| app.get_webview_window(&document_windows::label(id)));
    let active = app
        .webview_windows()
        .len()
        .saturating_sub(usize::from(existing.is_some()));
    let mut receipt = app
        .state::<NativeWindows>()
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .begin_live(
            &owner,
            &request_id,
            restore_id.as_deref(),
            active,
            existing.is_some(),
        )
        .map_err(|e| e.to_string())?;
    if receipt.status == "ready" {
        let id = receipt
            .window_id
            .as_ref()
            .ok_or("문서 창 식별자가 없습니다.")?;
        if let Some(target) = app.get_webview_window(&document_windows::label(id)) {
            target.set_focus().map_err(|e| e.to_string())?;
            return Ok(receipt);
        }
        app.state::<NativeWindows>()
            .store
            .lock()
            .map_err(|e| e.to_string())?
            .reopening(id)
            .map_err(|e| e.to_string())?;
        receipt = app
            .state::<NativeWindows>()
            .store
            .lock()
            .map_err(|e| e.to_string())?
            .receipt(&owner, &request_id)
            .map_err(|e| e.to_string())?;
    }
    if receipt.status != "opening" {
        return Ok(receipt);
    }
    let id = receipt
        .window_id
        .clone()
        .ok_or("문서 창 식별자가 없습니다.")?;
    let label = document_windows::label(&id);
    if let Some(existing) = app.get_webview_window(&label) {
        existing.set_focus().map_err(|e| e.to_string())?;
    } else {
        if app.webview_windows().len() >= 30 {
            app.state::<NativeWindows>()
                .store
                .lock()
                .map_err(|e| e.to_string())?
                .failed(
                    &id,
                    "문서 창은 30개까지 열 수 있습니다. 기존 창은 유지합니다.".into(),
                )
                .map_err(|e| e.to_string())?;
            return app
                .state::<NativeWindows>()
                .store
                .lock()
                .map_err(|e| e.to_string())?
                .receipt(&owner, &request_id)
                .map_err(|e| e.to_string());
        }
        let result = (|| -> Result<(), String> {
            let state = app.state::<NativeWindows>();
            let mut caps = state.capabilities.lock().map_err(|e| e.to_string())?;
            if !caps.contains(&id) {
                let capability = serde_json::json!({"identifier":format!("document-editor-{id}"),"local":true,"windows":[label.clone()],"permissions":["core:default"]});
                app.add_capability(capability.to_string())
                    .map_err(|e| e.to_string())?;
                caps.insert(id.clone());
            }
            drop(caps);
            tauri::WebviewWindowBuilder::new(
                &app,
                label,
                tauri::WebviewUrl::App(format!("index.html?documentWindow={id}").into()),
            )
            .title("Jueony · 독립 문서 창")
            .inner_size(1440.0, 960.0)
            .min_inner_size(980.0, 640.0)
            .disable_drag_drop_handler()
            .build()
            .map_err(|e| e.to_string())?;
            Ok(())
        })();
        if let Err(error) = result {
            app.state::<NativeWindows>()
                .store
                .lock()
                .map_err(|e| e.to_string())?
                .failed(&id, error)
                .map_err(|e| e.to_string())?;
        }
    }
    app.state::<NativeWindows>()
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .receipt(&owner, &request_id)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn close_document_window(
    app: tauri::AppHandle,
    window: WebviewWindow,
    recoverable: bool,
) -> Result<(), String> {
    let scope = context(&app, &window)?;
    let id = scope.window_id.ok_or("별도 문서 창이 아닙니다.")?;
    let ticket = app
        .state::<NativeWindows>()
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .close(&id, recoverable)
        .map_err(|e| e.to_string())?;
    if let Err(error) = window.destroy() {
        app.state::<NativeWindows>()
            .store
            .lock()
            .map_err(|e| e.to_string())?
            .undo_close(ticket.0, ticket.1)
            .map_err(|e| e.to_string())?;
        return Err(error.to_string());
    }
    Ok(())
}
fn main() {
    tauri::Builder::default()
        .manage(Documents::default())
        .setup(|app| {
            let root = app.path().app_data_dir()?;
            app.manage(NativeRecents(Mutex::new(root.clone())));
            app.manage(NativeWindows {
                launch: Mutex::new(()),
                store: Mutex::new(document_windows::WindowStore::new(
                    root.join("document-windows-v1.json"),
                )),
                capabilities: Mutex::new(HashSet::new()),
            });
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                if let Some(documents) = window.try_state::<Documents>() {
                    if let Ok(mut files) = documents.0.lock() {
                        files.revoke(window.label());
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            pick_document,
            pick_save_document,
            pick_save_hwt_copy,
            read_hwt_copy,
            read_document,
            read_bound_document,
            write_document,
            same_document,
            remember_recent_document,
            list_recent_documents,
            inspect_recent_document,
            reopen_recent_document,
            clear_recent_documents,
            document_window_context,
            document_window_request,
            list_document_windows,
            ready_document_window,
            open_document_window,
            close_document_window
        ])
        .run(tauri::generate_context!())
        .expect("편집기를 시작하지 못했습니다.");
}
