import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Sidebar } from "./sidebar";
import { LatexEditor } from "./editor/latex-editor";
import { PdfPreview } from "./preview/pdf-preview";
import { DocxPreview } from "./preview/docx-preview";
import { useDocumentStore } from "@/stores/document-store";

export function WorkspaceLayout() {
  const initialized = useDocumentStore((s) => s.initialized);
  const activeFileType = useDocumentStore((s) => {
    const f = s.files.find((f) => f.id === s.activeFileId);
    return f?.type;
  });

  if (!initialized) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  return (
    <PanelGroup direction="horizontal" className="h-full">
      <Panel defaultSize={15} minSize={10} maxSize={25}>
        <Sidebar />
      </Panel>

      <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-ring" />

      <Panel defaultSize={42.5} minSize={25}>
        <LatexEditor />
      </Panel>

      <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-ring" />

      <Panel defaultSize={42.5} minSize={25}>
        {activeFileType === "docx" ? <DocxPreview /> : <PdfPreview />}
      </Panel>
    </PanelGroup>
  );
}
