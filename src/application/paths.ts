import { isAbsolute, relative } from "node:path";

export function relpath(path: string, base: string): string {
  if (!path) return path;
  if (!isAbsolute(path)) return path;
  const rel = relative(base, path);
  if (rel.startsWith("..")) return path;
  return rel.split("\\").join("/");
}
