// LocalPrism — LaTeX module disabled.
// Original Tectonic-based implementation backed up as latex.rs.original.bak.
// All public functions are kept as stubs returning a "not supported" error,
// so lib.rs and the frontend continue to compile and link without changes.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{Mutex, Semaphore};

const MAX_CONCURRENT: usize = 3;

const DISABLED_MSG: &str =
    "LaTeX compilation is disabled in LocalPrism. Use DOCX/Markdown export instead.";

#[allow(dead_code)]
struct BuildInfo {
    work_dir: PathBuf,
    main_file_name: String,
}

#[derive(Clone)]
pub struct LatexCompilerState {
    #[allow(dead_code)]
    last_builds: Arc<Mutex<HashMap<String, BuildInfo>>>,
    #[allow(dead_code)]
    project_locks: Arc<Mutex<HashMap<String, Arc<tokio::sync::Mutex<()>>>>>,
    #[allow(dead_code)]
    semaphore: Arc<Semaphore>,
}

impl Default for LatexCompilerState {
    fn default() -> Self {
        Self {
            last_builds: Arc::new(Mutex::new(HashMap::new())),
            project_locks: Arc::new(Mutex::new(HashMap::new())),
            semaphore: Arc::new(Semaphore::new(MAX_CONCURRENT)),
        }
    }
}

#[derive(serde::Serialize)]
pub struct SynctexResult {
    pub file: String,
    pub line: u32,
    pub column: u32,
}

#[derive(serde::Serialize)]
pub struct TexliveStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
}

// Used by lib.rs init path. Kept for ABI compatibility; always errors.
// Used by lib.rs init path. Kept for ABI compatibility; always errors.
pub fn compile_with_tectonic(_work_dir: &std::path::Path, _main_file: &str) -> Result<(), String> {
    Err(DISABLED_MSG.to_string())
}

#[tauri::command]
pub fn detect_texlive() -> TexliveStatus {
    TexliveStatus {
        installed: false,
        version: None,
        path: None,
    }
}

#[tauri::command]
pub async fn compile_latex(
    _project_root: String,
    _main_file: String,
    _engine: Option<String>,
    _state: tauri::State<'_, LatexCompilerState>,
) -> Result<String, String> {
    Err(DISABLED_MSG.to_string())
}

#[tauri::command]
pub async fn synctex_edit(
    _pdf_path: String,
    _page: u32,
    _x: f32,
    _y: f32,
) -> Result<SynctexResult, String> {
    Err(DISABLED_MSG.to_string())
}

pub async fn cleanup_all_builds(_state: &LatexCompilerState) {
    // No-op: nothing to clean up since LaTeX builds never happen.
}
