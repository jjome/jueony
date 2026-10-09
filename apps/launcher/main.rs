#![cfg_attr(not(test), windows_subsystem = "windows")]

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use std::{
    env, fs,
    io::{self, Read, Write},
    net::{TcpListener, TcpStream},
    path::{Component, Path, PathBuf},
    process::Command,
    time::Duration,
};

const ADDRESS: &str = "127.0.0.1:4173";
const CSP: &str = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";

fn percent_decode(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hex = std::str::from_utf8(bytes.get(index + 1..index + 3)?).ok()?;
            decoded.push(u8::from_str_radix(hex, 16).ok()?);
            index += 3;
        } else { decoded.push(bytes[index]); index += 1; }
    }
    String::from_utf8(decoded).ok()
}

fn asset_path(root: &Path, request: &str) -> Option<PathBuf> {
    let decoded = percent_decode(request.split('?').next()?)?;
    if !decoded.starts_with('/') || decoded.contains(['\\', ':', '\0']) { return None; }
    let relative = if decoded == "/" { "index.html" } else { decoded.trim_start_matches('/') };
    let path = Path::new(relative);
    if path.components().any(|component| !matches!(component, Component::Normal(_))) { return None; }
    let canonical = root.join(path).canonicalize().ok()?;
    if !canonical.starts_with(root) || !canonical.is_file() { return None; }
    Some(canonical)
}

fn mime(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8", "js" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8", "json" => "application/json",
        "wasm" => "application/wasm", "woff2" => "font/woff2", "woff" => "font/woff",
        "ttf" => "font/ttf", "otf" => "font/otf", "png" => "image/png", "jpg" | "jpeg" => "image/jpeg",
        "svg" => "image/svg+xml", "ico" => "image/x-icon", _ => "application/octet-stream",
    }
}

fn respond(mut stream: TcpStream, root: &Path) -> io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(3)))?;
    stream.set_write_timeout(Some(Duration::from_secs(15)))?;
    let mut request = Vec::new();
    let mut chunk = [0u8; 2048];
    while request.len() < 16384 && !request.windows(4).any(|part| part == b"\r\n\r\n") {
        let read = stream.read(&mut chunk)?;
        if read == 0 { return Ok(()); }
        request.extend_from_slice(&chunk[..read]);
    }
    let text = String::from_utf8_lossy(&request);
    let mut lines = text.lines();
    let mut words = lines.next().unwrap_or("").split_whitespace();
    let method = words.next().unwrap_or("");
    let target = words.next().unwrap_or("");
    let valid_host = lines.any(|line| line.split_once(':').is_some_and(|(key, value)| {
        key.eq_ignore_ascii_case("host") && matches!(value.trim(), "127.0.0.1:4173" | "localhost:4173")
    }));
    let path = if valid_host && matches!(method, "GET" | "HEAD") { asset_path(root, target) } else { None };
    match path {
        Some(path) => {
            let bytes = fs::read(&path)?;
            write!(stream, "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: {}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: {}\r\nConnection: close\r\n\r\n", bytes.len(), mime(&path), CSP)?;
            if method != "HEAD" { stream.write_all(&bytes)?; }
        },
        None => { stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")?; },
    }
    Ok(())
}

fn existing_editor() -> bool {
    let Ok(address) = ADDRESS.parse() else { return false; };
    let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_secs(1)) else { return false; };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    if stream.write_all(b"GET /api/health HTTP/1.1\r\nHost: 127.0.0.1:4173\r\nConnection: close\r\n\r\n").is_err() { return false; }
    let mut response = String::new();
    if stream.take(65536).read_to_string(&mut response).is_err() { return false; }
    response.contains("\"application\":\"jueony\"") && response.contains("\"apiVersion\":1")
}

fn open_editor() -> io::Result<()> {
    let locations = [
        ("PROGRAMFILES(X86)", "Microsoft/Edge/Application/msedge.exe"),
        ("PROGRAMFILES", "Google/Chrome/Application/chrome.exe"),
        ("PROGRAMFILES", "Microsoft/Edge/Application/msedge.exe"),
        ("LOCALAPPDATA", "Google/Chrome/Application/chrome.exe"),
    ];
    for (variable, suffix) in locations {
        if let Some(base) = env::var_os(variable) {
            let browser = PathBuf::from(base).join(suffix);
            if browser.is_file() {
                Command::new(browser).arg("--app=http://127.0.0.1:4173/").arg("--window-size=1440,960").spawn()?;
                return Ok(());
            }
        }
    }
    Err(io::Error::other("Microsoft Edge 또는 Google Chrome이 필요합니다."))
}

fn run() -> io::Result<()> {
    let args: Vec<_> = env::args().collect();
    let serve_only = args.iter().any(|arg| arg == "--serve-only");
    let executable = env::current_exe()?;
    let root = executable.parent().ok_or_else(|| io::Error::other("실행 경로 오류"))?.join("dist").canonicalize()?;
    if !root.join("editor.html").is_file() { return Err(io::Error::other("dist 폴더가 없습니다.")); }
    let base = executable.parent().unwrap();
    let node = base.join("runtime/node.exe");
    let server = base.join("server.mjs");
    if node.is_file() && server.is_file() {
        if !existing_editor() {
            let mut command = Command::new(&node);
            command.arg(&server).current_dir(base);
            #[cfg(windows)]
            command.creation_flags(0x08000000);
            command.spawn()?;
            for _ in 0..50 {
                if existing_editor() { break; }
                std::thread::sleep(Duration::from_millis(100));
            }
            if !existing_editor() { return Err(io::Error::other("로컬 업무 서버 시작 실패")); }
        }
        return if serve_only { Ok(()) } else { open_editor() };
    }
    let listener = match TcpListener::bind(ADDRESS) {
        Ok(listener) => listener,
        Err(error) if error.kind() == io::ErrorKind::AddrInUse && existing_editor() => {
            return if serve_only { Ok(()) } else { open_editor() };
        },
        Err(error) => return Err(error),
    };
    if !serve_only { open_editor()?; }
    // 루프백 정적 자산만 제공한다. 문서 파일, 경로 목록, 쓰기 API를 노출하지 않는다.
    for connection in listener.incoming() {
        let stream = connection?;
        // 작은 고정 버퍼로 요청을 제한하고, 파일을 순차 제공해 연결 폭주로 스레드가 늘지 않게 한다.
        let _ = respond(stream, &root);
    }
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        if let Ok(executable) = env::current_exe() {
            let _ = fs::write(executable.with_file_name("launcher-error.txt"), error.to_string());
        }
        eprintln!("{error}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_traversal_encoded_separators_and_invalid_utf8() {
        let root = env::current_dir().unwrap();
        for request in ["/../Cargo.toml", "/%2e%2e/Cargo.toml", "/C:/Windows/win.ini", "/%5cWindows", "/%00", "/%FF", "https://example.com"] {
            assert!(asset_path(&root, request).is_none(), "{request}");
        }
    }
    #[test]
    fn decoding_and_binary_content_types() {
        assert_eq!(percent_decode("/%ED%95%9C%EA%B8%80"), Some("/한글".into()));
        assert_eq!(mime(Path::new("engine.wasm")), "application/wasm");
        assert_eq!(mime(Path::new("font.woff2")), "font/woff2");
        assert!(percent_decode("/bad%2").is_none());
    }
}
