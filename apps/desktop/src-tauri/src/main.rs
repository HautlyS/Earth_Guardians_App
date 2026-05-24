// Earth Guardians Desktop Application
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

fn main() {
    earth_guardians_desktop_lib::run()
}
