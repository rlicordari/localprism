#!/usr/bin/env python3
"""
Patch continue_claude_code and resume_claude_code in claude.rs
to use local_models::resolve_model and inject Ollama env vars.
"""
import re
import sys
from pathlib import Path

FILE = Path("apps/desktop/src-tauri/src/claude.rs")

PATCHES = [
    # continue_claude_code
    {
        "name": "continue_claude_code",
        "old": '''#[tauri::command]
pub async fn continue_claude_code(
    window: WebviewWindow,
    project_path: String,
    prompt: String,
    tab_id: String,
    model: Option<String>,
    effort_level: Option<String>,
) -> Result<(), String> {
    let claude_path = find_claude_binary()?;

    let (mut args, stdin_payload) = with_prompt_transport(vec!["-c".to_string()], prompt);
    if let Some(m) = model {
        args.push("--model".to_string());
        args.push(m);
    }
    args.extend(common_claude_args());

    let cmd = create_command(&claude_path, args, &project_path, effort_level.as_deref());
    spawn_claude_process(window, cmd, tab_id, stdin_payload).await
}''',
        "new": '''#[tauri::command]
pub async fn continue_claude_code(
    window: WebviewWindow,
    project_path: String,
    prompt: String,
    tab_id: String,
    model: Option<String>,
    effort_level: Option<String>,
) -> Result<(), String> {
    let claude_path = find_claude_binary()?;
    let app = window.app_handle();

    let (mut args, stdin_payload) = with_prompt_transport(vec!["-c".to_string()], prompt);
    let mut ollama_base_url: Option<String> = None;
    if let Some(m) = model {
        let (resolved, base_url) = crate::local_models::resolve_model(app, &m);
        args.push("--model".to_string());
        args.push(resolved);
        ollama_base_url = base_url;
    }
    args.extend(common_claude_args());

    let mut cmd =
        create_command(&claude_path, args, &project_path, effort_level.as_deref());
    if let Some(url) = ollama_base_url {
        cmd.env("ANTHROPIC_BASE_URL", url);
        cmd.env("ANTHROPIC_AUTH_TOKEN", "ollama");
        cmd.env("ANTHROPIC_API_KEY", "");
    }
    spawn_claude_process(window, cmd, tab_id, stdin_payload).await
}''',
    },
    # resume_claude_code
    {
        "name": "resume_claude_code",
        "old": '''#[tauri::command]
pub async fn resume_claude_code(
    window: WebviewWindow,
    project_path: String,
    session_id: String,
    prompt: String,
    tab_id: String,
    model: Option<String>,
    effort_level: Option<String>,
) -> Result<(), String> {
    let claude_path = find_claude_binary()?;

    let (mut args, stdin_payload) =
        with_prompt_transport(vec!["--resume".to_string(), session_id], prompt);
    if let Some(m) = model {
        args.push("--model".to_string());
        args.push(m);
    }
    args.extend(common_claude_args());

    let cmd = create_command(&claude_path, args, &project_path, effort_level.as_deref());
    spawn_claude_process(window, cmd, tab_id, stdin_payload).await
}''',
        "new": '''#[tauri::command]
pub async fn resume_claude_code(
    window: WebviewWindow,
    project_path: String,
    session_id: String,
    prompt: String,
    tab_id: String,
    model: Option<String>,
    effort_level: Option<String>,
) -> Result<(), String> {
    let claude_path = find_claude_binary()?;
    let app = window.app_handle();

    let (mut args, stdin_payload) =
        with_prompt_transport(vec!["--resume".to_string(), session_id], prompt);
    let mut ollama_base_url: Option<String> = None;
    if let Some(m) = model {
        let (resolved, base_url) = crate::local_models::resolve_model(app, &m);
        args.push("--model".to_string());
        args.push(resolved);
        ollama_base_url = base_url;
    }
    args.extend(common_claude_args());

    let mut cmd =
        create_command(&claude_path, args, &project_path, effort_level.as_deref());
    if let Some(url) = ollama_base_url {
        cmd.env("ANTHROPIC_BASE_URL", url);
        cmd.env("ANTHROPIC_AUTH_TOKEN", "ollama");
        cmd.env("ANTHROPIC_API_KEY", "");
    }
    spawn_claude_process(window, cmd, tab_id, stdin_payload).await
}''',
    },
]

content = FILE.read_text()
for p in PATCHES:
    count = content.count(p["old"])
    if count == 0:
        print(f"❌ {p['name']}: pattern not found, skipping")
        sys.exit(1)
    if count > 1:
        print(f"❌ {p['name']}: pattern found {count} times, refusing to patch")
        sys.exit(1)
    content = content.replace(p["old"], p["new"], 1)
    print(f"✅ {p['name']}: patched")

FILE.write_text(content)
print("Done.")
