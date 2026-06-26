// Mencegah jendela konsol tambahan muncul pada OS Windows di mode rilis
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    oura_app::run();
}