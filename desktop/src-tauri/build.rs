fn main() {
    println!("cargo:rerun-if-changed=../deployment.json");
    #[cfg(windows)]
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["start_game"])),
    )
    .expect("Tauri desktop build configuration is invalid");
}
