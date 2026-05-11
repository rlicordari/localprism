// LocalPrism — Local models configuration.
//
// Manages user-configurable mapping between frontend model IDs (e.g. "qwen-coder-local")
// and Ollama model names + base URL. Persisted to a JSON file in the app config dir.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

const CONFIG_FILE_NAME: &str = "local_models.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModelsConfig {
    pub ollama_base_url: String,
    pub qwen_coder_local: String,
    pub qwen_chat_local: String,
    pub qwen_deep_local: String,
}

impl Default for LocalModelsConfig {
    fn default() -> Self {
        Self {
            ollama_base_url: "http://localhost:11434".to_string(),
            qwen_coder_local: "qwen3.6:35b-a3b".to_string(),
            qwen_chat_local: "qwen3.6:35b-a3b".to_string(),
            qwen_deep_local: "qwen3.6:27b".to_string(),
        }
    }
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Cannot resolve app config dir: {}", e))?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Cannot create app config dir: {}", e))?;
    Ok(dir.join(CONFIG_FILE_NAME))
}

/// Load config from disk, falling back to defaults if file is missing or invalid.
pub fn load_config(app: &tauri::AppHandle) -> LocalModelsConfig {
    let path = match config_path(app) {
        Ok(p) => p,
        Err(_) => return LocalModelsConfig::default(),
    };
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return LocalModelsConfig::default(),
    };
    serde_json::from_str(&content).unwrap_or_default()
}

fn save_config(app: &tauri::AppHandle, cfg: &LocalModelsConfig) -> Result<(), String> {
    let path = config_path(app)?;
    let content = serde_json::to_string_pretty(cfg)
        .map_err(|e| format!("Cannot serialize config: {}", e))?;
    std::fs::write(&path, content).map_err(|e| format!("Cannot write config: {}", e))?;
    Ok(())
}

/// Resolve a frontend model id to (ollama_model_name, optional_base_url).
/// For local Qwen ids, returns the configured Ollama model + base URL.
/// For cloud Claude ids, returns the id unchanged + None.
pub fn resolve_model(app: &tauri::AppHandle, frontend_model: &str) -> (String, Option<String>) {
    let cfg = load_config(app);
    match frontend_model {
        "qwen-coder-local" => (cfg.qwen_coder_local, Some(cfg.ollama_base_url)),
        "qwen-chat-local" => (cfg.qwen_chat_local, Some(cfg.ollama_base_url)),
        "qwen-deep-local" => (cfg.qwen_deep_local, Some(cfg.ollama_base_url)),
        other => (other.to_string(), None),
    }
}

// ─── Tauri Commands ───

#[tauri::command]
pub async fn get_local_models_config(app: tauri::AppHandle) -> Result<LocalModelsConfig, String> {
    Ok(load_config(&app))
}

#[tauri::command]
pub async fn set_local_models_config(
    app: tauri::AppHandle,
    config: LocalModelsConfig,
) -> Result<(), String> {
    save_config(&app, &config)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaValidation {
    pub reachable: bool,
    pub model_found: bool,
    pub available_models: Vec<String>,
    pub error: Option<String>,
}

/// Validate that Ollama is reachable at base_url and that the given model exists in /api/tags.
#[tauri::command]
pub async fn validate_ollama_model(
    base_url: String,
    model: String,
) -> Result<OllamaValidation, String> {
    let url = format!("{}/api/tags", base_url.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => {
            return Ok(OllamaValidation {
                reachable: false,
                model_found: false,
                available_models: vec![],
                error: Some(format!("Cannot reach Ollama at {}: {}", base_url, e)),
            });
        }
    };

    if !resp.status().is_success() {
        return Ok(OllamaValidation {
            reachable: false,
            model_found: false,
            available_models: vec![],
            error: Some(format!("Ollama responded with status {}", resp.status())),
        });
    }

    #[derive(Deserialize)]
    struct TagsResponse {
        models: Vec<TagModel>,
    }
    #[derive(Deserialize)]
    struct TagModel {
        name: String,
    }

    let tags: TagsResponse = match resp.json().await {
        Ok(t) => t,
        Err(e) => {
            return Ok(OllamaValidation {
                reachable: true,
                model_found: false,
                available_models: vec![],
                error: Some(format!("Cannot parse Ollama response: {}", e)),
            });
        }
    };

    let available: Vec<String> = tags.models.into_iter().map(|m| m.name).collect();
    let model_found = available.iter().any(|m| m == &model);

    Ok(OllamaValidation {
        reachable: true,
        model_found,
        available_models: available,
        error: None,
    })
}
