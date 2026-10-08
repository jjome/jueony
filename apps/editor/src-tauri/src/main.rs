#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod storage;

use serde::Serialize;
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct Documents(Mutex<HashMap<String, storage::DocumentFile>>);

#[derive(Serialize)]
struct HandleInfo {
    token: String,
    name: String,
}

fn register(app: &tauri::AppHandle, path: PathBuf) -> Result<HandleInfo, String> {
    let file = storage::DocumentFile::open(path).map_err(|e| e.to_string())?;
    let name = file.path.file_name().ok_or("파일 이름이 없습니다.")?.to_string_lossy().into_owned();
    let token = uuid::Uuid::new_v4().to_string();
    app.state::<Documents>().0.lock().map_err(|e| e.to_string())?.insert(token.clone(), file);
    Ok(HandleInfo { token, name })
}

#[tauri::command]
async fn pick_document(app: tauri::AppHandle) -> Result<Option<HandleInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app.dialog().file().add_filter("한글 문서", &["hwp", "hwpx"]).blocking_pick_file();
        selected.map(|p| p.into_path().map_err(|e| e.to_string()).and_then(|p| register(&app, p))).transpose()
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pick_save_document(app: tauri::AppHandle, suggested_name: String) -> Result<Option<HandleInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let extension = if suggested_name.to_lowercase().ends_with(".hwp") { "hwp" } else { "hwpx" };
        let name = PathBuf::from(&suggested_name).file_name().unwrap_or_default().to_string_lossy().into_owned();
        let selected = app.dialog().file().set_file_name(name).add_filter("한글 문서", &[extension]).blocking_save_file();
        selected.map(|p| p.into_path().map_err(|e| e.to_string()).and_then(|p| register(&app, p))).transpose()
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn read_document(documents: State<Documents>, token: String) -> Result<Vec<u8>, String> {
    documents.0.lock().map_err(|e| e.to_string())?.get_mut(&token)
        .ok_or("허용되지 않은 파일입니다.")?.read().map_err(|e| e.to_string())
}

#[tauri::command]
fn write_document(documents: State<Documents>, token: String, bytes: Vec<u8>) -> Result<(), String> {
    documents.0.lock().map_err(|e| e.to_string())?.get_mut(&token)
        .ok_or("허용되지 않은 파일입니다.")?.write(&bytes).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .manage(Documents::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![pick_document, pick_save_document, read_document, write_document])
        .run(tauri::generate_context!())
        .expect("편집기를 시작하지 못했습니다.");
}
