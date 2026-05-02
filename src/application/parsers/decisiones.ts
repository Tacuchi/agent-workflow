export interface ParsedDecision {
  id: string;
  title: string;
  preview: string | null;
  graduated: boolean;
  body?: string;
}

const DEC_HEADER_RE = /^##\s+(DEC-\d+)(?::\s*(.+))?$/gm;

export function parseDecisiones(text: string, includeFull = false): ParsedDecision[] {
  const headers: { id: string; title: string; bodyStart: number; bodyEnd: number }[] = [];

  for (const m of text.matchAll(DEC_HEADER_RE)) {
    const id = m[1];
    if (!id) continue;
    const title = (m[2] ?? "").trim();
    const bodyStart = (m.index ?? 0) + m[0].length;
    headers.push({ id, title, bodyStart, bodyEnd: text.length });
  }

  for (let i = 0; i < headers.length - 1; i++) {
    const next = headers[i + 1];
    const current = headers[i];
    if (!next || !current) continue;
    const nextStart = findHeaderStart(text, next.id, current.bodyStart);
    if (nextStart >= 0) {
      current.bodyEnd = nextStart;
    }
  }

  const items: ParsedDecision[] = [];
  for (const h of headers) {
    const body = text.slice(h.bodyStart, h.bodyEnd).trim();
    const preview = firstNonEmpty(body);
    const graduated = preview?.startsWith("→ docs/") === true;
    const item: ParsedDecision = {
      id: h.id,
      title: h.title,
      preview,
      graduated,
    };
    if (includeFull) {
      item.body = body;
    }
    items.push(item);
  }
  return items;
}

function findHeaderStart(text: string, id: string, fromIndex: number): number {
  const re = new RegExp(`^##\\s+${id.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(?::|$| )`, "m");
  const slice = text.slice(fromIndex);
  const m = slice.match(re);
  return m && m.index !== undefined ? fromIndex + m.index : -1;
}

function firstNonEmpty(text: string): string | null {
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length > 0) {
      return line;
    }
  }
  return null;
}
