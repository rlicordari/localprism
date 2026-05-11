import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDocumentStore } from "@/stores/document-store";
import { FileTextIcon } from "lucide-react";

export function DocxPreview() {
  const activeFileId = useDocumentStore((s) => s.activeFileId);
  const content = useDocumentStore((s) => {
    const f = s.files.find((f) => f.id === activeFileId);
    return f?.content ?? "";
  });
  const fileName = useDocumentStore((s) => {
    const f = s.files.find((f) => f.id === activeFileId);
    return f?.name ?? "";
  });

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-[calc(36px+var(--titlebar-height))] items-center gap-2 border-border border-b bg-muted/30 px-3 pt-[var(--titlebar-height)]">
        <FileTextIcon className="size-4 text-blue-500" />
        <span className="font-medium text-muted-foreground text-sm">
          {fileName} — Preview
        </span>
      </div>
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
