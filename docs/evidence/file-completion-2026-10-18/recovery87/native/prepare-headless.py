from pathlib import Path
import shutil,json,hashlib,sys
root=Path(__file__).resolve().parents[2]
out=Path(__file__).resolve().parent
phase=sys.argv[1]
source=root/'apps/editor/src-tauri'
dest=out/(phase+'-source')
dest.mkdir(exist_ok=False)
(dest/'src').mkdir()
for name in ['Cargo.toml','Cargo.lock']:
 shutil.copyfile(source/name,dest/name)
files=['storage.rs','native_recents.rs','file_bindings.rs','document_windows.rs']
proof={}
for name in files:
 shutil.copyfile(source/'src'/name,dest/'src'/name)
 proof[name]=hashlib.sha256((dest/'src'/name).read_bytes()).hexdigest()
shutil.copyfile(root/'apps/editor/LICENSE.txt',out/'LICENSE.txt')
manifest=(dest/'Cargo.toml').read_text(encoding='utf8')
manifest=manifest.replace('publish = false','publish = false\nautobins = false',1)
(dest/'Cargo.toml').write_text(manifest,encoding='utf8')
lib='\n'.join('pub mod '+f[:-3]+';' for f in files)+'\n'
lib+='''#[cfg(test)] mod headless_source_proof {
 use sha2::{Digest,Sha256};
 #[test] fn compiled_native_modules_match_the_tested_copy() {
  let root=std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
  for (name,compiled) in [("storage.rs",include_bytes!("storage.rs").as_slice()),("native_recents.rs",include_bytes!("native_recents.rs").as_slice()),("file_bindings.rs",include_bytes!("file_bindings.rs").as_slice()),("document_windows.rs",include_bytes!("document_windows.rs").as_slice())] {
   assert_eq!(compiled,std::fs::read(root.join("src").join(name)).unwrap());
   println!("COMPILED_SOURCE {} {:x}",name,Sha256::digest(compiled));
  }
 }
}
'''
(dest/'src/lib.rs').write_text(lib,encoding='utf8')
(out/(phase+'-source-proof.json')).write_text(json.dumps({'phase':phase,'head':'f3a498f5','nativeFiles':proof,'scope':'Library test harness only; no main.rs/build.rs/Tauri app startup/GUI/server.'},indent=2),encoding='utf8')
print(dest)
