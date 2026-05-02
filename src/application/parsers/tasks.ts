export type TaskStatus = "open" | "closed";

export interface TaskItem {
  n: number;
  status: TaskStatus;
  text: string;
  deps?: string[];
}

export interface ParsedTasks {
  total: number;
  open: number;
  closed: number;
  progress_pct: number;
  items: TaskItem[];
  next_open: TaskItem | null;
}

const TASK_RE = /^\s*[-*]\s*\[([ xX])\]\s+(.+)$/;
const DEP_RE = /\(deps?:\s*([^)]+)\)/i;

export function parseTasks(text: string, compact = true): ParsedTasks {
  const items: TaskItem[] = [];
  let n = 0;

  for (const line of text.split("\n")) {
    const match = line.match(TASK_RE);
    if (!match || !match[1] || !match[2]) continue;
    n += 1;
    const status: TaskStatus = match[1].toLowerCase() === "x" ? "closed" : "open";
    let body = match[2].trim();

    let deps: string[] = [];
    const depMatch = body.match(DEP_RE);
    if (depMatch?.[1]) {
      deps = depMatch[1]
        .split(",")
        .map((d) => d.trim())
        .filter((d) => d.length > 0);
      body = body.replace(DEP_RE, "").trim();
    }

    const item: TaskItem = { n, status, text: body };
    if (deps.length > 0 || !compact) {
      item.deps = deps;
    }
    items.push(item);
  }

  const closedItems = items.filter((t) => t.status === "closed");
  const openItems = items.filter((t) => t.status === "open");
  const progressPct = items.length > 0 ? Math.round((100 * closedItems.length) / items.length) : 0;

  return {
    total: items.length,
    open: openItems.length,
    closed: closedItems.length,
    progress_pct: progressPct,
    items,
    next_open: openItems[0] ?? null,
  };
}
