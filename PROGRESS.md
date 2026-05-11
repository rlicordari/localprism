# LocalPrism — Progress Notes

Fork of ClaudePrism (delibae/claude-prism) with local Ollama models support.

## Stack & environment

- macOS Apple Silicon (M1 Max, 64 GB RAM)
- Node 22 via nvm
- Rust 1.95 stable via rustup
- pnpm 11 (project pins 10.28.2 in package.json)
- Ollama 0.20.2 with these models installed:
  - `qwen3.6:35b-a3b-coding-mxfp8` — agentic coding default
  - `qwen3.6:35b-a3b` — chat/writing default
  - `qwen3.6:27b` — deep reasoning default
- Claude Code CLI at `~/.local/bin/claude`
- ClaudeR MCP for RStudio integration (separate from this fork)
- Shell aliases in `~/.zshrc`: `cccloud`, `cclocal`, `cclocal-chat`, `cclocal-deep`

## Repo layout (relevant)

- Root: `~/Projects/localprism`
- Branch in use: `localmodels-and-docx`
- Origin: `https://github.com/rlicordari/localprism`

## Done so far

### Build system fixes
- Tectonic dependency removed from `Cargo.toml` (incompatible with current Rust toolchain)
- `latex.rs` replaced with stub keeping public API surface (functions return `DISABLED_MSG`)
  - Original saved at `apps/desktop/src-tauri/src/latex.rs.original.bak`
- App now compiles and runs with `pnpm --filter=@claude-prism/desktop tauri dev`

### Frontend: model selector extended
- File: `apps/desktop/src/stores/claude-chat-store.ts`
  - Type union extended with `qwen-coder-local`, `qwen-chat-local`, `qwen-deep-local`
- File: `apps/desktop/src/components/claude-chat/chat-composer.tsx`
  - `CpuIcon` imported from lucide-react
  - 3 new entries added to model dropdown after `opusplan`
  - Button label updated with cascading ternary for new model IDs
  - New models display as "Qwen Coder ⚡", "Qwen Chat ⚡", "Qwen Deep ⚡"

### Backend: local models module
- New file: `apps/desktop/src-tauri/src/local_models.rs`
  - `LocalModelsConfig` struct with default values matching installed Ollama models
  - JSON persistence in app config dir
  - Tauri commands: `get_local_models_config`, `set_local_models_config`, `validate_ollama_model`
  - `resolve_model(app, frontend_id) -> (ollama_name, Option<base_url>)`
- File: `apps/desktop/src-tauri/Cargo.toml`
  - Added `json` feature to existing `reqwest` dependency
- File: `apps/desktop/src-tauri/src/lib.rs`
  - Registered `mod local_models;`
  - Registered 3 new Tauri commands in `invoke_handler!`
- File: `apps/desktop/src-tauri/src/claude.rs`
  - `execute_claude_code`, `continue_claude_code`, `resume_claude_code` all modified
  - Each function now: gets `app_handle`, calls `local_models::resolve_model`, sets env vars (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`) on the spawned `claude` subprocess if a local model is selected
- Patches applied via `patch_claude.py` (kept in repo root for reference)

### Verified working
- End-to-end test: selected "Qwen Coder (local)" in chat, sent prompt, got response from local Qwen
- First prompt cold-start: ~133s (model loading)
- Subsequent prompts: should be 5-30s (warm)

## TODO — next session

### Frontend Settings UI (Option 3: dropdown gear icon)
1. New file: `apps/desktop/src/stores/local-models-store.ts`
   - Zustand store with persist middleware
   - State: `LocalModelsConfig` mirroring Rust struct
   - Actions: `loadConfig` (calls `invoke("get_local_models_config")`), `saveConfig`, `validateModel`
2. New file: `apps/desktop/src/components/settings/local-models-dialog.tsx`
   - Modal dialog component
   - Form: 4 inputs (Ollama base URL + 3 model names)
   - "Test connection" button per Qwen slot calling `validate_ollama_model`
   - Save/Cancel buttons
3. Modify `chat-composer.tsx`
   - Add "⚙ Configure local models…" entry at the bottom of the dropdown
   - Wire up dialog open/close state

### DOCX native editing — DONE

- `apps/desktop/src/lib/docx-utils.ts` — mammoth (docx→HTML→markdown) + docx npm pkg (markdown→.docx)
- `ProjectFileType` extended with `"docx"`; `.docx` removed from IGNORED_EXTENSIONS in fs.ts
- `document-store.ts` — openProject / saveFile / saveAllFiles / refreshFiles all handle docx
- `latex-editor.tsx` — isDocx flag: markdown() lang mode, Mod-B/I write `**bold**`/`*italic*`
- `editor-toolbar.tsx` — "docx" fileType branch: markdown buttons (bold, italic, heading, list)
- `docx-preview.tsx` — react-markdown preview pane for .docx files
- `workspace-layout.tsx` — shows DocxPreview instead of PdfPreview for .docx files
- `sidebar.tsx` — blue FileTextIcon for .docx, "Import DOCX" entry in "+" dropdown

**DOCX round-trip note:** save regenerates the .docx from markdown via `docx` npm pkg.
Complex Word styles, images, and headers/footers are standardised (not preserved verbatim).

### Future / nice-to-have
- Improve DOCX fidelity (jszip XML round-trip or bundled pandoc)
- Rebrand: app name, icon, copyright (claude-prism → localprism in package.json, tauri.conf.json, etc.)
- Templates for IMRAD scientific articles

## Known issues / quirks

- Tauri version mismatch warning between Rust crates and NPM packages — non-blocking
- The "OpusPlan" model exists in the selector but unused on local models
- Default selected model in store is "opus" — may want to switch to "qwen-coder-local" as default
- ClaudePrism v1.0 may have other latent issues since the project shows minimal active maintenance

## Quick commands

```bash

# Run dev server
cd ~/Projects/localprism
pnpm --filter=@claude-prism/desktop tauri dev

# Verify backend compiles
cd ~/Projects/localprism/apps/desktop/src-tauri
cargo check

# Save work
cd ~/Projects/localprism
git add -A && git commit -m "..." && git push
```
