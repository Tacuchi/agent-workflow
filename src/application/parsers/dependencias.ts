export interface ParsedDependencias {
  headers: string[];
  rows: Record<string, string>[];
  count: number;
}

const TABLE_LINE_RE = /^\s*\|(.+)\|\s*$/;
const SEPARATOR_RE = /^\s*\|[\s|:-]+\|\s*$/;

export function parseDependencias(text: string): ParsedDependencias {
  const lines = text.split("\n");
  const tableResult = parseTable(lines);
  if (tableResult) {
    return {
      headers: tableResult.headers,
      rows: tableResult.rows,
      count: tableResult.rows.length,
    };
  }
  const fallback = parseBulletList(lines);
  return {
    headers: fallback.length > 0 ? ["item"] : [],
    rows: fallback,
    count: fallback.length,
  };
}

interface TableResult {
  headers: string[];
  rows: Record<string, string>[];
}

function parseTable(lines: string[]): TableResult | null {
  for (let i = 0; i < lines.length; i++) {
    const headerLine = lines[i];
    const next = lines[i + 1];
    if (headerLine === undefined || next === undefined) continue;
    const headerCells = parseRow(headerLine);
    if (!headerCells || !SEPARATOR_RE.test(next)) continue;
    const rows = collectRows(lines, i + 2, headerCells);
    return { headers: headerCells, rows };
  }
  return null;
}

function collectRows(
  lines: string[],
  startIndex: number,
  headers: string[],
): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (let j = startIndex; j < lines.length; j++) {
    const rowLine = lines[j];
    if (rowLine === undefined) break;
    const row = parseRow(rowLine);
    if (!row) break;
    if (row.length === headers.length) {
      rows.push(zipRow(headers, row));
    }
  }
  return rows;
}

function zipRow(headers: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let k = 0; k < headers.length; k++) {
    const key = headers[k];
    const val = row[k];
    if (key !== undefined && val !== undefined) {
      obj[key] = val;
    }
  }
  return obj;
}

function parseBulletList(lines: string[]): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*[-*]\s+(.+)/);
    if (m?.[1]) {
      rows.push({ item: m[1].trim() });
    }
  }
  return rows;
}

function parseRow(line: string): string[] | null {
  const m = line.match(TABLE_LINE_RE);
  if (!m || !m[1]) return null;
  return m[1].split("|").map((c) => c.trim());
}
