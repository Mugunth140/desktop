use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};

// ============================================
// BACKUP/RESTORE TYPES
// ============================================

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupResult {
    pub filename: String,
    pub path: String,
    pub file_size: u64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupFileInfo {
    pub filename: String,
    pub path: String,
    pub file_size: u64,
    pub modified_at: String,
}

// ============================================
// HELPER FUNCTIONS
// ============================================

fn get_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    // tauri-plugin-sql stores databases in the app config directory
    let app_config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(app_config_dir.join("motormods.db"))
}

fn get_backups_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let backups_dir = app_config_dir.join("backups");

    if !backups_dir.exists() {
        fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;
    }

    Ok(backups_dir)
}

// ============================================
// TAURI COMMANDS
// ============================================

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Creates a backup of the database and returns detailed information
#[tauri::command]
fn backup_database(app: AppHandle) -> Result<BackupResult, String> {
    let db_path = get_db_path(&app)?;
    let backups_dir = get_backups_dir(&app)?;

    // Verify source database exists
    if !db_path.exists() {
        return Err("Database file not found".to_string());
    }

    // Generate backup filename with timestamp
    let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let backup_filename = format!("motormods_backup_{}.db", timestamp);
    let backup_path = backups_dir.join(&backup_filename);

    // Perform the copy
    fs::copy(&db_path, &backup_path).map_err(|e| format!("Failed to backup database: {}", e))?;

    // Get file size
    let metadata =
        fs::metadata(&backup_path).map_err(|e| format!("Failed to get backup metadata: {}", e))?;

    Ok(BackupResult {
        filename: backup_filename,
        path: backup_path.to_string_lossy().to_string(),
        file_size: metadata.len(),
        created_at: Local::now().to_rfc3339(),
    })
}

/// Lists all backup files in the backups directory
#[tauri::command]
fn list_backups(app: AppHandle) -> Result<Vec<BackupFileInfo>, String> {
    let backups_dir = get_backups_dir(&app)?;

    let mut backups: Vec<BackupFileInfo> = Vec::new();

    if let Ok(entries) = fs::read_dir(&backups_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "db") {
                if let Ok(metadata) = fs::metadata(&path) {
                    let modified = metadata
                        .modified()
                        .map(|t| {
                            let datetime: chrono::DateTime<Local> = t.into();
                            datetime.to_rfc3339()
                        })
                        .unwrap_or_else(|_| "Unknown".to_string());

                    backups.push(BackupFileInfo {
                        filename: path
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_default(),
                        path: path.to_string_lossy().to_string(),
                        file_size: metadata.len(),
                        modified_at: modified,
                    });
                }
            }
        }
    }

    // Sort by modified date descending
    backups.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    Ok(backups)
}

/// Restores the database from a backup file
#[tauri::command]
fn restore_database(app: AppHandle, backup_filename: String) -> Result<String, String> {
    let db_path = get_db_path(&app)?;
    let backups_dir = get_backups_dir(&app)?;
    let backup_path = backups_dir.join(&backup_filename);

    // Verify backup exists
    if !backup_path.exists() {
        return Err(format!("Backup file not found: {}", backup_filename));
    }

    // Create a safety backup of current database before restore
    let safety_filename = format!(
        "pre_restore_safety_{}.db",
        Local::now().format("%Y-%m-%d_%H-%M-%S")
    );
    let safety_path = backups_dir.join(&safety_filename);

    if db_path.exists() {
        fs::copy(&db_path, &safety_path)
            .map_err(|e| format!("Failed to create safety backup: {}", e))?;
    }

    // Perform the restore
    fs::copy(&backup_path, &db_path).map_err(|e| format!("Failed to restore database: {}", e))?;

    Ok(format!(
        "Database restored from {}. Safety backup created: {}",
        backup_filename, safety_filename
    ))
}

/// Restores from an external backup file path
#[tauri::command]
fn import_backup(app: AppHandle, source_path: String) -> Result<String, String> {
    let db_path = get_db_path(&app)?;
    let backups_dir = get_backups_dir(&app)?;
    let source = PathBuf::from(&source_path);

    // Verify source exists and is a .db file
    if !source.exists() {
        return Err("Source backup file not found".to_string());
    }

    if source.extension().map_or(true, |ext| ext != "db") {
        return Err("Invalid backup file. Expected .db file".to_string());
    }

    // Create a safety backup first
    let safety_filename = format!(
        "pre_import_safety_{}.db",
        Local::now().format("%Y-%m-%d_%H-%M-%S")
    );
    let safety_path = backups_dir.join(&safety_filename);

    if db_path.exists() {
        fs::copy(&db_path, &safety_path)
            .map_err(|e| format!("Failed to create safety backup: {}", e))?;
    }

    // Restore from external file
    fs::copy(&source, &db_path).map_err(|e| format!("Failed to import backup: {}", e))?;

    Ok(format!(
        "Database imported from external backup. Safety backup created: {}",
        safety_filename
    ))
}

/// Exports a backup to a specified destination
#[tauri::command]
fn export_backup(
    app: AppHandle,
    backup_filename: String,
    destination_path: String,
) -> Result<String, String> {
    let backups_dir = get_backups_dir(&app)?;
    let backup_path = backups_dir.join(&backup_filename);
    let destination = PathBuf::from(&destination_path);

    if !backup_path.exists() {
        return Err(format!("Backup file not found: {}", backup_filename));
    }

    fs::copy(&backup_path, &destination).map_err(|e| format!("Failed to export backup: {}", e))?;

    Ok(format!("Backup exported to: {}", destination_path))
}

/// Deletes a specific backup file
#[tauri::command]
fn delete_backup(app: AppHandle, backup_filename: String) -> Result<String, String> {
    let backups_dir = get_backups_dir(&app)?;
    let backup_path = backups_dir.join(&backup_filename);

    if !backup_path.exists() {
        return Err(format!("Backup file not found: {}", backup_filename));
    }

    // Safety check: don't allow deleting non-.db files
    if backup_path.extension().map_or(true, |ext| ext != "db") {
        return Err("Can only delete .db backup files".to_string());
    }

    fs::remove_file(&backup_path).map_err(|e| format!("Failed to delete backup: {}", e))?;

    Ok(format!("Backup deleted: {}", backup_filename))
}

/// Gets the backups directory path for the file picker
#[tauri::command]
fn get_backups_path(app: AppHandle) -> Result<String, String> {
    let backups_dir = get_backups_dir(&app)?;
    Ok(backups_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn print_receipt(text: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let lpstat = Command::new("lpstat")
            .arg("-p")
            .output()
            .map_err(|e| format!("Printing not available (lpstat not found): {e}"))?;

        if !lpstat.status.success() {
            let stderr = String::from_utf8_lossy(&lpstat.stderr);
            return Err(format!("Printer status check failed: {stderr}"));
        }

        let stdout = String::from_utf8_lossy(&lpstat.stdout);
        let has_printer = stdout
            .lines()
            .any(|l| l.starts_with("printer ") || l.contains(" printer "));
        if !has_printer {
            return Err(
                "No printer configured. Please add/connect a printer in system settings (CUPS)."
                    .to_string(),
            );
        }

        let tmp_path = std::env::temp_dir().join("motormods_receipt.txt");
        fs::write(&tmp_path, text).map_err(|e| format!("Failed to write receipt file: {e}"))?;

        let lp = Command::new("lp")
            .arg(tmp_path.to_string_lossy().to_string())
            .output()
            .map_err(|e| format!("Printing not available (lp not found): {e}"))?;

        if !lp.status.success() {
            let stderr = String::from_utf8_lossy(&lp.stderr);
            return Err(format!("Print failed: {stderr}"));
        }

        Ok(())
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = text;
        Err("Printing is currently supported only on Linux builds.".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            backup_database,
            restore_database,
            import_backup,
            export_backup,
            list_backups,
            delete_backup,
            get_backups_path,
            print_receipt
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
