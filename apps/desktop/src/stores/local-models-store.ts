import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";

// ─── Types ───

interface LocalModelsConfig {
  ollamaBaseUrl: string;
  qwenCoderLocal: string;
  qwenChatLocal: string;
  qwenDeepLocal: string;
}

interface OllamaValidation {
  reachable: boolean;
  modelFound: boolean;
  availableModels: string[];
  error: string | null;
}

interface LocalModelsState {
  config: LocalModelsConfig;
  isLoading: boolean;
  isSaving: boolean;

  // Actions
  loadConfig: () => Promise<void>;
  saveConfig: (cfg: LocalModelsConfig) => Promise<void>;
  validateModel: (baseUrl: string, model: string) => Promise<OllamaValidation>;
}

// ─── Defaults ───

const DEFAULT_CONFIG: LocalModelsConfig = {
  ollamaBaseUrl: "http://localhost:11434",
  qwenCoderLocal: "qwen3.6:35b-a3b-coding-mxfp8",
  qwenChatLocal: "qwen3.6:35b-a3b",
  qwenDeepLocal: "qwen3.6:27b",
};

// ─── Store ───

export const useLocalModelsStore = create<LocalModelsState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      isLoading: false,
      isSaving: false,

      loadConfig: async () => {
        set({ isLoading: true });
        try {
          const config = await invoke<LocalModelsConfig>(
            "get_local_models_config"
          );
          set({ config, isLoading: false });
        } catch (err: any) {
          console.error("Failed to load local models config:", err);
          set({ isLoading: false });
        }
      },

      saveConfig: async (cfg: LocalModelsConfig) => {
        set({ isSaving: true });
        try {
          await invoke("set_local_models_config", { config: cfg });
          set({ config: cfg, isSaving: false });
        } catch (err: any) {
          console.error("Failed to save local models config:", err);
          set({ isSaving: false });
          throw err;
        }
      },

      validateModel: async (
        baseUrl: string,
        model: string
      ): Promise<OllamaValidation> => {
        try {
          const result = await invoke<OllamaValidation>(
            "validate_ollama_model",
            { baseUrl, model }
          );
          return result;
        } catch (err: any) {
          console.error("Failed to validate Ollama model:", err);
          return {
            reachable: false,
            modelFound: false,
            availableModels: [],
            error: err?.message || String(err),
          };
        }
      },
    }),
    {
      name: "localprism-local-models",
    }
  )
);
