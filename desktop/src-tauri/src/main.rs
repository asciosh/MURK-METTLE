#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
fn main() {
    murk_mettle_desktop::app::run();
}

#[cfg(not(windows))]
fn main() {
    eprintln!(
        "The desktop host targets Windows 10/11. Use cargo test --lib for portable policy tests."
    );
    std::process::exit(1);
}
