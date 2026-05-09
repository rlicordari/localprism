import { useEffect, useState } from "react";
import { CpuIcon, Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalModelsStore } from "@/stores/local-models-store";
import { cn } from "@/lib/utils";

interface LocalModelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ValidationStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "found" }
  | { state: "unreachable" }
  | { state: "not-found" };

interface Draft {
  ollamaBaseUrl: string;
  qwenCoderLocal: string;
  qwenChatLocal: string;
  qwenDeepLocal: string;
}

export function LocalModelsDialog({
  open,
  onOpenChange,
}: LocalModelsDialogProps) {
  const config = useLocalModelsStore((s) => s.config);
  const isSaving = useLocalModelsStore((s) => s.isSaving);
  const loadConfig = useLocalModelsStore((s) => s.loadConfig);
  const saveConfig = useLocalModelsStore((s) => s.saveConfig);
  const validateModel = useLocalModelsStore((s) => s.validateModel);

  const [draft, setDraft] = useState<Draft>({
    ollamaBaseUrl: config.ollamaBaseUrl,
    qwenCoderLocal: config.qwenCoderLocal,
    qwenChatLocal: config.qwenChatLocal,
    qwenDeepLocal: config.qwenDeepLocal,
  });

  const [saveError, setSaveError] = useState<string | null>(null);

  const [coderStatus, setCoderStatus] = useState<ValidationStatus>({
    state: "idle",
  });
  const [chatStatus, setChatStatus] = useState<ValidationStatus>({
    state: "idle",
  });
  const [deepStatus, setDeepStatus] = useState<ValidationStatus>({
    state: "idle",
  });

  // Load config from disk when dialog opens, then seed draft from fresh store state
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    // Reset validation status
    setCoderStatus({ state: "idle" });
    setChatStatus({ state: "idle" });
    setDeepStatus({ state: "idle" });

    loadConfig().then(() => {
      if (cancelled) return;
      const fresh = useLocalModelsStore.getState().config;
      setDraft({
        ollamaBaseUrl: fresh.ollamaBaseUrl,
        qwenCoderLocal: fresh.qwenCoderLocal,
        qwenChatLocal: fresh.qwenChatLocal,
        qwenDeepLocal: fresh.qwenDeepLocal,
      });
    });

    return () => { cancelled = true; };
  }, [open, loadConfig]);

  const handleFieldChange = (field: keyof Draft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleTest = async (
    modelValue: string,
    setStatus: (s: ValidationStatus) => void,
  ) => {
    setStatus({ state: "checking" });
    const result = await validateModel(draft.ollamaBaseUrl, modelValue);
    if (!result.reachable) {
      setStatus({ state: "unreachable" });
    } else if (!result.modelFound) {
      setStatus({ state: "not-found" });
    } else {
      setStatus({ state: "found" });
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      await saveConfig(draft);
      onOpenChange(false);
    } catch {
      setSaveError("Failed to save. Please try again.");
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CpuIcon className="size-5" />
            Local Models
          </DialogTitle>
          <DialogDescription>
            Configure Ollama connection and model names
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Ollama URL */}
          <div className="space-y-1.5">
            <Label htmlFor="ollama-url">Ollama URL</Label>
            <Input
              id="ollama-url"
              value={draft.ollamaBaseUrl}
              onChange={(e) =>
                handleFieldChange("ollamaBaseUrl", e.target.value)
              }
              placeholder="http://localhost:11434"
            />
          </div>

          {/* Coder model */}
          <ModelRow
            id="coder-model"
            label="Coder model"
            value={draft.qwenCoderLocal}
            status={coderStatus}
            onChange={(v) => handleFieldChange("qwenCoderLocal", v)}
            onTest={() => handleTest(draft.qwenCoderLocal, setCoderStatus)}
          />

          {/* Chat model */}
          <ModelRow
            id="chat-model"
            label="Chat model"
            value={draft.qwenChatLocal}
            status={chatStatus}
            onChange={(v) => handleFieldChange("qwenChatLocal", v)}
            onTest={() => handleTest(draft.qwenChatLocal, setChatStatus)}
          />

          {/* Deep model */}
          <ModelRow
            id="deep-model"
            label="Deep model"
            value={draft.qwenDeepLocal}
            status={deepStatus}
            onChange={(v) => handleFieldChange("qwenDeepLocal", v)}
            onTest={() => handleTest(draft.qwenDeepLocal, setDeepStatus)}
          />
        </div>

        {saveError && (
          <p className="text-sm text-destructive">{saveError}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && (
              <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ModelRowProps {
  id: string;
  label: string;
  value: string;
  status: ValidationStatus;
  onChange: (value: string) => void;
  onTest: () => void;
}

function ModelRow({
  id,
  label,
  value,
  status,
  onChange,
  onTest,
}: ModelRowProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={onTest}
          disabled={status.state === "checking"}
        >
          {status.state === "checking" ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            "Test"
          )}
        </Button>
      </div>
      <ValidationMessage status={status} />
    </div>
  );
}

function ValidationMessage({ status }: { status: ValidationStatus }) {
  if (status.state === "idle" || status.state === "checking") {
    return null;
  }

  const isSuccess = status.state === "found";
  const message =
    status.state === "found"
      ? "✓ found"
      : status.state === "unreachable"
        ? "✗ unreachable"
        : "✗ not found";

  return (
    <p
      className={cn(
        "text-xs",
        isSuccess ? "text-green-600 dark:text-green-400" : "text-destructive",
      )}
    >
      {message}
    </p>
  );
}
