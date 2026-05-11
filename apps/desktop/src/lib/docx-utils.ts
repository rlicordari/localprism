import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import mammoth from "mammoth";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

// ── DOCX → Markdown ──────────────────────────────────────────────────────────

export async function readDocxAsMarkdown(
  absolutePath: string,
): Promise<string> {
  const bytes = await readFile(absolutePath);
  const result = await mammoth.convertToHtml({
    arrayBuffer: bytes.buffer as ArrayBuffer,
  });
  return htmlToMarkdown(result.value);
}

function htmlToMarkdown(html: string): string {
  return (
    html
      // Headings
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `# ${stripTags(c)}\n\n`)
      .replace(
        /<h2[^>]*>([\s\S]*?)<\/h2>/gi,
        (_, c) => `## ${stripTags(c)}\n\n`,
      )
      .replace(
        /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
        (_, c) => `### ${stripTags(c)}\n\n`,
      )
      .replace(
        /<h4[^>]*>([\s\S]*?)<\/h4>/gi,
        (_, c) => `#### ${stripTags(c)}\n\n`,
      )
      // Bold and italic
      .replace(
        /<strong[^>]*>([\s\S]*?)<\/strong>/gi,
        (_, c) => `**${stripTags(c)}**`,
      )
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_, c) => `**${stripTags(c)}**`)
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_, c) => `*${stripTags(c)}*`)
      .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_, c) => `*${stripTags(c)}*`)
      // Code
      .replace(
        /<code[^>]*>([\s\S]*?)<\/code>/gi,
        (_, c) => `\`${stripTags(c)}\``,
      )
      // List items
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => `- ${stripTags(c)}\n`)
      .replace(/<\/?[ou]l[^>]*>/gi, "\n")
      // Paragraphs and line breaks
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<p[^>]*>/gi, "")
      // Remove remaining tags
      .replace(/<[^>]+>/g, "")
      // Decode HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      // Normalise whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

// ── Inline markdown parser ────────────────────────────────────────────────────

interface Segment {
  text: string;
  bold: boolean;
  italic: boolean;
}

function parseInline(line: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  let buf = "";
  let bold = false;
  let italic = false;

  while (i < line.length) {
    if (line.startsWith("***", i) || line.startsWith("___", i)) {
      if (buf) segments.push({ text: buf, bold, italic });
      buf = "";
      bold = !bold;
      italic = !italic;
      i += 3;
    } else if (line.startsWith("**", i) || line.startsWith("__", i)) {
      if (buf) segments.push({ text: buf, bold, italic });
      buf = "";
      bold = !bold;
      i += 2;
    } else if (line[i] === "*" || line[i] === "_") {
      if (buf) segments.push({ text: buf, bold, italic });
      buf = "";
      italic = !italic;
      i += 1;
    } else {
      buf += line[i];
      i++;
    }
  }
  if (buf) segments.push({ text: buf, bold, italic });
  return segments;
}

function toRuns(line: string): TextRun[] {
  return parseInline(line).map(
    (s) =>
      new TextRun({
        text: s.text,
        bold: s.bold,
        italics: s.italic,
        font: "Times New Roman",
        size: 24,
      }),
  );
}

// ── Markdown → DOCX ──────────────────────────────────────────────────────────

export async function writeDocxFromMarkdown(
  content: string,
  absolutePath: string,
): Promise<void> {
  const doc = buildDocument(content);
  const buffer = await Packer.toBuffer(doc);
  await writeFile(absolutePath, new Uint8Array(buffer));
}

function buildDocument(markdown: string): Document {
  const paragraphs: Paragraph[] = [];

  for (const line of markdown.split("\n")) {
    const t = line.trim();

    if (t.startsWith("#### ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_4,
          children: toRuns(t.slice(5)),
        }),
      );
    } else if (t.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: toRuns(t.slice(4)),
        }),
      );
    } else if (t.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: toRuns(t.slice(3)),
        }),
      );
    } else if (t.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: toRuns(t.slice(2)),
        }),
      );
    } else if (/^[-*+] /.test(t)) {
      paragraphs.push(
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: toRuns(t.slice(2)),
        }),
      );
    } else if (/^\d+\. /.test(t)) {
      paragraphs.push(
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          children: toRuns(t.replace(/^\d+\. /, "")),
        }),
      );
    } else if (t === "") {
      paragraphs.push(new Paragraph({ children: [] }));
    } else {
      paragraphs.push(
        new Paragraph({ children: toRuns(t), spacing: { after: 160 } }),
      );
    }
  }

  return new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
        {
          reference: "numbers",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: paragraphs,
      },
    ],
  });
}
