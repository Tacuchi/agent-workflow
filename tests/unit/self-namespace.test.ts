import { describe, expect, it } from "vitest";
import { PathsService } from "../../src/application/paths-service.js";
import { selfNamespace } from "../../src/application/self/namespace-info.js";
import type { CliContext } from "../../src/cli/types.js";
import { normalizeNamespace } from "../../src/runtime/namespace.js";

describe("selfNamespace", () => {
  it("returns namespace and source from context", async () => {
    const ctx = {
      namespace: { namespace: normalizeNamespace("qtc"), source: "env" },
      paths: new PathsService(normalizeNamespace("qtc"), "/h", "/c"),
    } as unknown as CliContext;
    const result = await selfNamespace(ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ namespace: "qtc", source: "env" });
    }
  });

  it("works with default namespace 'agent-workflow' from default source", async () => {
    const ctx = {
      namespace: {
        namespace: normalizeNamespace("agent-workflow"),
        source: "default",
      },
      paths: new PathsService(normalizeNamespace("agent-workflow"), "/h", "/c"),
    } as unknown as CliContext;
    const result = await selfNamespace(ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        namespace: "agent-workflow",
        source: "default",
      });
    }
  });
});
