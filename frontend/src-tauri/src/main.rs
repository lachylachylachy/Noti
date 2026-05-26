// src-tauri/src/main.rs

#[tauri::command]
fn apple_calendar_status() -> String {
    "Apple Calendar integration coming online".into()
}

#[tauri::command]
fn apple_request_calendar_access() -> bool {
    true
}

#[tauri::command]
fn apple_list_calendars() -> Vec<String> {
    vec![
        "Personal".into(),
        "Work".into(),
        "Family".into(),
    ]
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            apple_calendar_status,
            apple_request_calendar_access,
            apple_list_calendars
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
